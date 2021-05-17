const { pathsToModuleNameMapper } = require('ts-jest/utils');

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: pathsToModuleNameMapper({
    "Lib/*": [
      "src/lib",  "src/lib/*"
    ]
  } , { prefix: '<rootDir>/' })
};