// See: https://rollupjs.org/introduction/

import commonjs from '@rollup/plugin-commonjs'
import json from '@rollup/plugin-json'
import nodeResolve from '@rollup/plugin-node-resolve'
import typescript from '@rollup/plugin-typescript'

/**
 * CommonJS dependencies in this graph (@yandex-cloud/nodejs-sdk, @grpc/grpc-js,
 * @supercharge/promise-pool) reference `require`, `__filename`, and `__dirname`,
 * which do not exist in an ES module. Define them from import.meta.url.
 *
 * @grpc/grpc-js additionally resolves `${__dirname}/../../proto` when channelz
 * or ORCA load reporting is enabled. Neither is reachable for a client-only
 * action - channelz.setup() merely registers a callback - so those .proto files
 * are not shipped. With __dirname defined, that path fails as a plain ENOENT if
 * it is ever reached.
 */
const banner = [
    "import { createRequire as __createRequire } from 'node:module'",
    "import { dirname as __pathDirname } from 'node:path'",
    "import { fileURLToPath as __fileURLToPath } from 'node:url'",
    'const require = __createRequire(import.meta.url)',
    'const __filename = __fileURLToPath(import.meta.url)',
    'const __dirname = __pathDirname(__filename)'
].join('\n')

const config = {
    input: 'src/index.ts',
    output: {
        banner,
        esModule: true,
        file: 'dist/index.js',
        format: 'es',
        inlineDynamicImports: true,
        sourcemap: true
    },
    // @yandex-cloud/nodejs-sdk/dist/service-endpoints.js does `require('./service-endpoints-map.json')`.
    // commonjs() can only convert require() calls it can already parse as a module, so json()
    // has to run first to turn that file into an ES module commonjs() can then see through.
    plugins: [typescript(), nodeResolve({ preferBuiltins: true }), json(), commonjs()]
}

export default config
