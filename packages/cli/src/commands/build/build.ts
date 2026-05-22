import { log, spinner } from '@clack/prompts';
import { ChildProcess, spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import pc from 'picocolors';
import ts from 'typescript';

import { resolveVendureProjectDirectory } from '../dev/dev';

export type BuildTarget = 'all' | 'server' | 'worker' | 'dashboard';

interface BuildProcessDefinition {
    target: Exclude<BuildTarget, 'all'>;
    packageName: string;
    binName: string;
    args: string[];
    color: (text: string) => string;
}

interface RunningBuildProcess {
    child: ChildProcess;
    processDefinition: BuildProcessDefinition;
    prefixOutput: boolean;
    startedAt: number;
    spinner?: ReturnType<typeof spinner>;
    output?: CapturedBuildOutput;
}

interface CapturedBuildOutput {
    stdout: string;
    stderr: string;
}

export interface BuildOptions {
    tsconfig?: string;
    viteConfig?: string;
    experimentalTsgo?: boolean;
}

const validTargets: BuildTarget[] = ['all', 'server', 'worker', 'dashboard'];

export async function buildCommand(targetArg?: string, options: BuildOptions = {}): Promise<number> {
    try {
        const target = normalizeBuildTarget(targetArg);
        const projectDir = resolveVendureProjectDirectory(process.cwd());

        if (target === 'server' || target === 'worker' || target === 'all') {
            validateTsConfig(projectDir, options.tsconfig);
        }

        const buildProcessDefinitions = getBuildProcessDefinitions(options);
        const processes =
            target === 'all'
                ? (['server', 'dashboard'] as const).map(t => buildProcessDefinitions[t])
                : [buildProcessDefinitions[target]];
        const prefixOutput = processes.length > 1;

        const children = processes.map(processDefinition =>
            startBuildProcess(projectDir, processDefinition, { prefixOutput }),
        );
        return await waitForBuildProcesses(children);
    } catch (e: unknown) {
        log.error(e instanceof Error ? e.message : String(e));
        return 1;
    }
}

export function getBuildProcessDefinitions(
    options: BuildOptions = {},
): Record<Exclude<BuildTarget, 'all'>, BuildProcessDefinition> {
    const tsconfig = options.tsconfig ?? './tsconfig.json';
    const compilerPackageName = options.experimentalTsgo ? '@typescript/native-preview' : 'typescript';
    const compilerBinName = options.experimentalTsgo ? 'tsgo' : 'tsc';
    const dashboardArgs = ['build'];
    if (options.viteConfig) {
        dashboardArgs.push('--config', options.viteConfig);
    }

    return {
        server: {
            target: 'server',
            packageName: compilerPackageName,
            binName: compilerBinName,
            args: ['-p', tsconfig, '--noEmitOnError'],
            color: pc.blue,
        },
        worker: {
            target: 'worker',
            packageName: compilerPackageName,
            binName: compilerBinName,
            args: ['-p', tsconfig, '--noEmitOnError'],
            color: pc.cyan,
        },
        dashboard: {
            target: 'dashboard',
            packageName: 'vite',
            binName: 'vite',
            args: dashboardArgs,
            color: pc.magenta,
        },
    };
}

export function normalizeBuildTarget(targetArg?: string): BuildTarget {
    const target = (targetArg ?? 'all').trim();
    if (validTargets.includes(target as BuildTarget)) {
        return target as BuildTarget;
    }
    throw new Error(`Unknown build target "${target}". Expected one of: ${validTargets.join(', ')}`);
}

export function validateTsConfig(projectDir: string, tsconfig: string = './tsconfig.json') {
    const tsconfigPath = path.resolve(projectDir, tsconfig);
    if (!existsSync(tsconfigPath)) {
        throw new Error(`Could not find TypeScript config file: ${tsconfig}`);
    }

    const readResult = ts.readConfigFile(tsconfigPath, fileName => ts.sys.readFile(fileName));
    if (readResult.error) {
        throw new Error(formatTsDiagnostics([readResult.error]));
    }

    const parsed = ts.parseJsonConfigFileContent(
        readResult.config,
        ts.sys,
        path.dirname(tsconfigPath),
        undefined,
        tsconfigPath,
    );
    if (parsed.errors.length) {
        throw new Error(formatTsDiagnostics(parsed.errors));
    }
}

function startBuildProcess(
    projectDir: string,
    processDefinition: BuildProcessDefinition,
    options: { prefixOutput: boolean },
): RunningBuildProcess {
    const binPath = resolvePackageBin(processDefinition.packageName, processDefinition.binName, projectDir);
    const buildSpinner = shouldUseSpinner(processDefinition, options.prefixOutput) ? spinner() : undefined;
    if (buildSpinner) {
        buildSpinner.start(`Building ${processDefinition.target} with ${processDefinition.binName}...`);
    } else {
        writeBuildStatus(
            processDefinition,
            options.prefixOutput,
            `Building ${processDefinition.target} with ${processDefinition.binName}...`,
        );
    }
    const startedAt = Date.now();
    const output: CapturedBuildOutput | undefined = buildSpinner ? { stdout: '', stderr: '' } : undefined;
    const child = spawn(process.execPath, [binPath, ...processDefinition.args], {
        cwd: projectDir,
        env: getChildProcessEnv(),
        stdio: options.prefixOutput || output ? ['inherit', 'pipe', 'pipe'] : 'inherit',
    });
    if (options.prefixOutput) {
        pipePrefixedOutput(child.stdout, process.stdout, processDefinition);
        pipePrefixedOutput(child.stderr, process.stderr, processDefinition);
    } else if (output) {
        captureBuildOutput(child.stdout, 'stdout', output);
        captureBuildOutput(child.stderr, 'stderr', output);
    }
    return {
        child,
        processDefinition,
        prefixOutput: options.prefixOutput,
        startedAt,
        spinner: buildSpinner,
        output,
    };
}

function pipePrefixedOutput(
    stream: NodeJS.ReadableStream | null,
    output: NodeJS.WriteStream,
    processDefinition: BuildProcessDefinition,
) {
    if (!stream) {
        return;
    }
    let buffered = '';
    const prefix = processDefinition.color(`[${processDefinition.target}]`);
    stream.on('data', data => {
        buffered += data.toString();
        const lines = buffered.split(/\r?\n/);
        buffered = lines.pop() ?? '';
        for (const line of lines) {
            output.write(line.length ? `${prefix} ${line}\n` : '\n');
        }
    });
    stream.on('end', () => {
        if (buffered.length) {
            output.write(`${prefix} ${buffered}\n`);
        }
    });
}

function waitForBuildProcesses(buildProcesses: RunningBuildProcess[]): Promise<number> {
    if (buildProcesses.length === 0) {
        return Promise.resolve(0);
    }

    return new Promise(resolve => {
        let resolved = false;
        let remainingChildren = buildProcesses.length;
        let firstNonZeroExitCode = 0;

        const resolveOnce = (code: number) => {
            if (!resolved) {
                resolved = true;
                resolve(code);
            }
        };
        const stopChildren = () => {
            for (const { child } of buildProcesses) {
                if (!child.killed && child.exitCode === null) {
                    child.kill('SIGTERM');
                }
            }
        };

        for (const buildProcess of buildProcesses) {
            const {
                child,
                processDefinition,
                prefixOutput,
                startedAt,
                output,
                spinner: buildSpinner,
            } = buildProcess;
            child.once('error', error => {
                stopBuildSpinner(buildSpinner, error.message, 1);
                if (!buildSpinner) {
                    writeBuildStatus(processDefinition, prefixOutput, error.message, process.stderr);
                }
                stopChildren();
                resolveOnce(1);
            });
            child.once('close', code => {
                remainingChildren--;
                if (code && code !== 0) {
                    firstNonZeroExitCode = code;
                    const message = `Failed to build ${processDefinition.target} after ${formatDuration(startedAt)}.`;
                    stopBuildSpinner(buildSpinner, message, 1);
                    flushCapturedOutput(output);
                    if (!buildSpinner) {
                        writeBuildStatus(processDefinition, prefixOutput, message, process.stderr);
                    }
                    stopChildren();
                } else if (firstNonZeroExitCode === 0) {
                    const message = pc.green(
                        `Built ${processDefinition.target} successfully in ${formatDuration(startedAt)}.`,
                    );
                    stopBuildSpinner(buildSpinner, message);
                    flushCapturedOutput(output);
                    if (!buildSpinner) {
                        writeBuildStatus(processDefinition, prefixOutput, message);
                    }
                }
                if (remainingChildren === 0) {
                    resolveOnce(firstNonZeroExitCode);
                }
            });
        }
    });
}

function getChildProcessEnv(): NodeJS.ProcessEnv {
    const env = { ...process.env };
    if (!env.NO_COLOR && !env.FORCE_COLOR) {
        env.FORCE_COLOR = '1';
    }
    return env;
}

function shouldUseSpinner(processDefinition: BuildProcessDefinition, prefixOutput: boolean): boolean {
    return !prefixOutput && (processDefinition.target === 'server' || processDefinition.target === 'worker');
}

function stopBuildSpinner(
    buildSpinner: ReturnType<typeof spinner> | undefined,
    message: string,
    code?: number,
) {
    if (buildSpinner) {
        buildSpinner.stop(message, code);
    }
}

function captureBuildOutput(
    stream: NodeJS.ReadableStream | null,
    streamName: keyof CapturedBuildOutput,
    output: CapturedBuildOutput,
) {
    stream?.on('data', data => {
        output[streamName] += data.toString();
    });
}

function flushCapturedOutput(output: CapturedBuildOutput | undefined) {
    if (!output) {
        return;
    }
    if (output.stdout.length) {
        process.stdout.write(output.stdout);
    }
    if (output.stderr.length) {
        process.stderr.write(output.stderr);
    }
}

function writeBuildStatus(
    processDefinition: BuildProcessDefinition,
    prefixOutput: boolean,
    message: string,
    output: NodeJS.WriteStream = process.stdout,
) {
    const prefix = processDefinition.color(`[${processDefinition.target}]`);
    output.write(prefixOutput ? `${prefix} ${message}\n` : `${message}\n`);
}

function formatDuration(startedAt: number): string {
    const duration = Date.now() - startedAt;
    if (duration < 1000) {
        return `${duration}ms`;
    }
    return `${(duration / 1000).toFixed(1)}s`;
}

function resolvePackageBin(packageName: string, binName: string, projectDir: string): string {
    const packageJsonPath = resolvePackageJsonPath(packageName, projectDir);

    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8')) as {
        bin?: string | Record<string, string>;
    };
    const bin = typeof packageJson.bin === 'string' ? packageJson.bin : packageJson.bin?.[binName];

    if (!bin) {
        throw new Error(`Could not find the "${binName}" binary in "${packageName}".`);
    }
    return path.resolve(path.dirname(packageJsonPath), bin);
}

function resolvePackageJsonPath(packageName: string, projectDir: string): string {
    try {
        return require.resolve(`${packageName}/package.json`, { paths: [projectDir] });
    } catch (e: unknown) {
        try {
            return require.resolve(`${packageName}/package.json`);
        } catch {
            const installHint =
                packageName === '@typescript/native-preview'
                    ? 'Install @typescript/native-preview to use --experimental-tsgo.'
                    : `Make sure "${packageName}" is installed.`;
            throw new Error(`Could not find "${packageName}". ${installHint}`);
        }
    }
}

function formatTsDiagnostics(diagnostics: readonly ts.Diagnostic[]) {
    return ts.formatDiagnosticsWithColorAndContext(diagnostics, {
        getCanonicalFileName: fileName => fileName,
        getCurrentDirectory: () => process.cwd(),
        getNewLine: () => '\n',
    });
}
