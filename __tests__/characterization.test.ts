/**
 * Behavior contract for the container deploy logic.
 *
 * Records every Yandex Cloud SDK request the action issues, per input scenario,
 * and snapshots it. The snapshot is captured on the pre-rewrite code and must be
 * reproduced byte-identically by the rewritten code.
 */
import { beforeEach, describe, expect, it, jest } from '@jest/globals'
import { Secret as LockboxSecret } from '@yandex-cloud/nodejs-sdk/dist/generated/yandex/cloud/lockbox/v1/secret'
import { Container } from '@yandex-cloud/nodejs-sdk/dist/generated/yandex/cloud/serverless/containers/v1/container'
import { Operation } from '@yandex-cloud/nodejs-sdk/dist/generated/yandex/cloud/operation/operation'

import { normalize } from '../__fixtures__/normalize-request.js'
import * as core from '../__fixtures__/core.js'
import * as github from '../__fixtures__/github.js'
import * as axios from '../__fixtures__/axios.js'
import * as sdk from '../__fixtures__/yandex-sdk/index.js'
import {
    __setContainerList,
    __setRevisionList,
    containerService,
    ContainerServiceMock
} from '../__fixtures__/yandex-sdk/serverless-containers-v1.js'
import {
    __setGetSecretFail,
    __setSecretList,
    secretService,
    SecretServiceMock
} from '../__fixtures__/yandex-sdk/lockbox-v1.js'

jest.unstable_mockModule('@actions/core', () => core)
jest.unstable_mockModule('@actions/github', () => github)
jest.unstable_mockModule('axios', () => axios)
jest.unstable_mockModule('@yandex-cloud/nodejs-sdk', () => sdk)
jest.unstable_mockModule('@yandex-cloud/nodejs-sdk/serverless-containers-v1', () => ({ containerService }))
jest.unstable_mockModule('@yandex-cloud/nodejs-sdk/lockbox-v1', () => ({ secretService }))

const { run } = await import('../src/main.js')

const SA_JSON = `{
    "id": "id",
    "created_at": "2021-01-01T00:00:00Z",
    "key_algorithm": "RSA_2048",
    "service_account_id": "service_account_id",
    "private_key": "private_key",
    "public_key": "public_key"
  }`

/**
 * The defaults action.yml declares, which the runner always supplies. Included
 * explicitly so the snapshot records what really reaches the code rather than
 * relying on the `|| '1'` fallbacks inside readInputs.
 */
const BASE: Record<string, string> = {
    'folder-id': 'folderid',
    'container-name': 'my-container',
    'revision-image-url': 'cr.yandex/crpxxx/my-image:latest',
    'revision-cores': '1',
    'revision-memory': '128Mb',
    'revision-core-fraction': '100',
    'revision-concurrency': '1',
    'revision-execution-timeout': '3',
    'revision-runtime': 'http',
    'revision-log-options-disabled': 'false',
    'revision-log-options-min-level': 'level_unspecified'
}

const CREDS: Record<string, string> = { 'yc-sa-json-credentials': SA_JSON }

/** A Lockbox secret with a resolvable current version. */
function lockboxSecret(id: string, name: string, versionId: string): LockboxSecret {
    return {
        id,
        folderId: 'folderid',
        name,
        description: '',
        labels: {},
        status: 1,
        kmsKeyId: '',
        deletionProtection: false,
        currentVersion: {
            id: versionId,
            secretId: id,
            description: '',
            status: 1,
            payloadEntryKeys: []
        }
    } as LockboxSecret
}

const SCENARIOS: Array<{ name: string; inputs: Record<string, string>; setup?: () => void }> = [
    {
        name: 'required inputs only, SA JSON credentials',
        inputs: { ...BASE, ...CREDS }
    },
    {
        name: 'IAM token credentials',
        inputs: { ...BASE, 'yc-iam-token': 'iam-token-input' }
    },
    {
        name: 'workload identity federation credentials',
        inputs: { ...BASE, 'yc-sa-id': 'wif-sa-id' }
    },
    {
        name: 'no credentials at all',
        inputs: { ...BASE }
    },
    {
        name: 'container already exists',
        inputs: { ...BASE, ...CREDS },
        setup: () =>
            __setContainerList([
                Container.fromJSON({
                    id: 'existing-container-id',
                    folderId: 'folderid',
                    name: 'my-container',
                    description: 'pre-existing',
                    labels: {},
                    url: '',
                    status: 'ACTIVE'
                })
            ])
    },
    {
        name: 'public container',
        inputs: { ...BASE, ...CREDS, public: 'true' }
    },
    {
        name: 'public set to the string false - still public',
        inputs: { ...BASE, ...CREDS, public: 'false' }
    },
    {
        name: 'runtime task',
        inputs: { ...BASE, ...CREDS, 'revision-runtime': 'task' }
    },
    {
        name: 'runtime HTTP uppercase',
        inputs: { ...BASE, ...CREDS, 'revision-runtime': 'HTTP' }
    },
    {
        name: 'scaling policy with both zone limits',
        inputs: {
            ...BASE,
            ...CREDS,
            'revision-zone-instances-limit': '5',
            'revision-zone-requests-limit': '100'
        }
    },
    {
        name: 'scaling policy with only zone instances limit',
        inputs: { ...BASE, ...CREDS, 'revision-zone-instances-limit': '10' }
    },
    {
        name: 'scaling policy with only zone requests limit',
        inputs: { ...BASE, ...CREDS, 'revision-zone-requests-limit': '50' }
    },
    {
        name: 'scaling policy with both zone limits set to zero',
        inputs: {
            ...BASE,
            ...CREDS,
            'revision-zone-instances-limit': '0',
            'revision-zone-requests-limit': '0'
        }
    },
    {
        name: 'provisioned instances',
        inputs: { ...BASE, ...CREDS, 'revision-provisioned': '2' }
    },
    {
        name: 'network id',
        inputs: { ...BASE, ...CREDS, 'revision-network-id': 'networkid' }
    },
    {
        name: 'revision service account id',
        inputs: { ...BASE, ...CREDS, 'revision-service-account-id': 'serviceaccountid' }
    },
    {
        name: 'memory and cores and core fraction',
        inputs: {
            ...BASE,
            ...CREDS,
            'revision-memory': '2Gb',
            'revision-cores': '4',
            'revision-core-fraction': '50',
            'revision-concurrency': '8',
            'revision-execution-timeout': '30'
        }
    },
    {
        name: 'working dir, commands and args',
        inputs: {
            ...BASE,
            ...CREDS,
            'revision-working-dir': '/app',
            'revision-commands': '/bin/sh\n-c',
            'revision-args': 'server\n--port=8080'
        }
    },
    {
        name: 'environment variables',
        inputs: {
            ...BASE,
            ...CREDS,
            'revision-env': 'FOO=BAR\nDATABASE_URL=postgres://u:p@h:5432/db?sslmode=verify-full'
        }
    },
    {
        name: 'storage mounts',
        inputs: {
            ...BASE,
            ...CREDS,
            'revision-storage-mounts': 'my-bucket/photos:/mnt/photos:ro\nother-bucket:/mnt/other'
        }
    },
    {
        name: 'ephemeral mounts',
        inputs: { ...BASE, ...CREDS, 'revision-ephemeral-mounts': '/app/tmp:5Gb:rw\n/app/cache:512Mb' }
    },
    {
        name: 'both mount kinds together',
        inputs: {
            ...BASE,
            ...CREDS,
            'revision-ephemeral-mounts': '/app/tmp:5Gb:rw',
            'revision-storage-mounts': 'my-bucket:/mnt/data:ro'
        }
    },
    {
        name: 'secrets with explicit version',
        inputs: { ...BASE, ...CREDS, 'revision-secrets': 'ENV_VAR_1=secret-id/verid/VAR_1' }
    },
    {
        name: 'secrets with latest resolved by id',
        inputs: { ...BASE, ...CREDS, 'revision-secrets': 'ENV_VAR_1=secret-1/latest/VAR_1' },
        setup: () => __setSecretList([lockboxSecret('secret-1', 'secret-one', 'version-abc')])
    },
    {
        name: 'secrets with latest falling back to lookup by name',
        inputs: { ...BASE, ...CREDS, 'revision-secrets': 'ENV_VAR_1=secret-one/latest/VAR_1' },
        setup: () => __setSecretList([lockboxSecret('secret-1', 'secret-one', 'version-abc')])
    },
    {
        name: 'secrets with latest that cannot be resolved',
        inputs: { ...BASE, ...CREDS, 'revision-secrets': 'ENV_VAR_1=missing-secret/latest/VAR_1' },
        setup: () => __setGetSecretFail(true)
    },
    {
        name: 'log options disabled with group id and min level',
        inputs: {
            ...BASE,
            ...CREDS,
            'revision-log-options-disabled': 'true',
            'revision-log-options-log-group-id': 'logsgroupid',
            'revision-log-options-min-level': 'warn'
        }
    },
    {
        name: 'log options with folder id',
        inputs: { ...BASE, ...CREDS, 'revision-log-options-folder-id': 'logfolderid' }
    },
    {
        name: 'log options with group id and folder id both set',
        inputs: {
            ...BASE,
            ...CREDS,
            'revision-log-options-log-group-id': 'logsgroupid',
            'revision-log-options-folder-id': 'logfolderid'
        }
    },
    {
        name: 'container creation fails',
        inputs: { ...BASE, ...CREDS, 'container-name': 'fail' }
    },
    {
        name: 'revision deploy fails',
        inputs: { ...BASE, ...CREDS },
        // The fixture's built-in `req.description === 'fail'` trigger (see
        // __fixtures__/yandex-sdk/serverless-containers-v1.ts) is unreachable
        // through run(): src/container/revision.ts's deployRevision never sets a description on the
        // deploy request - only src/container/create.ts's createContainer does, and that's derived
        // from repo.owner/repo.repo, not user input. So this scenario drives the failure directly,
        // by reconfiguring the already-imported ContainerServiceMock.deployRevision for one call to
        // return an operation with no `response` (the same shape the mock itself uses for its
        // `create` failure branch), which sends the tail of deployRevision down the
        // `error('failed to create revision')` / throw path.
        setup: () =>
            ContainerServiceMock.deployRevision.mockImplementationOnce(async () =>
                Operation.fromJSON({
                    id: 'operationid',
                    error: {},
                    done: true
                })
            )
    }
]

describe('characterization', () => {
    beforeEach(() => {
        process.env.GITHUB_REPOSITORY = 'owner/repo'

        jest.clearAllMocks()
        core.getIDToken.mockImplementation(async () => 'github-token')

        __setContainerList([])
        __setRevisionList([])
        __setSecretList([])
        __setGetSecretFail(false)
    })

    for (const scenario of SCENARIOS) {
        it(`records SDK requests: ${scenario.name}`, async () => {
            core.getInput.mockImplementation((name: string) => scenario.inputs[name] || '')
            core.getBooleanInput.mockImplementation((name: string) => scenario.inputs[name] === 'true')
            core.getMultilineInput.mockImplementation((name: string) =>
                scenario.inputs[name] ? scenario.inputs[name].split('\n') : []
            )
            scenario.setup?.()

            await run()

            expect({
                listContainers: normalize(ContainerServiceMock.list.mock.calls),
                createContainer: normalize(ContainerServiceMock.create.mock.calls),
                deployRevision: normalize(ContainerServiceMock.deployRevision.mock.calls),
                setAccessBindings: normalize(ContainerServiceMock.setAccessBindings.mock.calls),
                getSecret: normalize(SecretServiceMock.get.mock.calls),
                listSecrets: normalize(SecretServiceMock.list.mock.calls),
                // These two exist to catch the credential chain (resolveSessionConfig in
                // src/main.ts) and the WIF token exchange (exchangeToken in src/auth.ts).
                // Without them, the SA-JSON/IAM-token/WIF
                // scenarios are indistinguishable in the snapshot, since sessionConfig never reaches
                // any SDK service call. Do not remove as "noise".
                session: normalize(sdk.Session.mock.calls),
                tokenExchange: normalize(axios.post.mock.calls),
                setOutput: normalize(core.setOutput.mock.calls),
                setFailed: normalize(core.setFailed.mock.calls)
            }).toMatchSnapshot()
        })
    }
})
