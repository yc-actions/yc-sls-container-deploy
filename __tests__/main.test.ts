import * as cp from 'child_process';
import * as path from 'path';
import * as process from 'process';
import {
  test,
  describe,
  expect,
} from '@jest/globals';
import {
  Secret,
  parseLockboxVariablesMapping, parseEnvironment,
} from '../src/main';

// This test will run only in fully configured env and creates real containers
// in the Yandex Cloud, so it will be disabled in CI/CD. You can enable it to test locally.
test.skip('test runs', () => {
  const np = process.execPath;
  const ip = path.join(__dirname, '..', 'lib', 'main.js');
  const options: cp.ExecFileSyncOptions = {
    env: process.env,
  };
  let res;
  try {
    res = cp.execFileSync(np, [ip], options);
  } catch (e) {
    console.log((e as any).stdout.toString());
  }
  console.log(res?.toString());
});

describe('lockbox', () => {
  test('it should return right lockbox secrets', () => {
    const input = ['ENV_VAR_1=id1/verId1/VAR_1', 'ENV_VAR_2=id2/verId2/VAR_2'];
    const result = parseLockboxVariablesMapping(input);
    const expected: Secret[] = [
      {
        environmentVariable: 'ENV_VAR_1',
        id: 'id1',
        versionId: 'verId1',
        key: 'VAR_1',
      },
      {
        environmentVariable: 'ENV_VAR_2',
        id: 'id2',
        versionId: 'verId2',
        key: 'VAR_2',
      },
    ];
    expect(result).toEqual(expected);
  });

  test.each([
    ['123412343'],
    ['123=id'],
    ['123=id/verId'],
    ['123=id/verId/'],
  ])(
    'it should throw error when bad input provided',
    input => {
      expect(() => parseLockboxVariablesMapping(input)).toThrow();
    },
  );
});

describe('environment', () => {
  test('it should parse envs with multiple =', () => {
    const input = [
      'DATABASE_URL=postgresql://user:password@host:port/db?sslmode=verify-full&target_session_attrs=read-write',
      'GOOGLE_CLIENT_ID=id.apps.googleusercontent.com',
    ];
    const result = parseEnvironment(input);
    const expected: { [key: string]: string } = {
      DATABASE_URL: 'postgresql://user:password@host:port/db?sslmode=verify-full&target_session_attrs=read-write',
      GOOGLE_CLIENT_ID: 'id.apps.googleusercontent.com',
    };
    expect(result).toEqual(expected);
  });
});
