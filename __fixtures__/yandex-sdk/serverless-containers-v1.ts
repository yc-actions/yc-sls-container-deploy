import { jest } from '@jest/globals'
import {
    Container,
    Revision
} from '@yandex-cloud/nodejs-sdk/dist/generated/yandex/cloud/serverless/containers/v1/container'
import {
    CreateContainerMetadata,
    CreateContainerRequest,
    DeployContainerRevisionMetadata,
    DeployContainerRevisionRequest
} from '@yandex-cloud/nodejs-sdk/dist/generated/yandex/cloud/serverless/containers/v1/container_service'
import { Operation } from '@yandex-cloud/nodejs-sdk/dist/generated/yandex/cloud/operation/operation'

import { getOperation } from '../get-operation.js'

// Recorded state. `revisions` is write-only today - the deploy mock records what it
// returned and the tests reset it between cases, but nothing reads it back - so it is
// kept as a field here rather than as a standalone binding.
const state: { containers: Container[]; revisions: Revision[] } = { containers: [], revisions: [] }

export const ContainerServiceMock = {
    create: jest.fn(async (req: CreateContainerRequest): Promise<Operation> => {
        if (req.name === 'fail') {
            return Operation.fromJSON({
                id: 'operationid',
                error: {},
                done: true
            })
        }
        const data: Container = {
            id: 'container-id',
            folderId: 'folderid',
            createdAt: new Date(0),
            name: 'containername',
            description: 'containerdescription',
            labels: {},
            status: 1,
            url: ''
        }
        state.containers = [Container.fromJSON(data)]
        return getOperation(Container, data, CreateContainerMetadata, { containerId: 'container-id' })
    }),
    list: jest.fn(() => ({ containers: state.containers })),
    deployRevision: jest.fn(async (req: DeployContainerRevisionRequest): Promise<Operation> => {
        if (req.description === 'fail') {
            return Operation.fromJSON({
                id: 'operationid',
                error: {},
                done: true
            })
        }
        const data: Revision = {
            id: 'revision-id',
            containerId: 'container-id',
            createdAt: new Date(0),
            description: 'revisiondescription',
            status: 1,
            image: undefined,
            resources: undefined,
            executionTimeout: undefined,
            serviceAccountId: '',
            concurrency: 0,
            secrets: [],
            logOptions: undefined,
            storageMounts: [],
            mounts: []
        }
        state.revisions = [Revision.fromJSON(data)]
        return getOperation(Revision, data, DeployContainerRevisionMetadata, { revisionId: 'revision-id' })
    }),
    setAccessBindings: jest.fn()
}

export function __setContainerList(value: Container[]): void {
    state.containers = value
}

export function __setRevisionList(value: Revision[]): void {
    state.revisions = value
}

export const containerService = {
    ContainerServiceClient: jest.fn(() => ContainerServiceMock)
}
