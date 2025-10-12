import {
    Mount,
    Mount_Mode
} from '@yandex-cloud/nodejs-sdk/dist/generated/yandex/cloud/serverless/containers/v1/container'
import { parseMemory } from './memory'

const DELIMITER = ':'
const PATH_DELIMITER = '/'

const accessModeReadOnlyValuesSet = new Set(['read-only', 'ro', 'readOnly', 'read_only', 'ReadOnly'])
const accessModeReadWriteValuesSet = new Set(['read-write', 'rw', 'readWrite', 'read_write', 'ReadWrite'])
const accessModeValuesSet = new Set([
    ...Array.from(accessModeReadOnlyValuesSet),
    ...Array.from(accessModeReadWriteValuesSet)
])

/**
 * Line format: "MOUNT_PATH:SIZE[:ACCESS_MODE]"
 * - MOUNT_PATH: absolute mount point inside the container (must be non-empty)
 * - SIZE: disk size like "512Mb" or "5Gb"
 * - ACCESS_MODE: optional; defaults to read-write. Allowed values mirror storage mounts
 */
const parseEphemeralMount = (input: string): Mount => {
    const [mountPointPathRaw, sizeRaw, accessModeRaw] = input.split(DELIMITER).map(el => el.trim())

    if (!mountPointPathRaw) {
        throw new Error(`revision-ephemeral-mounts: Line: '${input}' has wrong format. Empty mount path`)
    }
    if (!sizeRaw) {
        throw new Error(`revision-ephemeral-mounts: Line: '${input}' has wrong format. Empty size`)
    }

    let mode: Mount_Mode = Mount_Mode.READ_WRITE
    if (accessModeRaw) {
        if (!accessModeValuesSet.has(accessModeRaw)) {
            throw new Error(
                `revision-ephemeral-mounts: Line: '${input}' has wrong format. Invalid accessMode. Possible values: ${Array.from(
                    accessModeValuesSet
                ).join(', ')}`
            )
        }
        mode = accessModeReadOnlyValuesSet.has(accessModeRaw) ? Mount_Mode.READ_ONLY : Mount_Mode.READ_WRITE
    }

    const sizeBytes = parseMemory(sizeRaw)

    return Mount.fromJSON({
        mountPointPath: mountPointPathRaw,
        mode,
        ephemeralDiskSpec: {
            size: sizeBytes
        }
    })
}

/**
 * Line format: "S3_PATH:MOUNT_PATH[:ACCESS_MODE]"
 * - S3_PATH: bucket and optional prefix like "bucket/prefix/path"
 * - MOUNT_PATH: absolute mount point inside the container
 * - ACCESS_MODE: optional; defaults to read-only. Allowed values same as ephemeral mounts
 */
const parseStorageMount = (input: string): Mount => {
    const [s3Path, mountPointPath, accessMode] = input.split(DELIMITER).map(el => el.trim())

    if (!s3Path) {
        throw new Error(`revision-storage-mounts: Line: '${input}' has wrong format. Empty s3Path`)
    }

    const [bucketId, ...prefixParts] = s3Path.split(PATH_DELIMITER).map(el => el.trim())
    const prefix = prefixParts.join(PATH_DELIMITER)

    if (!mountPointPath) {
        throw new Error(`revision-storage-mounts: Line: '${input}' has wrong format. Empty mountPath`)
    }

    let mode: Mount_Mode = Mount_Mode.READ_ONLY

    if (accessMode) {
        if (!accessModeValuesSet.has(accessMode)) {
            throw new Error(
                `revision-storage-mounts: Line: '${input}' has wrong format. Invalid accessMode. Possible values: ${Array.from(
                    accessModeValuesSet
                ).join(', ')}`
            )
        }

        mode = accessModeReadOnlyValuesSet.has(accessMode) ? Mount_Mode.READ_ONLY : Mount_Mode.READ_WRITE
    }

    return Mount.fromJSON({
        mountPointPath,
        mode,
        objectStorage: {
            bucketId,
            prefix
        }
    })
}

/**
 * Parse mount definitions supporting both ephemeral and S3 storage mounts.
 *
 * Ephemeral format: "MOUNT_PATH:SIZE[:ACCESS_MODE]"
 * Storage format: "S3_PATH:MOUNT_PATH[:ACCESS_MODE]"
 *
 * The parser detects the type by checking if the second part looks like a size (e.g., "512Mb")
 */
export const parseMounts = (ephemeralLines: string[], storageLines: string[]): Mount[] | undefined => {
    const ephemeralMounts = ephemeralLines
        .map(line => line.trim())
        .filter(line => line !== '')
        .map(parseEphemeralMount)

    const storageMounts = storageLines
        .map(line => line.trim())
        .filter(line => line !== '')
        .map(parseStorageMount)

    const allMounts = [...ephemeralMounts, ...storageMounts]

    return allMounts.length ? allMounts : undefined
}
