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
    })
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
