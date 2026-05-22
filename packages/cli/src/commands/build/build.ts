import { log, spinner } from '@clack/prompts';
import { ChildProcess, spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import pc from 'picocolors';
import ts from 'typescript';

import { resolveVendureProjectDirectory } from '../dev/dev';

export type BuildTarget = 'all' | 'server' | 'worker' | 'dashboard';

export interface BuildProcessDefinition {
    target: Exclude<BuildTarget, 'all'>;
    displayLabel?: string;
    prefixLabel?: string;
    tsconfig?: string;
    packageName: string;
    binName: string;
    args: string[];
    captureOutput: boolean;
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

interface WaitForBuildProcessesOptions {
    progressRenderer?: BuildProgressRenderer;
}

interface BuildProgressRenderer {
    start(buildProcesses: RunningBuildProcess[]): void;
    complete(buildProcess: RunningBuildProcess): void;
    fail(buildProcess: RunningBuildProcess, message: string): void;
    stop(): void;
}

export interface BuildOptions {
    tsconfig?: string;
    workerTsconfig?: string;
    viteConfig?: string;
    experimentalTsgo?: boolean;
    noProgress?: boolean;
    verbose?: boolean;
}

export interface BuildTsConfigPaths {
    serverTsconfig: string;
    workerTsconfig: string;
}

const validTargets: BuildTarget[] = ['all', 'server', 'worker', 'dashboard'];
const serverTsConfigCandidates = ['./tsconfig.server.json', './tsconfig.build.json', './tsconfig.json'];
const workerTsConfigCandidates = ['./tsconfig.worker.json', './tsconfig.build.json', './tsconfig.json'];

export async function buildCommand(targetArg?: string, options: BuildOptions = {}): Promise<number> {
    try {
        const target = normalizeBuildTarget(targetArg);
        const projectDir = resolveVendureProjectDirectory(process.cwd());
        const tsconfigs = resolveBuildTsConfigs(projectDir, options);

        for (const tsconfig of getBuildTsConfigsForTarget(target, tsconfigs)) {
            validateTsConfig(projectDir, tsconfig);
        }

        const buildProcessDefinitions = getBuildProcessDefinitions(options, tsconfigs);
        const processes = getBuildProcessesForTarget(target, buildProcessDefinitions);
        const prefixOutput = processes.length > 1;
        const useProgress = shouldUseProgress(options);
        const progressRenderer =
            useProgress && shouldUseMultiBuildSpinner(processes) ? createBuildProgressRenderer() : undefined;

        try {
            const children = processes.map(processDefinition =>
                startBuildProcess(projectDir, processDefinition, {
                    prefixOutput,
                    disableSpinner: !useProgress,
                    suppressStatus: progressRenderer != null,
                }),
            );
            progressRenderer?.start(children);
            return await waitForBuildProcesses(children, {
                progressRenderer,
            });
        } catch (e: unknown) {
            progressRenderer?.stop();
            throw e;
        }
    } catch (e: unknown) {
        log.error(e instanceof Error ? e.message : String(e));
        return 1;
    }
}

export function getBuildProcessDefinitions(
    options: BuildOptions = {},
    tsconfigs: BuildTsConfigPaths = resolveBuildTsConfigs(process.cwd(), options),
): Record<Exclude<BuildTarget, 'all'>, BuildProcessDefinition> {
    const compilerPackageName = options.experimentalTsgo ? '@typescript/native-preview' : 'typescript';
    const compilerBinName = options.experimentalTsgo ? 'tsgo' : 'tsc';
    const dashboardArgs = ['build'];
    if (options.viteConfig) {
        dashboardArgs.push('--config', options.viteConfig);
    }
    if (!options.verbose) {
        dashboardArgs.push('--logLevel', 'warn');
    }

    return {
        server: {
            target: 'server',
            tsconfig: tsconfigs.serverTsconfig,
            packageName: compilerPackageName,
            binName: compilerBinName,
            args: ['-p', tsconfigs.serverTsconfig, '--noEmitOnError'],
            captureOutput: !options.verbose,
            color: pc.blue,
        },
        worker: {
            target: 'worker',
            tsconfig: tsconfigs.workerTsconfig,
            packageName: compilerPackageName,
            binName: compilerBinName,
            args: ['-p', tsconfigs.workerTsconfig, '--noEmitOnError'],
            captureOutput: !options.verbose,
            color: pc.cyan,
        },
        dashboard: {
            target: 'dashboard',
            packageName: 'vite',
            binName: 'vite',
            args: dashboardArgs,
            captureOutput: !options.verbose,
            color: pc.magenta,
        },
    };
}

export function getBuildProcessesForTarget(
    target: BuildTarget,
    buildProcessDefinitions: Record<Exclude<BuildTarget, 'all'>, BuildProcessDefinition>,
): BuildProcessDefinition[] {
    if (target === 'all') {
        if (buildProcessDefinitions.server.tsconfig !== buildProcessDefinitions.worker.tsconfig) {
            return [
                buildProcessDefinitions.server,
                buildProcessDefinitions.worker,
                buildProcessDefinitions.dashboard,
            ];
        }
        return [
            {
                ...buildProcessDefinitions.server,
                displayLabel: 'server and worker',
                prefixLabel: 'server/worker',
            },
            buildProcessDefinitions.dashboard,
        ];
    }
    return [buildProcessDefinitions[target]];
}

export function resolveBuildTsConfigs(projectDir: string, options: BuildOptions = {}): BuildTsConfigPaths {
    const serverTsconfig = options.tsconfig ?? discoverTsConfig(projectDir, serverTsConfigCandidates);
    const workerTsconfig =
        options.workerTsconfig ?? options.tsconfig ?? discoverTsConfig(projectDir, workerTsConfigCandidates);
    return { serverTsconfig, workerTsconfig };
}

export function getBuildTsConfigsForTarget(target: BuildTarget, tsconfigs: BuildTsConfigPaths): string[] {
    if (target === 'dashboard') {
        return [];
    }
    if (target === 'worker') {
        return [tsconfigs.workerTsconfig];
    }
    if (target === 'all') {
        return Array.from(new Set([tsconfigs.serverTsconfig, tsconfigs.workerTsconfig]));
    }
    return [tsconfigs.serverTsconfig];
}

export function shouldUseMultiBuildSpinner(processes: BuildProcessDefinition[]): boolean {
    return processes.length > 1 && processes.every(processDefinition => processDefinition.captureOutput);
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

function discoverTsConfig(projectDir: string, candidates: string[]): string {
    return candidates.find(candidate => existsSync(path.resolve(projectDir, candidate))) ?? './tsconfig.json';
}

function startBuildProcess(
    projectDir: string,
    processDefinition: BuildProcessDefinition,
    options: { prefixOutput: boolean; disableSpinner?: boolean; suppressStatus?: boolean },
): RunningBuildProcess {
    const binPath = resolvePackageBin(processDefinition.packageName, processDefinition.binName, projectDir);
    const buildSpinner =
        !options.disableSpinner && shouldUseSpinner(processDefinition, options.prefixOutput)
            ? spinner()
            : undefined;
    const shouldPipeOutput = options.prefixOutput && !processDefinition.captureOutput;
    const buildLabel = getBuildProcessLabel(processDefinition);
    if (buildSpinner) {
        buildSpinner.start(`Building ${buildLabel} with ${processDefinition.binName}...`);
    } else if (!options.suppressStatus) {
        writeBuildStatus(
            processDefinition,
            options.prefixOutput,
            `Building ${buildLabel} with ${processDefinition.binName}...`,
        );
    }
    const startedAt = Date.now();
    const output: CapturedBuildOutput | undefined = processDefinition.captureOutput
        ? { stdout: '', stderr: '' }
        : undefined;
    const child = spawn(process.execPath, [binPath, ...processDefinition.args], {
        cwd: projectDir,
        env: getChildProcessEnv(),
        stdio: shouldPipeOutput || output ? ['inherit', 'pipe', 'pipe'] : 'inherit',
    });
    if (shouldPipeOutput) {
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
    const prefix = getBuildProcessPrefix(processDefinition);
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

function waitForBuildProcesses(
    buildProcesses: RunningBuildProcess[],
    options: WaitForBuildProcessesOptions = {},
): Promise<number> {
    if (buildProcesses.length === 0) {
        return Promise.resolve(0);
    }

    return new Promise(resolve => {
        let resolved = false;
        let progressRendererStopped = false;
        let remainingChildren = buildProcesses.length;
        let firstNonZeroExitCode = 0;

        const resolveOnce = (code: number) => {
            if (!resolved) {
                resolved = true;
                resolve(code);
            }
        };
        const stopProgressRenderer = () => {
            if (!progressRendererStopped) {
                options.progressRenderer?.stop();
                progressRendererStopped = true;
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
                options.progressRenderer?.fail(buildProcess, error.message);
                stopProgressRenderer();
                if (!buildSpinner && !options.progressRenderer) {
                    writeBuildStatus(processDefinition, prefixOutput, error.message, process.stderr);
                }
                stopChildren();
                resolveOnce(1);
            });
            child.once('close', code => {
                remainingChildren--;
                if (code && code !== 0) {
                    firstNonZeroExitCode = code;
                    const message = `Failed to build ${getBuildProcessLabel(processDefinition)} after ${formatDuration(
                        startedAt,
                    )}.`;
                    stopBuildSpinner(buildSpinner, message, 1);
                    options.progressRenderer?.fail(buildProcess, message);
                    stopProgressRenderer();
                    flushCapturedOutput(output, processDefinition, prefixOutput);
                    if (!buildSpinner && !options.progressRenderer) {
                        writeBuildStatus(processDefinition, prefixOutput, message, process.stderr);
                    }
                    stopChildren();
                } else if (firstNonZeroExitCode === 0) {
                    const message = pc.green(
                        `Built ${getBuildProcessLabel(processDefinition)} successfully in ${formatDuration(
                            startedAt,
                        )}.`,
                    );
                    stopBuildSpinner(buildSpinner, message);
                    options.progressRenderer?.complete(buildProcess);
                    if (!buildSpinner && !options.progressRenderer) {
                        writeBuildStatus(processDefinition, prefixOutput, message);
                    }
                }
                if (remainingChildren === 0) {
                    stopProgressRenderer();
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
    return !prefixOutput && processDefinition.captureOutput;
}

function shouldUseProgress(options: BuildOptions): boolean {
    return !options.noProgress && process.stdout.isTTY === true && process.env.CI !== 'true';
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

function flushCapturedOutput(
    output: CapturedBuildOutput | undefined,
    processDefinition: BuildProcessDefinition,
    prefixOutput: boolean,
) {
    if (!output) {
        return;
    }
    if (output.stdout.length) {
        writeCapturedOutput(output.stdout, process.stdout, processDefinition, prefixOutput);
    }
    if (output.stderr.length) {
        writeCapturedOutput(output.stderr, process.stderr, processDefinition, prefixOutput);
    }
}

function writeCapturedOutput(
    output: string,
    stream: NodeJS.WriteStream,
    processDefinition: BuildProcessDefinition,
    prefixOutput: boolean,
) {
    if (!prefixOutput) {
        stream.write(output);
        return;
    }

    const prefix = getBuildProcessPrefix(processDefinition);
    for (const line of output.split(/\r?\n/)) {
        if (line.length) {
            stream.write(`${prefix} ${line}\n`);
        }
    }
}

function writeBuildStatus(
    processDefinition: BuildProcessDefinition,
    prefixOutput: boolean,
    message: string,
    output: NodeJS.WriteStream = process.stdout,
) {
    const prefix = getBuildProcessPrefix(processDefinition);
    output.write(prefixOutput ? `${prefix} ${message}\n` : `${message}\n`);
}

function getBuildProcessLabel(processDefinition: BuildProcessDefinition): string {
    return processDefinition.displayLabel ?? processDefinition.target;
}

function getBuildProcessPrefix(processDefinition: BuildProcessDefinition): string {
    return processDefinition.color(`[${processDefinition.prefixLabel ?? processDefinition.target}]`);
}

function createBuildProgressRenderer(output: NodeJS.WriteStream = process.stdout): BuildProgressRenderer {
    const frames = ['-', '\\', '|', '/'];
    const isInteractive = output.isTTY === true;
    const items = new Map<RunningBuildProcess, BuildProgressItem>();
    let frameIndex = 0;
    let interval: ReturnType<typeof setInterval> | undefined;
    let renderedLines = 0;
    let stopped = false;

    const render = () => {
        if (!isInteractive || stopped) {
            return;
        }
        const lines = Array.from(items.values()).map(item =>
            formatBuildProgressLine(item, frames[frameIndex % frames.length]),
        );
        frameIndex++;
        if (renderedLines > 0) {
            output.write(`\x1b[${renderedLines}A`);
        }
        for (const line of lines) {
            output.write(`\x1b[2K\r${line}\n`);
        }
        renderedLines = lines.length;
    };

    return {
        start(buildProcesses) {
            for (const buildProcess of buildProcesses) {
                items.set(buildProcess, {
                    buildProcess,
                    status: 'running',
                    startedAt: buildProcess.startedAt,
                });
            }
            if (isInteractive) {
                output.write('\x1b[?25l');
                render();
                interval = setInterval(render, 100);
            } else {
                for (const item of items.values()) {
                    output.write(`${formatBuildProgressStartLine(item)}\n`);
                }
            }
        },
        complete(buildProcess) {
            const item = items.get(buildProcess);
            if (!item || item.status !== 'running') {
                return;
            }
            item.status = 'success';
            item.finishedAt = Date.now();
            if (isInteractive) {
                render();
            } else {
                output.write(`${formatBuildProgressLine(item, '')}\n`);
            }
        },
        fail(buildProcess, message) {
            const item = items.get(buildProcess);
            if (!item || item.status === 'failure') {
                return;
            }
            item.status = 'failure';
            item.finishedAt = Date.now();
            item.message = message;
            if (isInteractive) {
                render();
            } else {
                output.write(`${formatBuildProgressLine(item, '')}\n`);
            }
        },
        stop() {
            if (stopped) {
                return;
            }
            stopped = true;
            if (interval) {
                clearInterval(interval);
            }
            if (isInteractive) {
                const lines = Array.from(items.values()).map(item => formatBuildProgressLine(item, ''));
                if (renderedLines > 0) {
                    output.write(`\x1b[${renderedLines}A`);
                }
                for (const line of lines) {
                    output.write(`\x1b[2K\r${line}\n`);
                }
                output.write('\x1b[?25h');
            }
        },
    };
}

interface BuildProgressItem {
    buildProcess: RunningBuildProcess;
    status: 'running' | 'success' | 'failure';
    startedAt: number;
    finishedAt?: number;
    message?: string;
}

function formatBuildProgressStartLine(item: BuildProgressItem): string {
    const { processDefinition } = item.buildProcess;
    return `${getBuildProcessPrefix(processDefinition)} Building ${getBuildProcessLabel(
        processDefinition,
    )} with ${processDefinition.binName}...`;
}

function formatBuildProgressLine(item: BuildProgressItem, frame: string): string {
    const { processDefinition } = item.buildProcess;
    const label = getBuildProcessLabel(processDefinition);
    const elapsed = pc.dim(`(${formatDuration(item.startedAt, item.finishedAt)})`);
    const prefix = getBuildProcessPrefix(processDefinition);

    if (item.status === 'success') {
        return `${prefix} ${pc.green('OK')} Built ${label} with ${processDefinition.binName} ${elapsed}`;
    }
    if (item.status === 'failure') {
        return `${prefix} ${pc.red('ERR')} Failed to build ${label} with ${processDefinition.binName} ${elapsed}`;
    }
    return `${prefix} ${frame} Building ${label} with ${processDefinition.binName} ${elapsed}`;
}

function formatDuration(startedAt: number, finishedAt: number = Date.now()): string {
    const duration = finishedAt - startedAt;
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
