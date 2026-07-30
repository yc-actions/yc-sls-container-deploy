/**
 * Lockbox secret mapping parsing.
 *
 * @module
 */

import { info } from '@actions/core'

export type Secret = {
    environmentVariable: string
    id: string
    versionId: string
    key: string
}

/**
 * Parses one `environmentVariable=secretId/versionId/key` line.
 *
 * @param line - A single line from the `revision-secrets` input
 * @returns The parsed secret, or null for a blank or comment line
 * @throws {Error} If a non-blank line does not match the expected shape
 */
export const parseLockboxSecretDefinition = (line: string): Secret | null => {
    const trimmedLine = line.trim()

    // Skip empty lines and comments
    if (trimmedLine === '' || trimmedLine.startsWith('#')) {
        return null
    }

    // Remove inline comments (everything after #)
    const lineWithoutComments = trimmedLine.split('#')[0].trim()

    const regex = /^(?<environmentVariable>.+)=(?<secretId>.+)\/(?<versionId>.+)\/(?<key>.+)$/gm
    const m = regex.exec(lineWithoutComments)

    if (!m?.groups) {
        throw new Error(`Line: '${line}' has wrong format`)
    }

    const { environmentVariable, secretId, versionId, key } = m.groups

    return {
        environmentVariable,
        id: secretId,
        versionId,
        key
    }
}

/**
 * Parses every `revision-secrets` line into secret mappings.
 *
 * @param secrets - Raw lines from the `revision-secrets` input
 * @returns Parsed secrets, blank and comment lines dropped
 */
export const parseLockboxVariablesMapping = (secrets: string[]): Secret[] => {
    info(`Secrets string: "${secrets}"`)
    const secretsArr: Secret[] = []

    for (const line of secrets) {
        const secret = parseLockboxSecretDefinition(line)
        if (secret) {
            secretsArr.push(secret)
        }
    }

    info(`SecretsObject: "${JSON.stringify(secretsArr)}"`)

    return secretsArr
}
