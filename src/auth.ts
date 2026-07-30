/**
 * Workload Identity Federation token exchange.
 *
 * @module
 */

import { info } from '@actions/core'
import axios from 'axios'

/**
 * Exchanges a GitHub OIDC token for a Yandex Cloud IAM token.
 *
 * @param token - GitHub Actions OIDC token
 * @param saId - Yandex Cloud service account ID to impersonate
 * @returns A Yandex Cloud IAM access token
 * @throws {Error} If the exchange endpoint returns a non-200 or no access token
 */
export async function exchangeToken(token: string, saId: string): Promise<string> {
    info(`Exchanging token for service account ${saId}`)
    const res = await axios.post(
        'https://auth.yandex.cloud/oauth/token',
        {
            grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
            requested_token_type: 'urn:ietf:params:oauth:token-type:access_token',
            audience: saId,
            subject_token: token,
            subject_token_type: 'urn:ietf:params:oauth:token-type:id_token'
        },
        {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        }
    )
    if (res.status !== 200) {
        throw new Error(`Failed to exchange token: ${res.status} ${res.statusText}`)
    }
    if (!res.data.access_token) {
        throw new Error(`Failed to exchange token: ${res.data.error} ${res.data.error_description}`)
    }
    info(`Token exchanged successfully`)
    return res.data.access_token
}
