import * as core from '@actions/core'
import * as github from '@actions/github'

import {
  Container,
  Revision
} from '@nikolay.matrosov/yc-ts-sdk/lib/generated/yandex/cloud/serverless/containers/v1/container'
import {
  ContainerServiceService,
  CreateContainerRequest,
  DeployContainerRevisionRequest,
  ListContainersRequest,
  ListContainersResponse
} from '@nikolay.matrosov/yc-ts-sdk/lib/generated/yandex/cloud/serverless/containers/v1/container_service'
import {completion, getResponse} from '@nikolay.matrosov/yc-ts-sdk/lib/src/operation'
import {Client} from 'nice-grpc'
import {ContainerService} from '@nikolay.matrosov/yc-ts-sdk/lib/api/serverless/containers/v1'
import {Session} from '@nikolay.matrosov/yc-ts-sdk'
import {fromServiceAccountJsonFile} from '@nikolay.matrosov/yc-ts-sdk/lib/src/TokenService/iamTokenService'
import {parseMemory} from './memory'

async function findContainerByName(
  containerService: Client<typeof ContainerServiceService, {}>,
  folderId: string,
  containerName: string
): Promise<ListContainersResponse> {
  return await containerService.list(
    ListContainersRequest.fromPartial({
      pageSize: 100,
      folderId,
      filter: `name = "${containerName}"`
    })
  )
}

async function createContainer(
  session: Session,
  containerService: Client<typeof ContainerServiceService, {}>,
  folderId: string,
  containerName: string
): Promise<Container> {
  const repo = github.context.repo
  const containerCreateOperation = await containerService.create(
    CreateContainerRequest.fromPartial({
      folderId,
      name: containerName,
      description: `Created from: ${repo.owner}/${repo.repo}`
    })
  )
  const operation = await completion(containerCreateOperation, session)
  return getResponse(operation) as Container
}

async function createRevision(
  session: Session,
  containerService: Client<typeof ContainerServiceService, {}>,
  containerId: string,
  revisionInputs: IRevisionInputs
): Promise<Revision> {
  const revisionDeployOperation = await containerService.deployRevision(
    DeployContainerRevisionRequest.fromPartial({
      containerId,
      resources: {
        memory: revisionInputs.memory,
        cores: revisionInputs.cores,
        coreFraction: revisionInputs.coreFraction
      },
      executionTimeout: {seconds: revisionInputs.executionTimeout},
      serviceAccountId: revisionInputs.serviceAccountId,
      imageSpec: {
        imageUrl: revisionInputs.imageUrl,
        command: revisionInputs.command,
        args: revisionInputs.args,
        environment: revisionInputs.environment,
        workingDir: revisionInputs.workingDir
      },
      concurrency: revisionInputs.concurrency
    })
  )

  const operation = await completion(revisionDeployOperation, session)
  return getResponse(operation) as Revision
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
  command: {command: string[]} | undefined
  args: {args: string[]} | undefined
  environment: {[key: string]: string}
}

function parseRevisionInputs(): IRevisionInputs {
  const imageUrl: string = core.getInput('revision-image-url')
  const workingDir: string = core.getInput('revision-working-dir')
  const serviceAccountId: string = core.getInput('revision-service-account-id')
  const cores: number = parseInt(core.getInput('revision-cores') || '1', 10)
  const memory: number = parseMemory(core.getInput('revision-memory') || '128Mb')
  const coreFraction: number = parseInt(core.getInput('revision-core-fraction') || '100', 10)
  const concurrency: number = parseInt(core.getInput('revision-concurrency') || '1', 10)
  const executionTimeout: number = parseInt(core.getInput('revision-execution-timeout') || '3', 10)
  const commands: string[] = core.getMultilineInput('revision-commands')

  const command = commands.length ? {command: commands} : undefined
  const argList: string[] = core.getMultilineInput('revision-args')

  const args = argList.length ? {args: argList} : undefined
  const env: string[] = core.getMultilineInput('revision-env')
  const environment: {[key: string]: string} = {}
  for (const line of env) {
    const [key, value] = line.split('=')
    environment[key?.trim()] = value?.trim()
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
    environment
  }
}

async function run(): Promise<void> {
  try {
    core.info(`start`)
    const ycSaJsonCredentials = core.getInput('yc-sa-json-credentials', {
      required: true
    })

    const folderId: string = core.getInput('folder-id', {
      required: true
    })
    const containerName: string = core.getInput('container-name', {
      required: true
    })
    const revisionInputs = parseRevisionInputs()

    core.info(`Folder ID: ${folderId}, container name: ${containerName}`)

    const serviceAccountJson = fromServiceAccountJsonFile(JSON.parse(ycSaJsonCredentials))
    const session = new Session({serviceAccountJson})
    const containerService = ContainerService(session)

    const containersResponse = await findContainerByName(containerService, folderId, containerName)
    let containerId: string
    if (containersResponse.containers.length) {
      containerId = containersResponse.containers[0].id
      core.info(`Container with name: ${containerName} already exists and has id: ${containerId}`)
    } else {
      core.info(`There is no container with name: ${containerName}. Creating a new one.`)
      const resp = await createContainer(session, containerService, folderId, containerName)
      containerId = resp.id
      core.info(`Container successfully created. Id: ${containerId}`)
    }
    core.setOutput('id', containerId)

    core.info(`Creating new revision.`)
    const rev = await createRevision(session, containerService, containerId, revisionInputs)
    core.info(`Revision created. Id: ${rev.id}`)

    core.setOutput('rev', rev.id)
  } catch (error) {
    if (error instanceof Error) {
      core.error(error)
      core.setFailed(error.message)
    }
  }
}

run()
