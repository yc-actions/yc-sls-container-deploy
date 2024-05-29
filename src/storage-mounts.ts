import { StorageMount } from '@yandex-cloud/nodejs-sdk/dist/generated/yandex/cloud/serverless/containers/v1/container';

const DELIMITER = ':';
const accessModeDictionary = new Set(['read-only', 'read-write']);

const parseStorageMount = (input: string): StorageMount => {
  const [bucketId, prefix, mountPointPath, accessMode] = input.split(DELIMITER).map(el => el.trim());
  let readOnly = true;

  if (!bucketId) {
    throw new Error(`revision-storage-mounts: Line: '${input}' has wrong format. Empty bucketId`);
  }

  if (!mountPointPath) {
    throw new Error(`revision-storage-mounts: Line: '${input}' has wrong format. Empty mountPointPath`);
  }

  if (accessMode) {
    if (!accessModeDictionary.has(accessMode)) {
      throw new Error(
        `revision-storage-mounts: Line: '${input}' has wrong format. Invalid accessMode. Possible values: ${Array.from(
          accessModeDictionary,
        ).join(', ')}`,
      );
    }

    readOnly = accessMode === 'read-only';
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
