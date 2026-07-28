/**
 * Main entry point for Yandex Cloud Serverless Container deployment.
 *
 * Handles authentication (SA JSON, IAM token, WIF) and orchestrates the deploy:
 * find-or-create container, resolve secrets, deploy revision, optionally
 * publicize.
 *
 * @see {@link https://github.com/yc-actions/yc-sls-container-deploy} for usage examples
 * @module
 */

import { error, getIDToken, getInput, info, setFailed, setOutput } from '@actions/core'
import { errors, Session } from '@yandex-cloud/nodejs-sdk'
import { SessionConfig } from '@yandex-cloud/nodejs-sdk/dist/types'

import { readInputs } from './action-inputs.js'
import { exchangeToken } from './auth.js'
import { makeContainerPublic } from './container/access.js'
import { getOrCreateContainerId } from './container/create.js'
import { deployRevision } from './container/revision.js'
import { resolveLatestLockboxVersions } from './lockbox.js'
import { fromServiceAccountJsonFile } from './parse/index.js'

/**
 * Resolves credentials from the action inputs.
 *
 * Priority: Service Account JSON, then IAM token, then Workload Identity
 * Federation via the GitHub OIDC token.
 *
 * @returns Session configuration for the Yandex Cloud SDK
 * @throws {Error} If no credentials are provided
 */
const resolveSessionConfig = async (): Promise<SessionConfig> => {
    const ycSaJsonCredentials = getInput('yc-sa-json-credentials')
    const ycIamToken = getInput('yc-iam-token')
    const ycSaId = getInput('yc-sa-id')

    if (ycSaJsonCredentials !== '') {
        const serviceAccountJson = fromServiceAccountJsonFile(JSON.parse(ycSaJsonCredentials))
        info('Parsed Service account JSON')
        return { serviceAccountJson }
    }
    if (ycIamToken !== '') {
        info('Using IAM token')
        return { iamToken: ycIamToken }
    }
    if (ycSaId !== '') {
        // Workload Identity Federation: exchange the GitHub OIDC token for a Yandex IAM token
        const ghToken = await getIDToken()
        if (!ghToken) {
            throw new Error('No credentials provided')
        }
        const saToken = await exchangeToken(ghToken, ycSaId)
        return { iamToken: saToken }
    }
    throw new Error('No credentials')
}

/**
 * Main entry point for GitHub Action execution.
 */
export const run = async (): Promise<void> => {
    try {
        info('start')
        const sessionConfig = await resolveSessionConfig()
        const session = new Session(sessionConfig)

        const inputs = readInputs()
        inputs.secrets = await resolveLatestLockboxVersions(session, inputs.folderId, inputs.secrets)

        info(`Folder ID: ${inputs.folderId}, container name: ${inputs.containerName}`)
        const containerId = await getOrCreateContainerId(session, inputs)

        info('Creating new revision.')
        const rev = await deployRevision(session, containerId, inputs)

        info(`Revision created. Id: ${rev.id}`)
        setOutput('rev', rev.id)

        if (inputs.isPublic) {
            await makeContainerPublic(session, containerId)
            info('Container is public now')
        }
    } catch (err) {
        if (err instanceof errors.ApiError) {
            error(`${err.message}\nx-request-id: ${err.requestId}\nx-server-trace-id: ${err.serverTraceId}`)
        }
        setFailed(err as Error)
    }
}
