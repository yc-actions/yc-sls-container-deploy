import {
    error,
    getBooleanInput,
    getIDToken,
    getInput,
    getMultilineInput,
    info,
    setFailed,
    setOutput
} from '@actions/core'
import { context } from '@actions/github'
import { errors, Session, waitForOperation } from '@yandex-cloud/nodejs-sdk'
import { containerService } from '@yandex-cloud/nodejs-sdk/serverless-containers-v1'
import { secretService } from '@yandex-cloud/nodejs-sdk/lockbox-v1'
import { Secret as LockboxSecret } from '@yandex-cloud/nodejs-sdk/dist/generated/yandex/cloud/lockbox/v1/secret'
import { PromisePool } from '@supercharge/promise-pool'
import axios from 'axios'

import {
    CreateContainerRequest,
    DeployContainerRevisionRequest,
    ListContainersRequest,
    ListContainersResponse
} from '@yandex-cloud/nodejs-sdk/dist/generated/yandex/cloud/serverless/containers/v1/container_service'
import {
    Container,
    LogOptions,
    Revision,
    StorageMount
} from '@yandex-cloud/nodejs-sdk/dist/generated/yandex/cloud/serverless/containers/v1/container'
import { LogLevel_Level } from '@yandex-cloud/nodejs-sdk/dist/generated/yandex/cloud/logging/v1/log_entry'
import { SetAccessBindingsRequest } from '@yandex-cloud/nodejs-sdk/dist/generated/yandex/cloud/access/access'
import { parseMemory } from './memory'
import { parseLogOptionsMinLevel } from './log-options-min-level'
import { parseStorageMounts } from './storage-mounts'
import { fromServiceAccountJsonFile } from './service-account-json'
import { SessionConfig } from '@yandex-cloud/nodejs-sdk/dist/types'

type DeepPartial<T> = T extends object ? { [P in keyof T]?: DeepPartial<T[P]> } : T

const findContainerByName = async (
    session: Session,
    folderId: string,
    containerName: string
): Promise<ListContainersResponse> => {
    const client = session.client(containerService.ContainerServiceClient)

    return client.list(
        ListContainersRequest.fromPartial({
            pageSize: 100,
            folderId,
            filter: `name = "${containerName}"`
        })
    )
}

const createContainer = async (session: Session, folderId: string, containerName: string): Promise<Container> => {
    const { repo } = context
    const client = session.client(containerService.ContainerServiceClient)
    const containerCreateOperation = await client.create(
        CreateContainerRequest.fromPartial({
            folderId,
            name: containerName,
            description: `Created from: ${repo.owner}/${repo.repo}`
        })
    )
    const operation = await waitForOperation(containerCreateOperation, session)

    if (operation.response) {
        return Container.decode(operation.response.value)
    }
    error('failed to create container')
    throw new Error('failed to create container')
}

const createRevision = async (
    session: Session,
    containerId: string,
    revisionInputs: IRevisionInputs
): Promise<Revision> => {
    const client = session.client(containerService.ContainerServiceClient)
    const req = {
        containerId,
        resources: {
            memory: revisionInputs.memory,
            cores: revisionInputs.cores,
            coreFraction: revisionInputs.coreFraction
        },
        executionTimeout: { seconds: revisionInputs.executionTimeout },
        serviceAccountId: revisionInputs.serviceAccountId,
        imageSpec: {
            imageUrl: revisionInputs.imageUrl,
            command: revisionInputs.command,
            args: revisionInputs.args,
            environment: revisionInputs.environment,
            workingDir: revisionInputs.workingDir
        },
        concurrency: revisionInputs.concurrency,
        secrets: revisionInputs.secrets,
        logOptions: revisionInputs.logOptions,
        storageMounts: revisionInputs.storageMounts
    } as DeepPartial<DeployContainerRevisionRequest>

    if (revisionInputs.networkId !== '') {
        req.connectivity = { networkId: revisionInputs.networkId, subnetIds: [] }
    }
    if (revisionInputs.provisioned !== undefined) {
        req.provisionPolicy = { minInstances: revisionInputs.provisioned }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const revisionDeployOperation = await client.deployRevision(DeployContainerRevisionRequest.fromPartial(req as any))

    const operation = await waitForOperation(revisionDeployOperation, session)

    if (operation.response) {
        return Revision.decode(operation.response.value)
    }
    error('failed to create revision')
    throw new Error('failed to create revision')
}

interface Environment {
    [key: string]: string
}

interface IRevisionInputs {
    imageUrl: string
    workingDir: string
    serviceAccountId: string
    cores: number
    memory: number
    coreFraction: number
    concurrency: number
    executionTimeout: number
    command: { command: string[] } | undefined
    args: { args: string[] } | undefined
    environment: Environment
    provisioned: number | undefined
    secrets: Secret[]
    logOptions: LogOptions
    storageMounts?: StorageMount[]
    networkId?: string
}

const parseRevisionInputs = (): IRevisionInputs => {
    const imageUrl: string = getInput('revision-image-url')
    const workingDir: string = getInput('revision-working-dir')
    const serviceAccountId: string = getInput('revision-service-account-id')
    const cores: number = Number.parseInt(getInput('revision-cores') || '1', 10)
    const memory: number = parseMemory(getInput('revision-memory') || '128Mb')
    const coreFraction: number = Number.parseInt(getInput('revision-core-fraction') || '100', 10)
    const concurrency: number = Number.parseInt(getInput('revision-concurrency') || '1', 10)
    const provisionedRaw: string = getInput('revision-provisioned')
    const executionTimeout: number = Number.parseInt(getInput('revision-execution-timeout') || '3', 10)
    const networkId: string = getInput('revision-network-id')
    const commands: string[] = getMultilineInput('revision-commands')

    const command = commands.length > 0 ? { command: commands } : undefined
    const argList: string[] = getMultilineInput('revision-args')

    const args = argList.length > 0 ? { args: argList } : undefined
    const environment: Environment = parseEnvironment(getMultilineInput('revision-env'))
    const secrets: Secret[] = parseLockboxVariablesMapping(getMultilineInput('revision-secrets'))

    const logOptionsDisabled: boolean = getBooleanInput('revision-log-options-disabled')
    const logOptionsLogGroupId: string | undefined = getInput('revision-log-options-log-group-id') || undefined
    const logOptionsFolderId: string | undefined = getInput('revision-log-options-folder-id') || undefined
    const logOptionsMinLevel: LogLevel_Level = parseLogOptionsMinLevel(getInput('revision-log-options-min-level'))

    if (!!logOptionsLogGroupId && !!logOptionsFolderId) {
        throw new Error(
            'revision-log-options-log-group-id and revision-log-options-folder-id cannot be set at the same time'
        )
    }

    const storageMounts: StorageMount[] | undefined = parseStorageMounts(getMultilineInput('revision-storage-mounts'))

    const logOptions = LogOptions.fromJSON({
        disabled: logOptionsDisabled,
        logGroupId: logOptionsLogGroupId,
        folderId: logOptionsFolderId,
        minLevel: logOptionsMinLevel
    })

    let provisioned = undefined

    if (provisionedRaw !== '') {
        provisioned = Number.parseInt(provisionedRaw, 10)
    }

    return {
        imageUrl,
        workingDir,
        serviceAccountId,
        cores,
        memory,
        coreFraction,
        concurrency,
        executionTimeout,
        command,
        args,
        environment,
        provisioned,
        secrets,
        networkId,
        logOptions,
        storageMounts
    }
}

const makeContainerPublic = async (session: Session, containerId: string): Promise<void> => {
    const client = session.client(containerService.ContainerServiceClient)

    await client.setAccessBindings(
        SetAccessBindingsRequest.fromPartial({
            resourceId: containerId,
            accessBindings: [
                {
                    roleId: 'serverless.containers.invoker',
                    subject: {
                        id: 'allUsers',
                        type: 'system'
                    }
                }
            ]
        })
    )
}

export const resolveLatestLockboxVersions = async (session: Session, secrets: Secret[]): Promise<Secret[]> => {
    const secretsWithLatest = secrets.filter(s => s.versionId === 'latest')
    if (secretsWithLatest.length === 0) {
        return secrets
    }
    const client = session.client(secretService.SecretServiceClient)
    const { results: resolvedSecrets, errors: resolveErrors } = await PromisePool.for(secretsWithLatest)
        .withConcurrency(5)
        .process(async secret => {
            const lockboxSecret: LockboxSecret = await client.get({ secretId: secret.id })
            if (!lockboxSecret.currentVersion) {
                throw new Error(`Secret ${secret.id} has no current version`)
            }
            return {
                ...secret,
                versionId: lockboxSecret.currentVersion.id
            }
        })
    if (resolveErrors.length > 0) {
        const errorMessages = resolveErrors.map(e => e.message).join(', ')
        throw new Error(`Failed to resolve latest versions for secrets: ${errorMessages}`)
    }
    return secrets.map(s => {
        const resolved = resolvedSecrets.find(
            rs => rs.id === s.id && rs.key === s.key && rs.environmentVariable === s.environmentVariable
        )
        return resolved || s
    })
}

export const run = async (): Promise<void> => {
    try {
        info('start')
        let sessionConfig: SessionConfig = {}
        const ycSaJsonCredentials = getInput('yc-sa-json-credentials')
        const ycIamToken = getInput('yc-iam-token')
        const ycSaId = getInput('yc-sa-id')
        if (ycSaJsonCredentials !== '') {
            const serviceAccountJson = fromServiceAccountJsonFile(JSON.parse(ycSaJsonCredentials))
            info('Parsed Service account JSON')
            sessionConfig = { serviceAccountJson }
        } else if (ycIamToken !== '') {
            sessionConfig = { iamToken: ycIamToken }
            info('Using IAM token')
        } else if (ycSaId !== '') {
            const ghToken = await getIDToken()
            if (!ghToken) {
                throw new Error('No credentials provided')
            }
            const saToken = await exchangeToken(ghToken, ycSaId)
            sessionConfig = { iamToken: saToken }
        } else {
            throw new Error('No credentials')
        }
        const session = new Session(sessionConfig)

        const folderId: string = getInput('folder-id', {
            required: true
        })
        const containerName: string = getInput('container-name', {
            required: true
        })
        const revisionInputs = parseRevisionInputs()
        revisionInputs.secrets = await resolveLatestLockboxVersions(session, revisionInputs.secrets)

        info(`Folder ID: ${folderId}, container name: ${containerName}`)
        const containersResponse = await findContainerByName(session, folderId, containerName)
        let containerId: string

        if (containersResponse.containers.length > 0) {
            containerId = containersResponse.containers[0].id
            info(`Container with name: ${containerName} already exists and has id: ${containerId}`)
        } else {
            info(`There is no container with name: ${containerName}. Creating a new one.`)
            const resp = await createContainer(session, folderId, containerName)

            containerId = resp.id
            info(`Container successfully created. Id: ${containerId}`)
        }
        setOutput('id', containerId)
        info('Creating new revision.')
        const rev = await createRevision(session, containerId, revisionInputs)

        info(`Revision created. Id: ${rev.id}`)

        setOutput('rev', rev.id)

        if (getInput('public')) {
            await makeContainerPublic(session, containerId)
            info('Container is public now')
        }
    } catch (err) {
        if (err instanceof errors.ApiError) {
            error(`${err.message}\nx-request-id: ${err.requestId}\nx-server-trace-id: ${err.serverTraceId}`)
        }
        setFailed(err as Error)
    }
}

export type Secret = {
    environmentVariable: string
    id: string
    versionId: string
    key: string
}

export const parseLockboxSecretDefinition = (line: string): Secret | null => {
    const trimmedLine = line.trim()

    // Skip empty lines and comments
    if (trimmedLine === '' || trimmedLine.startsWith('#')) {
        return null
    }

    // Remove inline comments (everything after #)
    const lineWithoutComments = trimmedLine.split('#')[0].trim()

    const regex = /^(?<environmentVariable>.+)=(?<secretId>.+)\/(?<versionId>.+)\/(?<key>.+)$/gm
    const m = regex.exec(lineWithoutComments)

    if (!m?.groups) {
        throw new Error(`Line: '${line}' has wrong format`)
    }

    const { environmentVariable, secretId, versionId, key } = m.groups

    return {
        environmentVariable,
        id: secretId,
        versionId,
        key
    }
}

export const parseEnvironment = (envLines: string[]): Environment => {
    const environment: Environment = {}

    for (const line of envLines) {
        const trimmedLine = line.trim()

        // Skip empty lines and comments
        if (trimmedLine === '' || trimmedLine.startsWith('#')) {
            continue
        }

        const i = trimmedLine.indexOf('=')
        if (i === -1) {
            continue // Skip lines without '=' character
        }

        const [key, value] = [trimmedLine.slice(0, i).trim(), trimmedLine.slice(i + 1).trim()]
        environment[key] = value
    }

    return environment
}

// environmentVariable=id/versionId/key
export const parseLockboxVariablesMapping = (secrets: string[]): Secret[] => {
    info(`Secrets string: "${secrets}"`)
    const secretsArr: Secret[] = []

    for (const line of secrets) {
        const secret = parseLockboxSecretDefinition(line)
        if (secret) {
            secretsArr.push(secret)
        }
    }

    info(`SecretsObject: "${JSON.stringify(secretsArr)}"`)

    return secretsArr
}

async function exchangeToken(token: string, saId: string): Promise<string> {
    info(`Exchanging token for service account ${saId}`)
    const res = await axios.post(
        'https://auth.yandex.cloud/oauth/token',
        {
            grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
            requested_token_type: 'urn:ietf:params:oauth:token-type:access_token',
            audience: saId,
            subject_token: token,
            subject_token_type: 'urn:ietf:params:oauth:token-type:id_token'
        },
        {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        }
    )
    if (res.status !== 200) {
        throw new Error(`Failed to exchange token: ${res.status} ${res.statusText}`)
    }
    if (!res.data.access_token) {
        throw new Error(`Failed to exchange token: ${res.data.error} ${res.data.error_description}`)
    }
    info(`Token exchanged successfully`)
    return res.data.access_token
}
