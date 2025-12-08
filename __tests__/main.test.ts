import { afterEach, beforeEach, describe, expect, it, jest, test } from '@jest/globals'
import { parseEnvironment, parseLockboxVariablesMapping, run, Secret } from '../src/main'
// eslint-disable-next-line import/no-namespace
import * as core from '@actions/core'
import { context } from '@actions/github'
import { SpiedFunction } from 'jest-mock'
import {
    __setContainerList,
    __setRevisionList,
    ContainerServiceMock
} from './__mocks__/@yandex-cloud/nodejs-sdk/serverless-containers-v1'

let setOutputMock: SpiedFunction<(name: string, value: string) => void>
let setFailedMock: SpiedFunction<(message: string | Error) => void>
let getInputMock: SpiedFunction<(name: string, options?: { required?: boolean; trimWhitespace?: boolean }) => string>
let getBooleanInputMock: SpiedFunction<
    (name: string, options?: { required?: boolean; trimWhitespace?: boolean }) => boolean
>
let getMultilineInputMock: SpiedFunction<
    (name: string, options?: { required?: boolean; trimWhitespace?: boolean }) => string[]
>
let infoMock: SpiedFunction<(message: string) => void>
let errorMock: SpiedFunction<(message: string | Error) => void>
let repoMock: SpiedFunction<() => { owner: string; repo: string }>

beforeEach(() => {
    jest.clearAllMocks()
    setOutputMock = jest.spyOn(core, 'setOutput').mockImplementation(() => {})
    setFailedMock = jest.spyOn(core, 'setFailed').mockImplementation(() => {})
    getInputMock = jest.spyOn(core, 'getInput').mockImplementation((name: string) => defaultValues[name] || '')
    getBooleanInputMock = jest.spyOn(core, 'getBooleanInput').mockImplementation(() => false)
    getMultilineInputMock = jest.spyOn(core, 'getMultilineInput').mockImplementation(() => [])
    infoMock = jest.spyOn(core, 'info').mockImplementation(() => {})
    errorMock = jest.spyOn(core, 'error').mockImplementation(() => {})
    repoMock = jest.spyOn(context, 'repo', 'get').mockReturnValue({ owner: 'owner', repo: 'repo' })
})

afterEach(() => {
    __setContainerList([])
    __setRevisionList([])
    setOutputMock.mockClear()
    setFailedMock.mockClear()
    getInputMock.mockClear()
    getBooleanInputMock.mockClear()
    getMultilineInputMock.mockClear()
    infoMock.mockClear()
    errorMock.mockClear()
    repoMock.mockClear()
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
    public: ''
}

function setupMockInputs(values: Record<string, string>) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getInput } = require('@actions/core')
    getInput.mockImplementation((name: string) => values[name] || '')
}

describe('main run function', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('should run with all inputs', async () => {
        setupMockInputs(defaultValues)
        await run()
        expect(setOutputMock).toHaveBeenCalledWith('id', 'container-id')
        expect(setOutputMock).toHaveBeenCalledWith('rev', 'revision-id')
        expect(setFailedMock).not.toHaveBeenCalled()
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
        expect(setOutputMock).toHaveBeenCalledWith('id', 'container-id')
        expect(setOutputMock).toHaveBeenCalledWith('rev', 'revision-id')
        expect(setFailedMock).not.toHaveBeenCalled()
        // Should not call create
        expect(ContainerServiceMock.create).not.toHaveBeenCalled()
    })

    it('should make container public if public input is set', async () => {
        setupMockInputs({ ...defaultValues, public: 'true' })
        await run()
        expect(ContainerServiceMock.setAccessBindings).toHaveBeenCalled()
        expect(setOutputMock).toHaveBeenCalledWith('id', 'container-id')
        expect(setOutputMock).toHaveBeenCalledWith('rev', 'revision-id')
        expect(setFailedMock).not.toHaveBeenCalled()
    })

    it('should call setFailed on error', async () => {
        setupMockInputs({ ...defaultValues, 'container-name': 'fail' })
        await run()
        expect(setFailedMock).toHaveBeenCalled()
    })

    it('should use IAM token if provided', async () => {
        setupMockInputs({ ...defaultValues, 'yc-sa-json-credentials': '', 'yc-iam-token': 'iam-token' })
        await run()
        expect(setOutputMock).toHaveBeenCalledWith('id', 'container-id')
        expect(setOutputMock).toHaveBeenCalledWith('rev', 'revision-id')
        expect(setFailedMock).not.toHaveBeenCalled()
    })

    it('should create task revision if runtime is task', async () => {
        setupMockInputs({ ...defaultValues, 'revision-runtime': 'task' })
        await run()
        expect(ContainerServiceMock.deployRevision).toHaveBeenCalledWith(
            expect.objectContaining({
                runtime: { task: {} }
            })
        )
        expect(setOutputMock).toHaveBeenCalledWith('id', 'container-id')
        expect(setOutputMock).toHaveBeenCalledWith('rev', 'revision-id')
        expect(setFailedMock).not.toHaveBeenCalled()
    })
})
