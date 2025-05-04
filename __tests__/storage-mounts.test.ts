import { expect, test } from '@jest/globals'
import { parseStorageMounts } from '../src/storage-mounts'

test('should return default value undefined when key is not set', () => {
    expect(parseStorageMounts([])).toBeUndefined()
})

test('should throw an error if s3Path is empty', () => {
    const inputLineWithEmptyS3Path = ':mountPath:ro'

    try {
        parseStorageMounts([inputLineWithEmptyS3Path])
    } catch (e: any) {
        expect(e.message).toEqual(
            `revision-storage-mounts: Line: '${inputLineWithEmptyS3Path}' has wrong format. Empty s3Path`
        )
    }
})

test('should throw an error if mountPointPath is empty', () => {
    const inputLineWithEmptyMountPointPath = 'bucketId/folderName::ro'

    try {
        parseStorageMounts([inputLineWithEmptyMountPointPath])
    } catch (e: any) {
        expect(e.message).toEqual(
            `revision-storage-mounts: Line: '${inputLineWithEmptyMountPointPath}' has wrong format. Empty mountPath`
        )
    }
})

test('should throw an error if accessMode is invalid', () => {
    const inputLineWithInvalidAccessMode = 'bucketId/folderName:mountPointPath:access-mode-invalid'

    try {
        parseStorageMounts([inputLineWithInvalidAccessMode])
    } catch (e: any) {
        expect(e.message).toEqual(
            `revision-storage-mounts: Line: '${inputLineWithInvalidAccessMode}' has wrong format. Invalid accessMode. Possible values: read-only, ro, readOnly, read_only, ReadOnly, read-write, rw, readWrite, read_write, ReadWrite`
        )
    }
})

test.each([
    {
        input: ['bucketId/folderName:mountPointPath:ro'],
        expectedOutput: [
            {
                bucketId: 'bucketId',
                prefix: 'folderName',
                mountPointPath: 'mountPointPath',
                readOnly: true
            }
        ]
    },
    {
        input: ['bucketId:mountPointPath:ro'],
        expectedOutput: [
            {
                bucketId: 'bucketId',
                prefix: '',
                mountPointPath: 'mountPointPath',
                readOnly: true
            }
        ]
    },
    {
        input: ['bucketId:mountPointPath'],
        expectedOutput: [
            {
                bucketId: 'bucketId',
                prefix: '',
                mountPointPath: 'mountPointPath',
                readOnly: true
            }
        ]
    },
    {
        input: ['bucketId:mountPointPath:rw'],
        expectedOutput: [
            {
                bucketId: 'bucketId',
                prefix: '',
                mountPointPath: 'mountPointPath',
                readOnly: false
            }
        ]
    },
    {
        input: [
            'bucketId:mountPointPath:ro',
            'bucketId/folderName/folderName/folderName:mountPointPath:ro',
            'bucketId:mountPointPath:rw'
        ],
        expectedOutput: [
            {
                bucketId: 'bucketId',
                prefix: '',
                mountPointPath: 'mountPointPath',
                readOnly: true
            },
            {
                bucketId: 'bucketId',
                prefix: 'folderName/folderName/folderName',
                mountPointPath: 'mountPointPath',
                readOnly: true
            },
            {
                bucketId: 'bucketId',
                prefix: '',
                mountPointPath: 'mountPointPath',
                readOnly: false
            }
        ]
    }
])('test parseStorageMounts with $input', ({ input, expectedOutput }) => {
    expect(parseStorageMounts(input)).toMatchObject(expectedOutput)
})
