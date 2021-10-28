import * as cp from 'child_process'
import * as path from 'path'
import * as process from 'process'
import {test} from '@jest/globals'

// This test will run only in fully configured env and creates real containers
// in the Yandex Cloud, so it will be disabled in CI/CD. You can enable it to test locally.
test.skip('test runs', () => {
  const np = process.execPath
  const ip = path.join(__dirname, '..', 'lib', 'main.js')
  const options: cp.ExecFileSyncOptions = {
    env: process.env
  }
  let res
  try {
    res = cp.execFileSync(np, [ip], options)
  } catch (e) {
    console.log((e as any).stdout.toString())
  }
  console.log(res?.toString())
})
