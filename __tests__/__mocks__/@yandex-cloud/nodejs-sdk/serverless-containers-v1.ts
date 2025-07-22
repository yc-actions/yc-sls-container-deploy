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
import { getOperation } from '../get-operation'

jest.disableAutomock()

let containers: Container[] = []
let revisions: Revision[] = []

export const ContainerServiceMock = {
    create: jest.fn().mockImplementation(async (req: CreateContainerRequest): Promise<Operation> => {
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
            createdAt: new Date(),
            name: 'containername',
            description: 'containerdescription',
            labels: {},
            status: 1,
            url: ''
        }
        containers = [Container.fromJSON(data)]
        return getOperation(Container, data, CreateContainerMetadata, { containerId: 'container-id' })
    }),
    list: jest.fn().mockImplementation(() => ({
        containers
    })),
    deployRevision: jest.fn().mockImplementation(async (req: DeployContainerRevisionRequest): Promise<Operation> => {
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
            createdAt: new Date(),
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
        revisions = [Revision.fromJSON(data)]
        return getOperation(Revision, data, DeployContainerRevisionMetadata, { revisionId: 'revision-id' })
    }),
    setAccessBindings: jest.fn()
}

export function __setContainerList(value: Container[]) {
    containers = value
}

export function __setRevisionList(value: Revision[]) {
    revisions = value
}

export const containerService = {
    ContainerServiceClient: jest.fn(() => ContainerServiceMock)
}
