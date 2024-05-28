import { LogLevel_Level } from '@yandex-cloud/nodejs-sdk/dist/generated/yandex/cloud/logging/v1/log_entry';

const logLevelNamesDictionary = new Set(['LEVEL_UNSPECIFIED', 'TRACE', 'DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL']);

const checkIsInputValueLogLevelName = (input: string): input is keyof typeof LogLevel_Level => {
  return logLevelNamesDictionary.has(input);
};

export const parseLogOptionsMinLevel = (input: string): LogLevel_Level => {
  if (!input) {
    return LogLevel_Level.LEVEL_UNSPECIFIED;
  }

  const inputInUpperCase = input.toUpperCase();

  if (!checkIsInputValueLogLevelName(inputInUpperCase)) {
    throw new Error('revision-log-options-min-level has unknown value');
  }

  return LogLevel_Level[inputInUpperCase];
};
