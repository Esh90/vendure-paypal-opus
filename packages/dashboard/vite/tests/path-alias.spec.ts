import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

import { compile } from '../utils/compiler.js';
import { debugLogger, noopLogger } from '../utils/logger.js';
import { findTsConfigPaths } from '../utils/tsconfig-utils.js';

describe('detecting plugins using tsconfig path aliases', () => {
    it('should detect plugins using tsconfig path aliases', { timeout: 60_000 }, async () => {
        const tempDir = join(__dirname, './__temp/path-alias');
        await rm(tempDir, { recursive: true, force: true });

        const result = await compile({
            outputPath: tempDir,
            vendureConfigPath: join(__dirname, 'fixtures-path-alias', 'vendure-config.ts'),
            logger: process.env.LOG ? debugLogger : noopLogger,
            pathAdapter: {
                transformTsConfigPathMappings: ({ phase, patterns }) => {
                    if (phase === 'loading') {
                        return patterns.map(pattern => {
                            return pattern.replace(/\/fixtures-path-alias/, '').replace(/.ts$/, '.js');
                        });
                    } else {
                        return patterns;
                    }
                },
            },
        });

        const plugins = result.pluginInfo.sort((a, b) => a.name.localeCompare(b.name));

        expect(plugins).toHaveLength(3);

        expect(plugins[0].name).toBe('JsAliasedPlugin');
        expect(plugins[0].dashboardEntryPath).toBe('./dashboard/index.tsx');
        expect(plugins[0].sourcePluginPath).toBe(
            join(__dirname, 'fixtures-path-alias', 'js-aliased', 'src', 'js-aliased.plugin.ts'),
        );
        expect(plugins[0].pluginPath).toBe(join(tempDir, 'js-aliased', 'src', 'js-aliased.plugin.js'));

        expect(plugins[1].name).toBe('StarAliasedPlugin');
        expect(plugins[1].dashboardEntryPath).toBe('./dashboard/index.tsx');
        expect(plugins[1].sourcePluginPath).toBe(
            join(__dirname, 'fixtures-path-alias', 'star-aliased', 'src', 'star-aliased.plugin.ts'),
        );
        expect(plugins[1].pluginPath).toBe(join(tempDir, 'star-aliased', 'src', 'star-aliased.plugin.js'));

        expect(plugins[2].name).toBe('TsAliasedPlugin');
        expect(plugins[2].dashboardEntryPath).toBe('./dashboard/index.tsx');
        expect(plugins[2].sourcePluginPath).toBe(
            join(__dirname, 'fixtures-path-alias', 'ts-aliased', 'src', 'ts-aliased.plugin.ts'),
        );
        expect(plugins[2].pluginPath).toBe(join(tempDir, 'ts-aliased', 'src', 'ts-aliased.plugin.js'));
    });
});

describe('PathAdapter transformTsConfigPathMappings', () => {
    it('should invoke transform with compiling phase', async () => {
        const configPath = join(__dirname, 'fixtures-path-alias', 'vendure-config.ts');
        const transform = vi.fn(({ patterns }) => patterns);

        const result = await findTsConfigPaths(configPath, noopLogger, 'compiling', transform);

        expect(result).toBeDefined();
        expect(transform).toHaveBeenCalled();
        for (const call of transform.mock.calls) {
            expect(call[0].phase).toBe('compiling');
        }
    });

    it('should apply different transforms per phase on the same configPath', async () => {
        const configPath = join(__dirname, 'fixtures-path-alias', 'vendure-config.ts');

        const compilingResult = await findTsConfigPaths(configPath, noopLogger, 'compiling', ({ patterns }) =>
            patterns.map(p => p + '/COMPILING'),
        );

        const loadingResult = await findTsConfigPaths(configPath, noopLogger, 'loading', ({ patterns }) =>
            patterns.map(p => p + '/LOADING'),
        );

        expect(compilingResult).toBeDefined();
        expect(loadingResult).toBeDefined();

        // Every path pattern should end with the phase-specific suffix
        for (const patterns of Object.values(compilingResult.paths)) {
            for (const p of patterns) {
                expect(p).toMatch(/\/COMPILING$/);
            }
        }
        for (const patterns of Object.values(loadingResult.paths)) {
            for (const p of patterns) {
                expect(p).toMatch(/\/LOADING$/);
            }
        }
    });
});
