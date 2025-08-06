import { Operation } from '@yandex-cloud/nodejs-sdk/dist/generated/yandex/cloud/operation/operation'
import { __setRevisionList, __setContainerList, ContainerServiceMock } from './nodejs-sdk/serverless-containers-v1'
import { __setServiceAccountList, ServiceAccountServiceMock } from './nodejs-sdk/iam-v1'
import { __setSecretList, __setGetSecretFail, SecretServiceMock } from './nodejs-sdk/lockbox-v1'

export { errors } from '@yandex-cloud/nodejs-sdk'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sdk: any = jest.createMockFromModule('@yandex-cloud/nodejs-sdk')

export const Session = jest.fn().mockImplementation(() => ({
    client: (service: any) => {
        if (service.name === 'SecretServiceClient') {
            return SecretServiceMock
        }
        return new service()
    }
}))

export const waitForOperation = jest.fn().mockImplementation((op: Operation) => op)

sdk.__setRevisionList = __setRevisionList
sdk.__setContainerList = __setContainerList
sdk.__setServiceAccountList = __setServiceAccountList
sdk.__setSecretList = __setSecretList
sdk.__setGetSecretFail = __setGetSecretFail
sdk.__getMocks = () => {
    return {
        ContainerServiceMock,
        ServiceAccountServiceMock,
        SecretServiceMock
    }
}

export default sdk
