import {expect, test} from '@jest/globals';
import {parseStorageMounts} from '../src/storage-mounts'

test('should return default value undefined when key is not set', () => {
  expect(parseStorageMounts([])).toBeUndefined()
});

test('should throw an error if bucketId is empty', () => {
	const inputLineWithEmptyBucketId = ':prefix:mountPointPath:read-only'

  try {
		parseStorageMounts([inputLineWithEmptyBucketId])
  } catch (e: any) {
    expect(e.message).toEqual(`revision-storage-mounts: Line: '${inputLineWithEmptyBucketId}' has wrong format. Empty bucketId`);
  }
});

test('should throw an error if mountPointPath is empty', () => {
	const inputLineWithEmptyMountPointPath = 'bucketId:prefix::read-only'

  try {
		parseStorageMounts([inputLineWithEmptyMountPointPath])
  } catch (e: any) {
    expect(e.message).toEqual(`revision-storage-mounts: Line: '${inputLineWithEmptyMountPointPath}' has wrong format. Empty mountPointPath`);
  }
});

test('should throw an error if accessMode is invalid', () => {
	const inputLineWithInvalidAccessMode = 'bucketId:prefix:mountPointPath:access-mode-invalid'

  try {
		parseStorageMounts([inputLineWithInvalidAccessMode])
  } catch (e: any) {
    expect(e.message).toEqual(`revision-storage-mounts: Line: '${inputLineWithInvalidAccessMode}' has wrong format. Invalid accessMode. Possible values: read-only, read-write`);
  }
});

test.each([
	{
		input: [
			"bucketId:prefix:mountPointPath:read-only"
		],
		expectedOutput: [
			{
				bucketId: 'bucketId',
				prefix: 'prefix',
				mountPointPath: 'mountPointPath',
				readOnly: true,
			}
		]
	},
	{
		input: [
			"bucketId::mountPointPath:read-only"
		],
		expectedOutput: [
			{
				bucketId: 'bucketId',
				prefix: '',
				mountPointPath: 'mountPointPath',
				readOnly: true,
			}
		]
	},
	{
		input: [
			"bucketId: :mountPointPath:read-write"
		],
		expectedOutput: [
			{
				bucketId: 'bucketId',
				prefix: '',
				mountPointPath: 'mountPointPath',
				readOnly: false,
			}
		]
	},
	{
		input: [
			"bucketId::mountPointPath: read-only ",
			"bucketId:prefix:mountPointPath :read-only ",
			"bucketId::mountPointPath:read-write"
		],
		expectedOutput: [
			{
				bucketId: 'bucketId',
				prefix: '',
				mountPointPath: 'mountPointPath',
				readOnly: true,
			},
			{
				bucketId: 'bucketId',
				prefix: 'prefix',
				mountPointPath: 'mountPointPath',
				readOnly: true,
			},
			{
				bucketId: 'bucketId',
				prefix: '',
				mountPointPath: 'mountPointPath',
				readOnly: false,
			}
		]
	}
])("test parseStorageMounts with $input", ({ input, expectedOutput }) => {
  expect(parseStorageMounts(input)).toMatchObject(expectedOutput)
})
