import type { Config } from '@jest/types'

const baseDir = '<rootDir>/src';
//const baseTestDir = '<rootDir>/src/test';

const config: Config.InitialOptions = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    verbose: true,
    // collectCoverage: true,
    // collectCoverageFrom: [
    //     `${baseDir}/**/*.ts`
    // ],
    testPathIgnorePatterns: ['<rootDir>/dist/'],
    transform: {
        '^.+\\.(ts|tsx)$': 'ts-jest',
    },
}

export default config;