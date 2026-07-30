/**
 * Action input reading and parsing.
 *
 * @module
 */

import { getBooleanInput, getInput, getMultilineInput } from '@actions/core'
import { LogLevel_Level } from '@yandex-cloud/nodejs-sdk/dist/generated/yandex/cloud/logging/v1/log_entry'
import {
    LogOptions,
    Mount
} from '@yandex-cloud/nodejs-sdk/dist/generated/yandex/cloud/serverless/containers/v1/container'

import {
    Environment,
    parseEnvironment,
    parseLockboxVariablesMapping,
    parseLogOptionsMinLevel,
    parseMemory,
    parseMounts,
    Secret
} from './parse/index.js'

export interface ActionInputs {
    folderId: string
    containerName: string
    isPublic: boolean
    imageUrl: string
    workingDir: string
    serviceAccountId: string
    cores: number
    memory: number
    coreFraction: number
    concurrency: number
    executionTimeout: number
    command: { command: string[] } | undefined
    args: { args: string[] } | undefined
    environment: Environment
    provisioned: number | undefined
    zoneInstancesLimit?: number
    zoneRequestsLimit?: number
    secrets: Secret[]
    logOptions: LogOptions
    mounts?: Mount[]
    networkId?: string
    runtime: 'http' | 'task'
}

/**
 * Reads every action input and parses it into the deployment configuration.
 *
 * @returns Parsed configuration
 * @throws {Error} If a required input is missing or a value fails to parse
 */
export const readInputs = (): ActionInputs => {
    const folderId: string = getInput('folder-id', { required: true })
    const containerName: string = getInput('container-name', { required: true })
    // Truthiness on a raw string, matching the original `if (getInput('public'))`.
    // The literal string 'false' is therefore truthy. Preserved deliberately;
    // changing it is a behavior change, not a refactor.
    const isPublic = Boolean(getInput('public'))

    const imageUrl: string = getInput('revision-image-url')
    const workingDir: string = getInput('revision-working-dir')
    const serviceAccountId: string = getInput('revision-service-account-id')
    const cores: number = Number.parseInt(getInput('revision-cores') || '1', 10)
    const memory: number = parseMemory(getInput('revision-memory') || '128Mb')
    const coreFraction: number = Number.parseInt(getInput('revision-core-fraction') || '100', 10)
    const concurrency: number = Number.parseInt(getInput('revision-concurrency') || '1', 10)
    const provisionedRaw: string = getInput('revision-provisioned')
    const zoneInstancesLimitRaw: string = getInput('revision-zone-instances-limit')
    const zoneRequestsLimitRaw: string = getInput('revision-zone-requests-limit')
    const executionTimeout: number = Number.parseInt(getInput('revision-execution-timeout') || '3', 10)
    const networkId: string = getInput('revision-network-id')
    const runtime = (getInput('revision-runtime') || 'http').toLowerCase() as 'http' | 'task'
    const commands: string[] = getMultilineInput('revision-commands')

    const command = commands.length > 0 ? { command: commands } : undefined
    const argList: string[] = getMultilineInput('revision-args')

    const args = argList.length > 0 ? { args: argList } : undefined
    const environment: Environment = parseEnvironment(getMultilineInput('revision-env'))
    const secrets: Secret[] = parseLockboxVariablesMapping(getMultilineInput('revision-secrets'))

    const logOptionsDisabled: boolean = getBooleanInput('revision-log-options-disabled')
    const logOptionsLogGroupId: string | undefined = getInput('revision-log-options-log-group-id') || undefined
    const logOptionsFolderId: string | undefined = getInput('revision-log-options-folder-id') || undefined
    const logOptionsMinLevel: LogLevel_Level = parseLogOptionsMinLevel(getInput('revision-log-options-min-level'))

    if (!!logOptionsLogGroupId && !!logOptionsFolderId) {
        throw new Error(
            'revision-log-options-log-group-id and revision-log-options-folder-id cannot be set at the same time'
        )
    }

    const mounts = parseMounts(
        getMultilineInput('revision-ephemeral-mounts'),
        getMultilineInput('revision-storage-mounts')
    )

    const logOptions = LogOptions.fromJSON({
        disabled: logOptionsDisabled,
        logGroupId: logOptionsLogGroupId,
        folderId: logOptionsFolderId,
        minLevel: logOptionsMinLevel
    })

    let provisioned = undefined

    if (provisionedRaw !== '') {
        provisioned = Number.parseInt(provisionedRaw, 10)
    }

    let zoneInstancesLimit = undefined
    let zoneRequestsLimit = undefined

    if (zoneInstancesLimitRaw !== '') {
        zoneInstancesLimit = Number.parseInt(zoneInstancesLimitRaw, 10)
    }
    if (zoneRequestsLimitRaw !== '') {
        zoneRequestsLimit = Number.parseInt(zoneRequestsLimitRaw, 10)
    }

    return {
        folderId,
        containerName,
        isPublic,
        imageUrl,
        workingDir,
        serviceAccountId,
        cores,
        memory,
        coreFraction,
        concurrency,
        executionTimeout,
        command,
        args,
        environment,
        provisioned,
        zoneInstancesLimit,
        zoneRequestsLimit,
        secrets,
        networkId,
        logOptions,
        mounts,
        runtime
    }
}
