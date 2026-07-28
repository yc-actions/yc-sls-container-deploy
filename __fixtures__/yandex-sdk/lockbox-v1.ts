import { jest } from '@jest/globals'
import { Secret } from '@yandex-cloud/nodejs-sdk/dist/generated/yandex/cloud/lockbox/v1/secret'
import { GetSecretRequest } from '@yandex-cloud/nodejs-sdk/dist/generated/yandex/cloud/lockbox/v1/secret_service'

let secrets: Secret[] = []
let getSecretFail = false

export const SecretServiceMock = {
    get: jest.fn(async (req: GetSecretRequest): Promise<Secret> => {
        if (getSecretFail) {
            throw new Error('Failed to get secret')
        }
        const secret = secrets.find(s => s.id === req.secretId)
        if (!secret) {
            throw new Error(`Secret not found: ${req.secretId}`)
        }
        return secret
    }),
    // The action filters by name client-side, so returning everything is enough.
    list: jest.fn(async (): Promise<{ secrets: Secret[]; nextPageToken: string }> => {
        return { secrets, nextPageToken: '' }
    })
}

export function __setSecretList(value: Secret[]): void {
    secrets = value
}

export function __setGetSecretFail(value: boolean): void {
    getSecretFail = value
}

export const secretService = {
    SecretServiceClient: jest.fn(() => SecretServiceMock)
}
