import { expect, test } from '@jest/globals'
import { getInput } from '@actions/core'
import { LogLevel_Level } from '@yandex-cloud/nodejs-sdk/dist/generated/yandex/cloud/logging/v1/log_entry'

import { parseLogOptionsMinLevel } from '../src/log-options-min-level'

const levelsArray = ['LEVEL_UNSPECIFIED', 'TRACE', 'DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'] as Array<
    keyof typeof LogLevel_Level
>

test('should return default value LEVEL_UNSPECIFIED when key is not set', () => {
    expect(
        parseLogOptionsMinLevel(getInput('revision-log-options-min-level', { required: false, trimWhitespace: true }))
    ).toEqual(LogLevel_Level.LEVEL_UNSPECIFIED)
})

test.each(levelsArray)('should return correct enum for LogLevel = %s', (level: keyof typeof LogLevel_Level) => {
    process.env['INPUT_REVISION-LOG-OPTIONS-MIN-LEVEL'] = level
    const result = parseLogOptionsMinLevel(
        getInput('revision-log-options-min-level', { required: false, trimWhitespace: true })
    )
    expect(result).toEqual(LogLevel_Level[level])
})

test('should throw an error if value is invalid', () => {
    try {
        parseLogOptionsMinLevel('invalidKey')
    } catch (e: any) {
        expect(e.message).toEqual('revision-log-options-min-level has unknown value')
    }
})
