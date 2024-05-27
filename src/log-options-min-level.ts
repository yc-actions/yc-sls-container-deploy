import { LogLevel_Level } from '@yandex-cloud/nodejs-sdk/dist/generated/yandex/cloud/logging/v1/log_entry';

const logLevelDictionary: Set<LogLevel_Level> = new Set([
  LogLevel_Level.LEVEL_UNSPECIFIED,
  LogLevel_Level.TRACE,
  LogLevel_Level.DEBUG,
  LogLevel_Level.INFO,
  LogLevel_Level.WARN,
  LogLevel_Level.ERROR,
  LogLevel_Level.FATAL,
]);

export const parseLogOptionsMinLevel = (input: string): LogLevel_Level => {
  if (!input) {
    return LogLevel_Level.LEVEL_UNSPECIFIED;
  }

  const number = Number.parseInt(input, 10);

  if (!logLevelDictionary.has(number)) {
    throw new Error('revision-log-options-min-level has unknown value');
  }

  return number;
};
