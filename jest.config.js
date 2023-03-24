module.exports = {
  moduleFileExtensions: [
    "js",
    "ts",
    "json"
  ],
  transform: {
    "^.+\\.(t|j)sx?$": ["@swc/jest"],
  },
  transformIgnorePatterns: [],
  testEnvironment: "node",
  testMatch: ["**/__tests__/**/*.test.[jt]s?(x)"]
};
