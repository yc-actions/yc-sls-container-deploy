/**
 * Revision environment variable parsing.
 *
 * @module
 */

export interface Environment {
    [key: string]: string
}

/**
 * Parses `VARIABLE=value` lines into an environment map.
 *
 * Blank lines and lines starting with `#` are skipped, as are lines with no
 * `=`. Only the first `=` splits the pair, so values may contain `=`.
 *
 * @param envLines - Raw lines from the `revision-env` input
 * @returns Environment variable map
 */
export const parseEnvironment = (envLines: string[]): Environment => {
    const environment: Environment = {}

    for (const line of envLines) {
        const trimmedLine = line.trim()

        // Skip empty lines and comments
        if (trimmedLine === '' || trimmedLine.startsWith('#')) {
            continue
        }

        const i = trimmedLine.indexOf('=')
        if (i === -1) {
            continue // Skip lines without '=' character
        }

        const [key, value] = [trimmedLine.slice(0, i).trim(), trimmedLine.slice(i + 1).trim()]
        environment[key] = value
    }

    return environment
}
