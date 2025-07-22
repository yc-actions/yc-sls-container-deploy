export const moduleFileExtensions = ['js', 'ts', 'json']
export const transform = {
    '^.+\\.(t|j)sx?$': ['@swc/jest']
}
export const transformIgnorePatterns = []
export const testEnvironment = 'node'
export const testMatch = ['**/__tests__/**/*.test.[jt]s?(x)']
