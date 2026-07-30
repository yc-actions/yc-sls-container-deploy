/**
 * Stable serializer for recorded Yandex Cloud SDK request objects.
 *
 * Deliberately free of jest and SDK imports so it survives the migration from
 * jest's implicit __mocks__ discovery to `jest.unstable_mockModule` unchanged.
 */

/**
 * Keys whose values are not reproducible across runs and are replaced with a
 * fixed marker. Empty today - this action uploads no archive, so it has no
 * digest-of-mtimes problem. The mechanism is kept because Task 3 may discover
 * a varying field once the fixtures are rebuilt.
 */
const REDACTED_KEYS = new Set<string>([])

/**
 * Normalizes a value into a form that is stable across runs and machines.
 *
 * - Buffers and byte arrays become `bytes:<length>`.
 * - protobufjs `Long` instances become their decimal string.
 * - Dates become `date:<iso>`.
 * - Errors become `error:<message>` - the stack is machine-specific.
 * - Object keys are sorted so key insertion order cannot cause a false diff.
 */
export function normalize(value: unknown): unknown {
    if (value === null || value === undefined) {
        return value
    }
    if (Buffer.isBuffer(value) || value instanceof Uint8Array) {
        return `bytes:${value.length}`
    }
    if (typeof value === 'bigint') {
        return value.toString()
    }
    if (value instanceof Error) {
        return `error:${value.message}`
    }
    if (value instanceof Date) {
        return `date:${value.toISOString()}`
    }
    if (value instanceof Map) {
        const entries = Array.from(value.entries()).map(([k, v]) => [normalize(k), normalize(v)])
        entries.sort((a, b) => String(a[0]).localeCompare(String(b[0])))
        return { __map: entries }
    }
    if (Array.isArray(value)) {
        return value.map(normalize)
    }
    if (typeof value === 'object') {
        const obj = value as Record<string, unknown>
        // protobufjs Long: has low/high/unsigned and a decimal toString().
        if ('low' in obj && 'high' in obj && 'unsigned' in obj) {
            return String(obj)
        }
        const out: Record<string, unknown> = {}
        for (const key of Object.keys(obj).sort()) {
            out[key] = REDACTED_KEYS.has(key) ? '<redacted>' : normalize(obj[key])
        }
        return out
    }
    return value
}
