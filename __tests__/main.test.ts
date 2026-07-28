import { afterEach, beforeEach, describe, expect, it, jest, test } from '@jest/globals'

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
import { __setGetSecretFail, __setSecretList, secretService } from '../__fixtures__/yandex-sdk/lockbox-v1.js'
// Type-only: erased at compile time, so it does not load src/parse/ before the mocks below.
import type { Secret } from '../src/parse/index.js'

jest.unstable_mockModule('@actions/core', () => core)
jest.unstable_mockModule('@actions/github', () => github)
jest.unstable_mockModule('axios', () => axios)
jest.unstable_mockModule('@yandex-cloud/nodejs-sdk', () => sdk)
jest.unstable_mockModule('@yandex-cloud/nodejs-sdk/serverless-containers-v1', () => ({ containerService }))
jest.unstable_mockModule('@yandex-cloud/nodejs-sdk/lockbox-v1', () => ({ secretService }))

// Imported dynamically, after the mock registrations above. A static import would be linked
// before them, binding src/parse/lockbox-variables.ts to the real @actions/core and leaving two
// instances of that module in this file - the real `info` would then swallow the calls the mock
// is supposed to record.
const { parseEnvironment, parseLockboxVariablesMapping } = await import('../src/parse/index.js')
const { run } = await import('../src/main.js')

beforeEach(() => {
    jest.clearAllMocks()
    setupMockInputs(defaultValues)
})

afterEach(() => {
    __setContainerList([])
    __setRevisionList([])
    __setSecretList([])
    __setGetSecretFail(false)
})

describe('lockbox', () => {
    test('it should return right lockbox secrets', () => {
        const input = ['ENV_VAR_1=id1/verId1/VAR_1', 'ENV_VAR_2=id2/verId2/VAR_2']
        const result = parseLockboxVariablesMapping(input)
        const expected: Secret[] = [
            {
                environmentVariable: 'ENV_VAR_1',
                id: 'id1',
                versionId: 'verId1',
                key: 'VAR_1'
            },
            {
                environmentVariable: 'ENV_VAR_2',
                id: 'id2',
                versionId: 'verId2',
                key: 'VAR_2'
            }
        ]
        expect(result).toEqual(expected)
    })

    test.each([['123412343'], ['123=id'], ['123=id/verId'], ['123=id/verId/']])(
        'it should throw error when bad input provided',
        input => {
            expect(() => parseLockboxVariablesMapping([input])).toThrow()
        }
    )
})

describe('environment', () => {
    test('it should parse envs with multiple =', () => {
        const input = [
            'DATABASE_URL=postgresql://user:password@host:port/db?sslmode=verify-full&target_session_attrs=read-write',
            'GOOGLE_CLIENT_ID=id.apps.googleusercontent.com'
        ]
        const result = parseEnvironment(input)
        const expected: { [key: string]: string } = {
            DATABASE_URL: 'postgresql://user:password@host:port/db?sslmode=verify-full&target_session_attrs=read-write',
            GOOGLE_CLIENT_ID: 'id.apps.googleusercontent.com'
        }
        expect(result).toEqual(expected)
    })
})

// Helper to set up mock inputs
const defaultValues: Record<string, string> = {
    'yc-sa-json-credentials':
        '{"id":"id","created_at":"2023-01-01T00:00:00Z","key_algorithm":"RSA_2048","service_account_id":"said","private_key":"priv","public_key":"pub"}',
    'yc-iam-token': '',
    'yc-sa-id': '',
    'folder-id': 'folder123',
    'container-name': 'container123',
    'revision-cores': '2',
    'revision-memory': '128Mb',
    'revision-core-fraction': '100',
    'revision-concurrency': '1',
    'revision-provisioned': '',
    'revision-execution-timeout': '3',
    'revision-network-id': '',
    'revision-working-dir': '/app',
    'revision-image-url': 'image:tag',
    'revision-service-account-id': 'said',
    'revision-log-options-disabled': 'false',
    'revision-log-options-log-group-id': '',
    'revision-log-options-folder-id': '',
    'revision-log-options-min-level': 'INFO',
    'revision-runtime': 'http',
    'revision-zone-instances-limit': '',
    'revision-zone-requests-limit': '',
    public: ''
}

function setupMockInputs(values: Record<string, string>) {
    core.getInput.mockImplementation((name: string) => values[name] || '')
    core.getBooleanInput.mockImplementation((name: string) => values[name] === 'true')
    core.getMultilineInput.mockImplementation((name: string) => (values[name] ? values[name].split('\n') : []))
}

describe('main run function', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('should run with all inputs', async () => {
        setupMockInputs(defaultValues)
        await run()
        expect(core.setOutput).toHaveBeenCalledWith('id', 'container-id')
        expect(core.setOutput).toHaveBeenCalledWith('rev', 'revision-id')
        expect(core.setFailed).not.toHaveBeenCalled()
    })

    it('should skip container creation if it already exists', async () => {
        setupMockInputs(defaultValues)
        // Patch the containerServiceMock to return a container
        const containerObj = {
            id: 'container-id',
            folderId: 'folderid',
            name: 'containername',
            description: 'containerdescription',
            labels: {},
            url: '',
            status: 1
        }
        __setContainerList([containerObj])
        await run()
        expect(core.setOutput).toHaveBeenCalledWith('id', 'container-id')
        expect(core.setOutput).toHaveBeenCalledWith('rev', 'revision-id')
        expect(core.setFailed).not.toHaveBeenCalled()
        // Should not call create
        expect(ContainerServiceMock.create).not.toHaveBeenCalled()
    })

    it('should make container public if public input is set', async () => {
        setupMockInputs({ ...defaultValues, public: 'true' })
        await run()
        expect(ContainerServiceMock.setAccessBindings).toHaveBeenCalled()
        expect(core.setOutput).toHaveBeenCalledWith('id', 'container-id')
        expect(core.setOutput).toHaveBeenCalledWith('rev', 'revision-id')
        expect(core.setFailed).not.toHaveBeenCalled()
    })

    it('should call setFailed on error', async () => {
        setupMockInputs({ ...defaultValues, 'container-name': 'fail' })
        await run()
        expect(core.setFailed).toHaveBeenCalled()
    })

    it('should use IAM token if provided', async () => {
        setupMockInputs({ ...defaultValues, 'yc-sa-json-credentials': '', 'yc-iam-token': 'iam-token' })
        await run()
        expect(core.setOutput).toHaveBeenCalledWith('id', 'container-id')
        expect(core.setOutput).toHaveBeenCalledWith('rev', 'revision-id')
        expect(core.setFailed).not.toHaveBeenCalled()
    })

    it('should create task revision if runtime is task', async () => {
        setupMockInputs({ ...defaultValues, 'revision-runtime': 'task' })
        await run()
        expect(ContainerServiceMock.deployRevision).toHaveBeenCalledWith(
            expect.objectContaining({
                runtime: { task: {} }
            })
        )
        expect(core.setOutput).toHaveBeenCalledWith('id', 'container-id')
        expect(core.setOutput).toHaveBeenCalledWith('rev', 'revision-id')
        expect(core.setFailed).not.toHaveBeenCalled()
    })

    it('should handle runtime parameter case-insensitively', async () => {
        setupMockInputs({ ...defaultValues, 'revision-runtime': 'HTTP' })
        await run()
        expect(ContainerServiceMock.deployRevision).toHaveBeenCalledWith(
            expect.objectContaining({
                runtime: { http: {} }
            })
        )
        expect(core.setOutput).toHaveBeenCalledWith('id', 'container-id')
        expect(core.setOutput).toHaveBeenCalledWith('rev', 'revision-id')
        expect(core.setFailed).not.toHaveBeenCalled()
    })

    it('should pass scalingPolicy with both zone limits when provided', async () => {
        setupMockInputs({
            ...defaultValues,
            'revision-zone-instances-limit': '5',
            'revision-zone-requests-limit': '100'
        })
        await run()
        expect(ContainerServiceMock.deployRevision).toHaveBeenCalledWith(
            expect.objectContaining({
                scalingPolicy: {
                    zoneInstancesLimit: 5,
                    zoneRequestsLimit: 100
                }
            })
        )
        expect(core.setOutput).toHaveBeenCalledWith('id', 'container-id')
        expect(core.setOutput).toHaveBeenCalledWith('rev', 'revision-id')
        expect(core.setFailed).not.toHaveBeenCalled()
    })

    it('should pass scalingPolicy with only zoneInstancesLimit when provided', async () => {
        setupMockInputs({
            ...defaultValues,
            'revision-zone-instances-limit': '10'
        })
        await run()
        expect(ContainerServiceMock.deployRevision).toHaveBeenCalledWith(
            expect.objectContaining({
                scalingPolicy: expect.objectContaining({
                    zoneInstancesLimit: 10
                })
            })
        )
        expect(core.setOutput).toHaveBeenCalledWith('id', 'container-id')
        expect(core.setOutput).toHaveBeenCalledWith('rev', 'revision-id')
        expect(core.setFailed).not.toHaveBeenCalled()
    })

    it('should pass scalingPolicy with only zoneRequestsLimit when provided', async () => {
        setupMockInputs({
            ...defaultValues,
            'revision-zone-requests-limit': '50'
        })
        await run()
        expect(ContainerServiceMock.deployRevision).toHaveBeenCalledWith(
            expect.objectContaining({
                scalingPolicy: expect.objectContaining({
                    zoneRequestsLimit: 50
                })
            })
        )
        expect(core.setOutput).toHaveBeenCalledWith('id', 'container-id')
        expect(core.setOutput).toHaveBeenCalledWith('rev', 'revision-id')
        expect(core.setFailed).not.toHaveBeenCalled()
    })

    it('should not pass scalingPolicy when no zone limits are provided', async () => {
        setupMockInputs(defaultValues)
        await run()
        expect(ContainerServiceMock.deployRevision).toHaveBeenCalledWith(
            expect.not.objectContaining({
                scalingPolicy: expect.anything()
            })
        )
        expect(core.setOutput).toHaveBeenCalledWith('id', 'container-id')
        expect(core.setOutput).toHaveBeenCalledWith('rev', 'revision-id')
        expect(core.setFailed).not.toHaveBeenCalled()
    })

    it('should handle zone limits with value 0', async () => {
        setupMockInputs({
            ...defaultValues,
            'revision-zone-instances-limit': '0',
            'revision-zone-requests-limit': '0'
        })
        await run()
        expect(ContainerServiceMock.deployRevision).toHaveBeenCalledWith(
            expect.objectContaining({
                scalingPolicy: {
                    zoneInstancesLimit: 0,
                    zoneRequestsLimit: 0
                }
            })
        )
        expect(core.setOutput).toHaveBeenCalledWith('id', 'container-id')
        expect(core.setOutput).toHaveBeenCalledWith('rev', 'revision-id')
        expect(core.setFailed).not.toHaveBeenCalled()
    })
})
