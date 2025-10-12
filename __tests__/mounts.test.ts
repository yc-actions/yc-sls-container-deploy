import { expect, test } from '@jest/globals'
import { parseMounts } from '../src/mounts'
import { Mount_Mode } from '@yandex-cloud/nodejs-sdk/dist/generated/yandex/cloud/serverless/containers/v1/container'

test('should return undefined when no mounts are provided', () => {
    expect(parseMounts([], [])).toBeUndefined()
})

// Storage mount tests
test('should throw an error if storage mount s3Path is empty', () => {
    const inputLineWithEmptyS3Path = ':mountPath:ro'

    try {
        parseMounts([], [inputLineWithEmptyS3Path])
    } catch (e: any) {
        expect(e.message).toEqual(
            `revision-storage-mounts: Line: '${inputLineWithEmptyS3Path}' has wrong format. Empty s3Path`
        )
    }
})

test('should throw an error if storage mount mountPointPath is empty', () => {
    const inputLineWithEmptyMountPointPath = 'bucketId/folderName::ro'

    try {
        parseMounts([], [inputLineWithEmptyMountPointPath])
    } catch (e: any) {
        expect(e.message).toEqual(
            `revision-storage-mounts: Line: '${inputLineWithEmptyMountPointPath}' has wrong format. Empty mountPath`
        )
    }
})

test('should throw an error if storage mount accessMode is invalid', () => {
    const inputLineWithInvalidAccessMode = 'bucketId/folderName:mountPointPath:access-mode-invalid'

    try {
        parseMounts([], [inputLineWithInvalidAccessMode])
    } catch (e: any) {
        expect(e.message).toEqual(
            `revision-storage-mounts: Line: '${inputLineWithInvalidAccessMode}' has wrong format. Invalid accessMode. Possible values: read-only, ro, readOnly, read_only, ReadOnly, read-write, rw, readWrite, read_write, ReadWrite`
        )
    }
})

// Ephemeral mount tests
test('should throw an error if ephemeral mount path is empty', () => {
    const inputLineWithEmptyPath = ':512Mb:rw'

    try {
        parseMounts([inputLineWithEmptyPath], [])
    } catch (e: any) {
        expect(e.message).toEqual(
            `revision-ephemeral-mounts: Line: '${inputLineWithEmptyPath}' has wrong format. Empty mount path`
        )
    }
})

test('should throw an error if ephemeral mount size is empty', () => {
    const inputLineWithEmptySize = '/mnt/data::rw'

    try {
        parseMounts([inputLineWithEmptySize], [])
    } catch (e: any) {
        expect(e.message).toEqual(
            `revision-ephemeral-mounts: Line: '${inputLineWithEmptySize}' has wrong format. Empty size`
        )
    }
})

test('should throw an error if ephemeral mount accessMode is invalid', () => {
    const inputLineWithInvalidAccessMode = '/mnt/data:512Mb:invalid-mode'

    try {
        parseMounts([inputLineWithInvalidAccessMode], [])
    } catch (e: any) {
        expect(e.message).toEqual(
            `revision-ephemeral-mounts: Line: '${inputLineWithInvalidAccessMode}' has wrong format. Invalid accessMode. Possible values: read-only, ro, readOnly, read_only, ReadOnly, read-write, rw, readWrite, read_write, ReadWrite`
        )
    }
})

// Storage mount parsing tests
test.each([
    {
        description: 'storage mount with prefix and read-only',
        ephemeralInput: [],
        storageInput: ['bucketId/folderName:mountPointPath:ro'],
        expectedOutput: [
            {
                mountPointPath: 'mountPointPath',
                mode: Mount_Mode.READ_ONLY,
                objectStorage: {
                    bucketId: 'bucketId',
                    prefix: 'folderName'
                }
            }
        ]
    },
    {
        description: 'storage mount without prefix and read-only',
        ephemeralInput: [],
        storageInput: ['bucketId:mountPointPath:ro'],
        expectedOutput: [
            {
                mountPointPath: 'mountPointPath',
                mode: Mount_Mode.READ_ONLY,
                objectStorage: {
                    bucketId: 'bucketId',
                    prefix: ''
                }
            }
        ]
    },
    {
        description: 'storage mount without access mode (defaults to read-only)',
        ephemeralInput: [],
        storageInput: ['bucketId:mountPointPath'],
        expectedOutput: [
            {
                mountPointPath: 'mountPointPath',
                mode: Mount_Mode.READ_ONLY,
                objectStorage: {
                    bucketId: 'bucketId',
                    prefix: ''
                }
            }
        ]
    },
    {
        description: 'storage mount with read-write',
        ephemeralInput: [],
        storageInput: ['bucketId:mountPointPath:rw'],
        expectedOutput: [
            {
                mountPointPath: 'mountPointPath',
                mode: Mount_Mode.READ_WRITE,
                objectStorage: {
                    bucketId: 'bucketId',
                    prefix: ''
                }
            }
        ]
    },
    {
        description: 'multiple storage mounts',
        ephemeralInput: [],
        storageInput: [
            'bucketId:mountPointPath:ro',
            'bucketId/folderName/folderName/folderName:mountPointPath:ro',
            'bucketId:mountPointPath:rw'
        ],
        expectedOutput: [
            {
                mountPointPath: 'mountPointPath',
                mode: Mount_Mode.READ_ONLY,
                objectStorage: {
                    bucketId: 'bucketId',
                    prefix: ''
                }
            },
            {
                mountPointPath: 'mountPointPath',
                mode: Mount_Mode.READ_ONLY,
                objectStorage: {
                    bucketId: 'bucketId',
                    prefix: 'folderName/folderName/folderName'
                }
            },
            {
                mountPointPath: 'mountPointPath',
                mode: Mount_Mode.READ_WRITE,
                objectStorage: {
                    bucketId: 'bucketId',
                    prefix: ''
                }
            }
        ]
    }
])('test storage mounts: $description', ({ ephemeralInput, storageInput, expectedOutput }) => {
    expect(parseMounts(ephemeralInput, storageInput)).toMatchObject(expectedOutput)
})

// Ephemeral mount parsing tests
test.each([
    {
        description: 'ephemeral mount with default read-write access',
        ephemeralInput: ['/mnt/data:512Mb'],
        storageInput: [],
        expectedOutput: [
            {
                mountPointPath: '/mnt/data',
                mode: Mount_Mode.READ_WRITE,
                ephemeralDiskSpec: {
                    size: 536870912 // 512MB in bytes
                }
            }
        ]
    },
    {
        description: 'ephemeral mount with explicit read-write',
        ephemeralInput: ['/mnt/data:1Gb:rw'],
        storageInput: [],
        expectedOutput: [
            {
                mountPointPath: '/mnt/data',
                mode: Mount_Mode.READ_WRITE,
                ephemeralDiskSpec: {
                    size: 1073741824 // 1GB in bytes
                }
            }
        ]
    },
    {
        description: 'ephemeral mount with read-only',
        ephemeralInput: ['/mnt/data:2Gb:ro'],
        storageInput: [],
        expectedOutput: [
            {
                mountPointPath: '/mnt/data',
                mode: Mount_Mode.READ_ONLY,
                ephemeralDiskSpec: {
                    size: 2147483648 // 2GB in bytes
                }
            }
        ]
    },
    {
        description: 'multiple ephemeral mounts',
        ephemeralInput: ['/mnt/data1:512Mb:rw', '/mnt/data2:1Gb:ro', '/mnt/data3:256Mb'],
        storageInput: [],
        expectedOutput: [
            {
                mountPointPath: '/mnt/data1',
                mode: Mount_Mode.READ_WRITE,
                ephemeralDiskSpec: {
                    size: 536870912
                }
            },
            {
                mountPointPath: '/mnt/data2',
                mode: Mount_Mode.READ_ONLY,
                ephemeralDiskSpec: {
                    size: 1073741824
                }
            },
            {
                mountPointPath: '/mnt/data3',
                mode: Mount_Mode.READ_WRITE,
                ephemeralDiskSpec: {
                    size: 268435456
                }
            }
        ]
    }
])('test ephemeral mounts: $description', ({ ephemeralInput, storageInput, expectedOutput }) => {
    expect(parseMounts(ephemeralInput, storageInput)).toMatchObject(expectedOutput)
})

// Combined mount tests
test.each([
    {
        description: 'both ephemeral and storage mounts',
        ephemeralInput: ['/mnt/ephemeral:512Mb:rw'],
        storageInput: ['bucketId/prefix:/mnt/storage:ro'],
        expectedOutput: [
            {
                mountPointPath: '/mnt/ephemeral',
                mode: Mount_Mode.READ_WRITE,
                ephemeralDiskSpec: {
                    size: 536870912
                }
            },
            {
                mountPointPath: '/mnt/storage',
                mode: Mount_Mode.READ_ONLY,
                objectStorage: {
                    bucketId: 'bucketId',
                    prefix: 'prefix'
                }
            }
        ]
    },
    {
        description: 'multiple of both types',
        ephemeralInput: ['/mnt/eph1:1Gb', '/mnt/eph2:2Gb:ro'],
        storageInput: ['bucket1:/mnt/s3-1', 'bucket2/path:/mnt/s3-2:rw'],
        expectedOutput: [
            {
                mountPointPath: '/mnt/eph1',
                mode: Mount_Mode.READ_WRITE,
                ephemeralDiskSpec: {
                    size: 1073741824
                }
            },
            {
                mountPointPath: '/mnt/eph2',
                mode: Mount_Mode.READ_ONLY,
                ephemeralDiskSpec: {
                    size: 2147483648
                }
            },
            {
                mountPointPath: '/mnt/s3-1',
                mode: Mount_Mode.READ_ONLY,
                objectStorage: {
                    bucketId: 'bucket1',
                    prefix: ''
                }
            },
            {
                mountPointPath: '/mnt/s3-2',
                mode: Mount_Mode.READ_WRITE,
                objectStorage: {
                    bucketId: 'bucket2',
                    prefix: 'path'
                }
            }
        ]
    }
])('test combined mounts: $description', ({ ephemeralInput, storageInput, expectedOutput }) => {
    expect(parseMounts(ephemeralInput, storageInput)).toMatchObject(expectedOutput)
})
