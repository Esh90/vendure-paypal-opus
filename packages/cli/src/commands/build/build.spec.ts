import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { getBuildProcessDefinitions, normalizeBuildTarget, validateTsConfig } from './build';

function createTempDir() {
    return mkdtempSync(path.join(tmpdir(), 'vendure-cli-build-'));
}

describe('build command', () => {
    describe('getBuildProcessDefinitions()', () => {
        it('uses tsc by default', () => {
            const definitions = getBuildProcessDefinitions();

            expect(definitions.server.packageName).toBe('typescript');
            expect(definitions.server.binName).toBe('tsc');
            expect(definitions.server.args).toEqual(['-p', './tsconfig.json', '--noEmitOnError']);
            expect(definitions.dashboard.args).toEqual(['build']);
        });

        it('uses tsgo when experimentalTsgo is enabled', () => {
            const definitions = getBuildProcessDefinitions({
                experimentalTsgo: true,
                tsconfig: './tsconfig.server.json',
            });

            expect(definitions.server.packageName).toBe('@typescript/native-preview');
            expect(definitions.server.binName).toBe('tsgo');
            expect(definitions.server.args).toEqual(['-p', './tsconfig.server.json', '--noEmitOnError']);
        });

        it('passes a custom Vite config to the dashboard build', () => {
            const definitions = getBuildProcessDefinitions({
                viteConfig: './config/vite.dashboard.mts',
            });

            expect(definitions.dashboard.args).toEqual(['build', '--config', './config/vite.dashboard.mts']);
        });
    });

    describe('normalizeBuildTarget()', () => {
        it('defaults to all', () => {
            expect(normalizeBuildTarget()).toBe('all');
        });

        it('accepts known targets', () => {
            expect(normalizeBuildTarget('all')).toBe('all');
            expect(normalizeBuildTarget('server')).toBe('server');
            expect(normalizeBuildTarget('worker')).toBe('worker');
            expect(normalizeBuildTarget('dashboard')).toBe('dashboard');
        });

        it('rejects unknown targets', () => {
            expect(() => normalizeBuildTarget('api')).toThrow('Unknown build target');
        });
    });

    describe('validateTsConfig()', () => {
        it('accepts a valid tsconfig file with comments', () => {
            const dir = createTempDir();
            try {
                mkdirSync(path.join(dir, 'src'), { recursive: true });
                writeFileSync(path.join(dir, 'src', 'index.ts'), 'export const value = 1;\n');
                writeFileSync(
                    path.join(dir, 'tsconfig.json'),
                    `{
                        // comments are valid in tsconfig files
                        "compilerOptions": {
                            "target": "ES2021",
                            "module": "CommonJS",
                        },
                        "include": ["src/**/*.ts"],
                    }`,
                );

                expect(() => validateTsConfig(dir)).not.toThrow();
            } finally {
                rmSync(dir, { recursive: true, force: true });
            }
        });

        it('rejects a missing tsconfig file', () => {
            const dir = createTempDir();
            try {
                expect(() => validateTsConfig(dir, './missing.json')).toThrow(
                    'Could not find TypeScript config file',
                );
            } finally {
                rmSync(dir, { recursive: true, force: true });
            }
        });

        it('rejects an invalid tsconfig file', () => {
            const dir = createTempDir();
            try {
                writeFileSync(path.join(dir, 'tsconfig.json'), '{ invalid json');

                expect(() => validateTsConfig(dir)).toThrow();
            } finally {
                rmSync(dir, { recursive: true, force: true });
            }
        });
    });
});
