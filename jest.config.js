module.exports = {
  preset: "ts-jest",
  rootDir: ".",
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1"
  }
};
