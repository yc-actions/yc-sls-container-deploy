/**
 * Container lookup and creation.
 *
 * @module
 */

import { error, info, setOutput } from '@actions/core'
import { context } from '@actions/github'
import { Session, waitForOperation } from '@yandex-cloud/nodejs-sdk'
import { containerService } from '@yandex-cloud/nodejs-sdk/serverless-containers-v1'
import { Container } from '@yandex-cloud/nodejs-sdk/dist/generated/yandex/cloud/serverless/containers/v1/container'
import {
    CreateContainerRequest,
    ListContainersRequest,
    ListContainersResponse
} from '@yandex-cloud/nodejs-sdk/dist/generated/yandex/cloud/serverless/containers/v1/container_service'

import { ActionInputs } from '../action-inputs.js'

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

/**
 * Finds the container by name in the folder, creating it if absent.
 *
 * Sets the `id` action output either way.
 *
 * @param session - Authenticated Yandex Cloud SDK session
 * @param inputs - Action inputs providing folderId and containerName
 * @returns Container ID, existing or newly created
 * @throws {Error} If creation fails
 */
export const getOrCreateContainerId = async (
    session: Session,
    { folderId, containerName }: ActionInputs
): Promise<string> => {
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
    return containerId
}
