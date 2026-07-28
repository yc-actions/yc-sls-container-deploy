/**
 * Lockbox secret version resolution.
 *
 * Resolves a `latest` versionId to a concrete version, first by secret ID and
 * then, for anything that fails, by secret name within the folder.
 *
 * @see adr/001_lockbox_secrets.md
 * @module
 */

import { info } from '@actions/core'
import { PromisePool } from '@supercharge/promise-pool'
import { Session } from '@yandex-cloud/nodejs-sdk'
import { secretService } from '@yandex-cloud/nodejs-sdk/lockbox-v1'
import { Secret as LockboxSecret } from '@yandex-cloud/nodejs-sdk/dist/generated/yandex/cloud/lockbox/v1/secret'
import {
    ListSecretsRequest,
    ListSecretsResponse
} from '@yandex-cloud/nodejs-sdk/dist/generated/yandex/cloud/lockbox/v1/secret_service'

import { Secret } from './parse/index.js'

type ResolutionResult =
    { status: 'success'; secret: Secret } | { status: 'fallback'; original: Secret } | { status: 'error'; error: Error }

const resolveSecretsById = async (session: Session, secrets: Secret[]): Promise<ResolutionResult[]> => {
    const client = session.client(secretService.SecretServiceClient)
    const { results } = await PromisePool.for(secrets)
        .withConcurrency(5)
        .useCorrespondingResults()
        .process(async (secret): Promise<ResolutionResult> => {
            let lockboxSecret: LockboxSecret
            try {
                lockboxSecret = await client.get({ secretId: secret.id })
            } catch {
                return { status: 'fallback', original: secret }
            }

            if (!lockboxSecret.currentVersion) {
                return {
                    status: 'error',
                    error: new Error(`Secret ${secret.id} has no current version`)
                }
            }
            return {
                status: 'success',
                secret: {
                    ...secret,
                    versionId: lockboxSecret.currentVersion.id
                }
            }
        })
    return results.filter((r): r is ResolutionResult => typeof r !== 'symbol')
}

const findSecretsInFolder = async (session: Session, folderId: string): Promise<Map<string, LockboxSecret>> => {
    const client = session.client(secretService.SecretServiceClient)
    const folderSecretsMap = new Map<string, LockboxSecret>()
    let pageToken: string | undefined = undefined

    do {
        const resp: ListSecretsResponse = await client.list(
            ListSecretsRequest.fromPartial({
                folderId,
                pageSize: 100,
                pageToken: pageToken || ''
            })
        )
        if (resp.secrets) {
            for (const secret of resp.secrets) {
                folderSecretsMap.set(secret.name, secret)
            }
        }
        pageToken = resp.nextPageToken
    } while (pageToken)

    return folderSecretsMap
}

export const resolveLatestLockboxVersions = async (
    session: Session,
    folderId: string,
    secrets: Secret[]
): Promise<Secret[]> => {
    const secretsWithLatest = secrets.filter(s => s.versionId === 'latest')
    if (secretsWithLatest.length === 0) {
        return secrets
    }

    const results = await resolveSecretsById(session, secretsWithLatest)
    const fallbackIndices = results.map((r, i) => (r.status === 'fallback' ? i : -1)).filter(i => i !== -1)

    if (fallbackIndices.length > 0) {
        info(`Failed to resolve ${fallbackIndices.length} secrets by ID. Trying to find by name in folder ${folderId}`)

        const folderSecretsMap = await findSecretsInFolder(session, folderId)

        for (const index of fallbackIndices) {
            const result = results[index]
            if (result.status !== 'fallback') continue

            const originalSecret = result.original
            const match = folderSecretsMap.get(originalSecret.id)

            if (match) {
                info(`Resolved secret "${originalSecret.id}" to ID "${match.id}"`)
                if (!match.currentVersion) {
                    results[index] = {
                        status: 'error',
                        error: new Error(`Secret ${originalSecret.id} (found as ${match.id}) has no current version`)
                    }
                } else {
                    results[index] = {
                        status: 'success',
                        secret: {
                            ...originalSecret,
                            id: match.id,
                            versionId: match.currentVersion.id
                        }
                    }
                }
            }
        }
    }

    const resolutionErrors: Error[] = []
    const resolvedMap = new Map<Secret, Secret>()

    for (const [index, secret] of secretsWithLatest.entries()) {
        const result = results[index]
        if (result.status === 'success') {
            resolvedMap.set(secret, result.secret)
        } else if (result.status === 'error') {
            resolutionErrors.push(result.error)
        } else if (result.status === 'fallback') {
            resolutionErrors.push(new Error(`Failed to resolve secret: ${secret.id}`))
        }
    }

    if (resolutionErrors.length > 0) {
        const errorMessages = resolutionErrors.map(e => e.message).join(', ')
        throw new Error(`Failed to resolve latest versions for secrets: ${errorMessages}`)
    }

    return secrets.map(s => resolvedMap.get(s) || s)
}
