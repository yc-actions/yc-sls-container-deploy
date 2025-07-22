import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'
import { Session } from '@yandex-cloud/nodejs-sdk'
import { Secret } from '@yandex-cloud/nodejs-sdk/dist/generated/yandex/cloud/lockbox/v1/secret'
import { resolveLatestLockboxVersions, Secret as AppSecret, parseLockboxVariablesMapping, parseLockboxSecretDefinition } from '../src/main'
import { __setGetSecretFail, __setSecretList } from './__mocks__/@yandex-cloud/nodejs-sdk/lockbox-v1'

describe('resolveLatestLockboxVersions', () => {
    beforeEach(() => {
        __setGetSecretFail(false)
        __setSecretList([])
    })

    afterEach(() => {
        jest.clearAllMocks()
    })

    it('should resolve "latest" to a specific version ID', async () => {
        const secrets: AppSecret[] = [{ id: 'secret1', versionId: 'latest', key: 'key1', environmentVariable: 'ENV1' }]
        const lockboxSecrets: Secret[] = [
            {
                id: 'secret1',
                folderId: 'folder1',
                name: 'secret1',
                description: 'test secret',
                labels: {},
                status: 1,
                kmsKeyId: 'key1',
                deletionProtection: false,
                currentVersion: {
                    id: 'version123',
                    secretId: 'secret1',
                    description: 'current version',
                    status: 1,
                    payloadEntryKeys: []
                }
            }
        ]
        __setSecretList(lockboxSecrets)

        const session = new Session({})
        const resolved = await resolveLatestLockboxVersions(session, secrets)

        expect(resolved[0].versionId).toBe('version123')
    })

    it('should do nothing if no "latest" version is present', async () => {
        const secrets: AppSecret[] = [
            { id: 'secret1', versionId: 'version1', key: 'key1', environmentVariable: 'ENV1' }
        ]
        const session = new Session({})
        const resolved = await resolveLatestLockboxVersions(session, secrets)

        expect(resolved).toEqual(secrets)
    })

    it('should throw an error if a secret has no current version', async () => {
        const secrets: AppSecret[] = [{ id: 'secret1', versionId: 'latest', key: 'key1', environmentVariable: 'ENV1' }]
        const lockboxSecrets: Secret[] = [
            {
                id: 'secret1',
                folderId: 'folder1',
                name: 'secret1',
                description: 'test secret',
                labels: {},
                status: 1,
                kmsKeyId: 'key1',
                deletionProtection: false,
                currentVersion: undefined
            }
        ]
        __setSecretList(lockboxSecrets)

        const session = new Session({})
        await expect(resolveLatestLockboxVersions(session, secrets)).rejects.toThrow(
            'Secret secret1 has no current version'
        )
    })

    it('should handle a mix of "latest" and specific version IDs', async () => {
        const secrets: AppSecret[] = [
            { id: 'secret1', versionId: 'latest', key: 'key1', environmentVariable: 'ENV1' },
            { id: 'secret2', versionId: 'version2', key: 'key2', environmentVariable: 'ENV2' }
        ]
        const lockboxSecrets: Secret[] = [
            {
                id: 'secret1',
                folderId: 'folder1',
                name: 'secret1',
                description: 'test secret',
                labels: {},
                status: 1,
                kmsKeyId: 'key1',
                deletionProtection: false,
                currentVersion: {
                    id: 'version123',
                    secretId: 'secret1',
                    description: 'current version',
                    status: 1,
                    payloadEntryKeys: []
                }
            }
        ]
        __setSecretList(lockboxSecrets)

        const session = new Session({})
        const resolved = await resolveLatestLockboxVersions(session, secrets)

        expect(resolved.find(s => s.id === 'secret1')?.versionId).toBe('version123')
        expect(resolved.find(s => s.id === 'secret2')?.versionId).toBe('version2')
    })

    it('should handle multiple secrets with different versions including latest from same secret', async () => {
        const secrets: AppSecret[] = [
            { id: 'secret1', versionId: 'latest', key: 'DATABASE_URL', environmentVariable: 'DATABASE_URL' },
            { id: 'secret1', versionId: 'version2', key: 'API_KEY', environmentVariable: 'API_KEY' },
            { id: 'secret2', versionId: 'latest', key: 'REDIS_URL', environmentVariable: 'REDIS_URL' },
            { id: 'secret3', versionId: 'version5', key: 'JWT_SECRET', environmentVariable: 'JWT_SECRET' }
        ]
        
        // Set up multiple secrets in the mock
        const lockboxSecrets: Secret[] = [
            {
                id: 'secret1',
                folderId: 'folder1',
                name: 'secret1',
                description: 'test secret 1',
                labels: {},
                status: 1,
                kmsKeyId: 'key1',
                deletionProtection: false,
                currentVersion: {
                    id: 'version999',
                    secretId: 'secret1',
                    description: 'current version',
                    status: 1,
                    payloadEntryKeys: []
                }
            },
            {
                id: 'secret2',
                folderId: 'folder1',
                name: 'secret2',
                description: 'test secret 2',
                labels: {},
                status: 1,
                kmsKeyId: 'key2',
                deletionProtection: false,
                currentVersion: {
                    id: 'version888',
                    secretId: 'secret2',
                    description: 'current version',
                    status: 1,
                    payloadEntryKeys: []
                }
            }
        ]
        __setSecretList(lockboxSecrets)

        const session = new Session({})
        const resolved = await resolveLatestLockboxVersions(session, secrets)

        // Verify that "latest" versions were resolved to specific version IDs
        expect(resolved.find(s => s.id === 'secret1' && s.key === 'DATABASE_URL')?.versionId).toBe('version999')
        expect(resolved.find(s => s.id === 'secret1' && s.key === 'API_KEY')?.versionId).toBe('version2') // Should remain unchanged
        expect(resolved.find(s => s.id === 'secret2' && s.key === 'REDIS_URL')?.versionId).toBe('version888')
        expect(resolved.find(s => s.id === 'secret3' && s.key === 'JWT_SECRET')?.versionId).toBe('version5') // Should remain unchanged

        // Verify that all secrets are present with correct environment variables
        expect(resolved).toHaveLength(4)
        expect(resolved.find(s => s.environmentVariable === 'DATABASE_URL')).toBeDefined()
        expect(resolved.find(s => s.environmentVariable === 'API_KEY')).toBeDefined()
        expect(resolved.find(s => s.environmentVariable === 'REDIS_URL')).toBeDefined()
        expect(resolved.find(s => s.environmentVariable === 'JWT_SECRET')).toBeDefined()
    })

    it('should handle same key from latest and specific version mapped to different env vars', async () => {
        const secrets: AppSecret[] = [
            { id: 'secret1', versionId: 'latest', key: 'DATABASE_URL', environmentVariable: 'DATABASE_URL_LATEST' },
            { id: 'secret1', versionId: 'version2', key: 'DATABASE_URL', environmentVariable: 'DATABASE_URL_STABLE' },
            { id: 'secret2', versionId: 'latest', key: 'API_KEY', environmentVariable: 'API_KEY_LATEST' },
            { id: 'secret2', versionId: 'version5', key: 'API_KEY', environmentVariable: 'API_KEY_STABLE' }
        ]
        
        // Set up multiple secrets in the mock
        const lockboxSecrets: Secret[] = [
            {
                id: 'secret1',
                folderId: 'folder1',
                name: 'secret1',
                description: 'test secret 1',
                labels: {},
                status: 1,
                kmsKeyId: 'key1',
                deletionProtection: false,
                currentVersion: {
                    id: 'version999',
                    secretId: 'secret1',
                    description: 'current version',
                    status: 1,
                    payloadEntryKeys: []
                }
            },
            {
                id: 'secret2',
                folderId: 'folder1',
                name: 'secret2',
                description: 'test secret 2',
                labels: {},
                status: 1,
                kmsKeyId: 'key2',
                deletionProtection: false,
                currentVersion: {
                    id: 'version888',
                    secretId: 'secret2',
                    description: 'current version',
                    status: 1,
                    payloadEntryKeys: []
                }
            }
        ]
        __setSecretList(lockboxSecrets)

        const session = new Session({})
        const resolved = await resolveLatestLockboxVersions(session, secrets)

        // Verify that "latest" versions were resolved to specific version IDs
        expect(resolved.find(s => s.environmentVariable === 'DATABASE_URL_LATEST')?.versionId).toBe('version999')
        expect(resolved.find(s => s.environmentVariable === 'DATABASE_URL_STABLE')?.versionId).toBe('version2')
        expect(resolved.find(s => s.environmentVariable === 'API_KEY_LATEST')?.versionId).toBe('version888')
        expect(resolved.find(s => s.environmentVariable === 'API_KEY_STABLE')?.versionId).toBe('version5')

        // Verify that all secrets are present with correct environment variables
        expect(resolved).toHaveLength(4)
        expect(resolved.find(s => s.environmentVariable === 'DATABASE_URL_LATEST')).toBeDefined()
        expect(resolved.find(s => s.environmentVariable === 'DATABASE_URL_STABLE')).toBeDefined()
        expect(resolved.find(s => s.environmentVariable === 'API_KEY_LATEST')).toBeDefined()
        expect(resolved.find(s => s.environmentVariable === 'API_KEY_STABLE')).toBeDefined()

        // Verify that the same key is used but with different environment variables
        const databaseLatest = resolved.find(s => s.environmentVariable === 'DATABASE_URL_LATEST')
        const databaseStable = resolved.find(s => s.environmentVariable === 'DATABASE_URL_STABLE')
        expect(databaseLatest?.key).toBe('DATABASE_URL')
        expect(databaseStable?.key).toBe('DATABASE_URL')
        expect(databaseLatest?.id).toBe('secret1')
        expect(databaseStable?.id).toBe('secret1')

        const apiLatest = resolved.find(s => s.environmentVariable === 'API_KEY_LATEST')
        const apiStable = resolved.find(s => s.environmentVariable === 'API_KEY_STABLE')
        expect(apiLatest?.key).toBe('API_KEY')
        expect(apiStable?.key).toBe('API_KEY')
        expect(apiLatest?.id).toBe('secret2')
        expect(apiStable?.id).toBe('secret2')
    })

    it('should ignore # style comments and empty lines', () => {
        const input = [
            '# This is a comment',
            '',
            'ENV_VAR_1=id1/verId1/VAR_1',
            '  # Another comment with spaces',
            'ENV_VAR_2=id2/verId2/VAR_2',
            '  ',
            '# Comment at the end'
        ]
        const result = parseLockboxVariablesMapping(input)
        const expected: AppSecret[] = [
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

    it('should return null for comments and empty lines in parseLockboxSecretDefinition', () => {
        const { parseLockboxSecretDefinition } = require('../src/main')
        
        // Test empty lines and comments should return null
        expect(parseLockboxSecretDefinition('')).toBeNull()
        expect(parseLockboxSecretDefinition('  ')).toBeNull()
        expect(parseLockboxSecretDefinition('# This is a comment')).toBeNull()
        expect(parseLockboxSecretDefinition('  # Comment with spaces')).toBeNull()
        
        // Test valid line should return Secret object
        expect(parseLockboxSecretDefinition('ENV_VAR=id/version/key')).toEqual({
            environmentVariable: 'ENV_VAR',
            id: 'id',
            versionId: 'version',
            key: 'key'
        })
    })

    it('should handle comments in parseLockboxVariablesMapping', () => {
        const input = [
            '# Configuration for development environment',
            'DATABASE_URL=secret123/latest/DATABASE_URL',
            '',
            '# API keys for different services',
            'API_KEY=secret456/version2/API_KEY',
            '  # Redis connection',
            'REDIS_URL=secret789/latest/REDIS_URL',
            '',
            '# Comment at the end'
        ]
        const result = parseLockboxVariablesMapping(input)
        const expected: AppSecret[] = [
            {
                environmentVariable: 'DATABASE_URL',
                id: 'secret123',
                versionId: 'latest',
                key: 'DATABASE_URL'
            },
            {
                environmentVariable: 'API_KEY',
                id: 'secret456',
                versionId: 'version2',
                key: 'API_KEY'
            },
            {
                environmentVariable: 'REDIS_URL',
                id: 'secret789',
                versionId: 'latest',
                key: 'REDIS_URL'
            }
        ]
        expect(result).toEqual(expected)
    })

    it('should handle inline comments after valid secret mappings', () => {
        const input = [
            'DATABASE_URL=secret123/latest/DATABASE_URL # Latest database URL',
            'API_KEY=secret456/version2/API_KEY  # Stable API key',
            'REDIS_URL=secret789/latest/REDIS_URL#Redis connection',
            'JWT_SECRET=secret999/version5/JWT_SECRET  # JWT signing key'
        ]
        const result = parseLockboxVariablesMapping(input)
        const expected: AppSecret[] = [
            {
                environmentVariable: 'DATABASE_URL',
                id: 'secret123',
                versionId: 'latest',
                key: 'DATABASE_URL'
            },
            {
                environmentVariable: 'API_KEY',
                id: 'secret456',
                versionId: 'version2',
                key: 'API_KEY'
            },
            {
                environmentVariable: 'REDIS_URL',
                id: 'secret789',
                versionId: 'latest',
                key: 'REDIS_URL'
            },
            {
                environmentVariable: 'JWT_SECRET',
                id: 'secret999',
                versionId: 'version5',
                key: 'JWT_SECRET'
            }
        ]
        expect(result).toEqual(expected)
    })
})
