import { jest } from '@jest/globals'
import { Secret } from '@yandex-cloud/nodejs-sdk/dist/generated/yandex/cloud/lockbox/v1/secret'
import { GetSecretRequest } from '@yandex-cloud/nodejs-sdk/dist/generated/yandex/cloud/lockbox/v1/secret_service'

let secrets: Secret[] = []
let getSecretFail = false

export const SecretServiceMock = {
    get: jest.fn().mockImplementation(async (req: GetSecretRequest): Promise<Secret> => {
        if (getSecretFail) {
            return Promise.reject(new Error('Failed to get secret'))
        }
        const secret = secrets.find(s => s.id === req.secretId)

        if (!secret) {
            return Promise.reject(new Error(`Secret not found: ${req.secretId}`))
        }
        return secret
    }),
    list: jest
        .fn()
        .mockImplementation(
            async (req: {
                folderId: string
                pageSize?: number
                pageToken?: string
            }): Promise<{ secrets: Secret[]; nextPageToken: string }> => {
                // Since we don't support filter in parameters anymore passing all is enough for tests as we filter in main.ts
                // But for test "should resolve ... by secret name" we need to return the secrets that include the one with the name
                // In the test setup __setSecretList sets the secrets
                return { secrets, nextPageToken: '' }
            }
        )
}

export function __setSecretList(value: Secret[]) {
    secrets = value
}

export function __setGetSecretFail(value: boolean) {
    getSecretFail = value
}

export const secretService = {
    SecretServiceClient: jest.fn(() => SecretServiceMock)
}
