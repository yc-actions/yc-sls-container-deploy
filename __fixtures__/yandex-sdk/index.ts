import { jest } from '@jest/globals'
import { errors, Session as SdkSession } from '@yandex-cloud/nodejs-sdk'
import { SessionConfig } from '@yandex-cloud/nodejs-sdk/dist/types'

// Real error classes - src/main.ts does `err instanceof errors.ApiError`.
export { errors }

// Typed with the real constructor signature so a test can hand `new Session({})`
// to code that takes a Session, while `Session.mock.calls` records the config.
export const Session = jest.fn<(config?: SessionConfig) => SdkSession>(
    () =>
        ({
            client: (service: new () => unknown) => new service()
        }) as unknown as SdkSession
)

// The fixtures return already-finished operations, so waiting is identity.
export const waitForOperation = jest.fn((op: unknown) => op)
