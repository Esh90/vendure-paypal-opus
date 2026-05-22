import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
    getBuildProcessDefinitions,
    getBuildProcessesForTarget,
    getBuildTsConfigsForTarget,
    normalizeBuildTarget,
    resolveBuildTsConfigs,
    shouldUseMultiBuildSpinner,
    validateTsConfig,
} from './build';

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
            expect(definitions.dashboard.args).toEqual(['build', '--logLevel', 'warn']);
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

        it('uses a custom worker TypeScript config for worker builds', () => {
            const definitions = getBuildProcessDefinitions({
                tsconfig: './tsconfig.server.json',
                workerTsconfig: './tsconfig.worker.json',
            });

            expect(definitions.server.args).toEqual(['-p', './tsconfig.server.json', '--noEmitOnError']);
            expect(definitions.worker.args).toEqual(['-p', './tsconfig.worker.json', '--noEmitOnError']);
        });

        it('passes a custom Vite config to the dashboard build', () => {
            const definitions = getBuildProcessDefinitions({
                viteConfig: './config/vite.dashboard.mts',
            });

            expect(definitions.dashboard.args).toEqual([
                'build',
                '--config',
                './config/vite.dashboard.mts',
                '--logLevel',
                'warn',
            ]);
        });

        it('shows full Vite output in verbose mode', () => {
            const definitions = getBuildProcessDefinitions({
                verbose: true,
            });

            expect(definitions.dashboard.args).toEqual(['build']);
        });
    });

    describe('getBuildProcessesForTarget()', () => {
        it('builds server, worker and dashboard for all without duplicate TypeScript compiles', () => {
            const definitions = getBuildProcessDefinitions();
            const processes = getBuildProcessesForTarget('all', definitions);

            expect(processes).toHaveLength(2);
            expect(processes[0]).toMatchObject({
                target: 'server',
                displayLabel: 'server and worker',
                prefixLabel: 'server/worker',
            });
            expect(processes[1].target).toBe('dashboard');
        });

        it('builds the worker target directly when requested', () => {
            const definitions = getBuildProcessDefinitions();

            expect(getBuildProcessesForTarget('worker', definitions)).toEqual([definitions.worker]);
        });

        it('runs separate server and worker builds for all when their tsconfigs differ', () => {
            const definitions = getBuildProcessDefinitions({
                tsconfig: './tsconfig.server.json',
                workerTsconfig: './tsconfig.worker.json',
            });
            const processes = getBuildProcessesForTarget('all', definitions);

            expect(processes.map(process => process.target)).toEqual(['server', 'worker', 'dashboard']);
            expect(processes[0].args).toEqual(['-p', './tsconfig.server.json', '--noEmitOnError']);
            expect(processes[1].args).toEqual(['-p', './tsconfig.worker.json', '--noEmitOnError']);
        });
    });

    describe('getBuildTsConfigsForTarget()', () => {
        it('uses the server tsconfig for server builds', () => {
            expect(
                getBuildTsConfigsForTarget('server', {
                    serverTsconfig: './tsconfig.server.json',
                    workerTsconfig: './tsconfig.worker.json',
                }),
            ).toEqual(['./tsconfig.server.json']);
        });

        it('uses the worker tsconfig for worker builds', () => {
            expect(
                getBuildTsConfigsForTarget('worker', {
                    serverTsconfig: './tsconfig.server.json',
                    workerTsconfig: './tsconfig.worker.json',
                }),
            ).toEqual(['./tsconfig.worker.json']);
        });

        it('validates both TypeScript configs for all when they differ', () => {
            expect(
                getBuildTsConfigsForTarget('all', {
                    serverTsconfig: './tsconfig.server.json',
                    workerTsconfig: './tsconfig.worker.json',
                }),
            ).toEqual(['./tsconfig.server.json', './tsconfig.worker.json']);
        });

        it('validates the shared TypeScript config only once for all', () => {
            expect(
                getBuildTsConfigsForTarget('all', {
                    serverTsconfig: './tsconfig.server.json',
                    workerTsconfig: './tsconfig.server.json',
                }),
            ).toEqual(['./tsconfig.server.json']);
        });
    });

    describe('resolveBuildTsConfigs()', () => {
        it('prefers server and worker specific configs', () => {
            const dir = createTempDir();
            try {
                writeFileSync(path.join(dir, 'tsconfig.json'), '{}');
                writeFileSync(path.join(dir, 'tsconfig.build.json'), '{}');
                writeFileSync(path.join(dir, 'tsconfig.server.json'), '{}');
                writeFileSync(path.join(dir, 'tsconfig.worker.json'), '{}');

                expect(resolveBuildTsConfigs(dir)).toEqual({
                    serverTsconfig: './tsconfig.server.json',
                    workerTsconfig: './tsconfig.worker.json',
                });
            } finally {
                rmSync(dir, { recursive: true, force: true });
            }
        });

        it('falls back to tsconfig.build.json before tsconfig.json', () => {
            const dir = createTempDir();
            try {
                writeFileSync(path.join(dir, 'tsconfig.json'), '{}');
                writeFileSync(path.join(dir, 'tsconfig.build.json'), '{}');

                expect(resolveBuildTsConfigs(dir)).toEqual({
                    serverTsconfig: './tsconfig.build.json',
                    workerTsconfig: './tsconfig.build.json',
                });
            } finally {
                rmSync(dir, { recursive: true, force: true });
            }
        });

        it('falls back to tsconfig.json when no build-specific config exists', () => {
            const dir = createTempDir();
            try {
                writeFileSync(path.join(dir, 'tsconfig.json'), '{}');

                expect(resolveBuildTsConfigs(dir)).toEqual({
                    serverTsconfig: './tsconfig.json',
                    workerTsconfig: './tsconfig.json',
                });
            } finally {
                rmSync(dir, { recursive: true, force: true });
            }
        });

        it('uses explicit TypeScript config options before discovered configs', () => {
            const dir = createTempDir();
            try {
                writeFileSync(path.join(dir, 'tsconfig.server.json'), '{}');
                writeFileSync(path.join(dir, 'tsconfig.worker.json'), '{}');

                expect(
                    resolveBuildTsConfigs(dir, {
                        tsconfig: './custom-server.json',
                        workerTsconfig: './custom-worker.json',
                    }),
                ).toEqual({
                    serverTsconfig: './custom-server.json',
                    workerTsconfig: './custom-worker.json',
                });
            } finally {
                rmSync(dir, { recursive: true, force: true });
            }
        });

        it('uses an explicit server TypeScript config as the worker default', () => {
            const dir = createTempDir();
            try {
                writeFileSync(path.join(dir, 'tsconfig.worker.json'), '{}');

                expect(
                    resolveBuildTsConfigs(dir, {
                        tsconfig: './custom-server.json',
                    }),
                ).toEqual({
                    serverTsconfig: './custom-server.json',
                    workerTsconfig: './custom-server.json',
                });
            } finally {
                rmSync(dir, { recursive: true, force: true });
            }
        });
    });

    describe('shouldUseMultiBuildSpinner()', () => {
        it('uses multi-build spinners for quiet multi-process builds', () => {
            const definitions = getBuildProcessDefinitions();
            const processes = getBuildProcessesForTarget('all', definitions);

            expect(shouldUseMultiBuildSpinner(processes)).toBe(true);
        });

        it('does not use multi-build spinners for verbose multi-process builds', () => {
            const definitions = getBuildProcessDefinitions({ verbose: true });
            const processes = getBuildProcessesForTarget('all', definitions);

            expect(shouldUseMultiBuildSpinner(processes)).toBe(false);
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
