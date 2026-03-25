import fs from 'fs-extra';
import path from 'node:path';

import { TsConfigPathsConfig } from './tsconfig-utils.js';

/**
 * Resolves a file path to an actual source file on disk, trying various
 * extensions and index files (mimicking Node.js module resolution).
 */
export async function resolveSourceFile(filePath: string): Promise<string | undefined> {
    const candidates = [
        filePath,
        filePath + '.ts',
        filePath + '.tsx',
        filePath + '.js',
        filePath + '.jsx',
        path.join(filePath, 'index.ts'),
        path.join(filePath, 'index.tsx'),
        path.join(filePath, 'index.js'),
    ];
    if (filePath.endsWith('.js')) {
        candidates.push(filePath.replace(/\.js$/, '.ts'));
        candidates.push(filePath.replace(/\.js$/, '.tsx'));
    }
    for (const candidate of candidates) {
        try {
            const stat = await fs.stat(candidate);
            if (stat.isFile()) return candidate;
        } catch {
            continue;
        }
    }
    return undefined;
}

/**
 * Given an import specifier and tsconfig path aliases, returns an array
 * of potential file paths that the import might resolve to.
 *
 * Only matches path aliases — relative imports and npm packages are not handled.
 */
export function resolvePathAliasImports(importPath: string, tsConfigInfo?: TsConfigPathsConfig): string[] {
    const resolved: string[] = [];
    if (!tsConfigInfo) {
        return resolved;
    }
    for (const [alias, patterns] of Object.entries(tsConfigInfo.paths)) {
        const hasWildcard = alias.includes('*');
        if (hasWildcard) {
            // Wildcard alias: "@plugins/*" matches "@plugins/foo" but not "@plugins-other/foo"
            const prefix = alias.replace(/\*$/, '');
            if (importPath.startsWith(prefix)) {
                const suffix = importPath.slice(prefix.length);
                for (const pattern of patterns) {
                    const target = pattern.replace(/\*$/, '');
                    resolved.push(path.resolve(tsConfigInfo.baseUrl, target, suffix));
                }
            }
        } else {
            // Exact alias: "@app" matches only "@app", not "@app-other"
            if (importPath === alias) {
                for (const pattern of patterns) {
                    resolved.push(path.resolve(tsConfigInfo.baseUrl, pattern));
                }
            }
        }
    }
    return resolved;
}
