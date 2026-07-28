/**
 * Smoke test for the built bundle.
 *
 * Unit tests mock the SDK, so they cannot catch a bundle that fails to load.
 * This runs dist/index.js in a subprocess with no credentials and asserts it
 * reaches the action's own validation rather than a module-resolution error.
 */
import { describe, expect, it } from '@jest/globals'
import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

describe('dist/index.js', () => {
    it('loads and fails with No credentials', async () => {
        if (!existsSync('dist/index.js')) {
            throw new Error('dist/index.js is missing - run `npm run package` first')
        }

        let output = ''
        let code: number | undefined
        try {
            const result = await execFileAsync(process.execPath, ['dist/index.js'], {
                env: {
                    ...process.env,
                    GITHUB_REPOSITORY: 'owner/repo',
                    GITHUB_SHA: 'sha'
                }
            })
            output = `${result.stdout}${result.stderr}`
            code = 0
        } catch (err) {
            const e = err as { code?: number; stdout?: string; stderr?: string }
            output = `${e.stdout ?? ''}${e.stderr ?? ''}`
            code = e.code
        }

        expect(output).toContain('No credentials')
        expect(output).not.toContain('Cannot find module')
        expect(output).not.toContain('is not defined')
        expect(code).toBe(1)
    }, 60000)
})
