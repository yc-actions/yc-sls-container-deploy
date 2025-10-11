import {
    Mount,
    Mount_Mode
} from '@yandex-cloud/nodejs-sdk/dist/generated/yandex/cloud/serverless/containers/v1/container'
import { parseMemory } from './memory'

const DELIMITER = ':'

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

export const parseEphemeralMounts = (input: string[]): Mount[] | undefined => {
    const mounts = input
        .map(line => line.trim())
        .filter(line => line !== '')
        .map(parseEphemeralMount)

    return mounts.length ? mounts : undefined
}
