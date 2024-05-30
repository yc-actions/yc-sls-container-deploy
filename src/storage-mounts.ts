import { StorageMount } from '@yandex-cloud/nodejs-sdk/dist/generated/yandex/cloud/serverless/containers/v1/container';

const DELIMITER = ':';
const PATH_DELIMITER = '/';

const accessModeReadOnlyValuesSet = new Set(['read-only', 'ro', 'readOnly', 'read_only', 'ReadOnly']);
const accessModeReadWriteValuesSet = new Set(['read-write', 'rw', 'readWrite', 'read_write', 'ReadWrite']);
const accessModeValuesSet = new Set([
  ...Array.from(accessModeReadOnlyValuesSet),
  ...Array.from(accessModeReadWriteValuesSet),
]);

const parseStorageMount = (input: string): StorageMount => {
  const [s3Path, mountPointPath, accessMode] = input.split(DELIMITER).map(el => el.trim());
  let readOnly = true;

  if (!s3Path) {
    throw new Error(`revision-storage-mounts: Line: '${input}' has wrong format. Empty s3Path`);
  }

  const [bucketId, ...prefixParts] = s3Path.split(PATH_DELIMITER).map(el => el.trim());
  const prefix = prefixParts.join(PATH_DELIMITER);

  if (!mountPointPath) {
    throw new Error(`revision-storage-mounts: Line: '${input}' has wrong format. Empty mountPath`);
  }

  if (accessMode) {
    if (!accessModeValuesSet.has(accessMode)) {
      throw new Error(
        `revision-storage-mounts: Line: '${input}' has wrong format. Invalid accessMode. Possible values: ${Array.from(
          accessModeValuesSet,
        ).join(', ')}`,
      );
    }

    readOnly = accessModeReadOnlyValuesSet.has(accessMode);
  }

  return StorageMount.fromJSON({
    bucketId,
    prefix,
    mountPointPath,
    readOnly,
  });
};

export const parseStorageMounts = (input: string[]): StorageMount[] | undefined => {
  const storageMounts = input.map(parseStorageMount);

  return storageMounts.length ? storageMounts : undefined;
};
