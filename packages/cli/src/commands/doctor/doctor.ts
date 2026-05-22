import { log } from '@clack/prompts';

import { runProjectCheck } from './checks/project-check';
import { formatConsoleReport } from './formatters/console-formatter';
import { formatJsonReport } from './formatters/json-formatter';
import { CheckResult, DoctorOptions, DoctorReport } from './types';

const ALL_CHECKS = ['project', 'dependencies', 'config', 'schema', 'database'] as const;

/**
 * Entry point for the `vendure doctor` command.
 * Runs diagnostic checks on a Vendure project and reports results.
 */
export async function doctorCommand(options?: DoctorOptions) {
    const checksToRun = resolveChecks(options?.check);

    const results: CheckResult[] = [];

    // Check 1: Project detection & config discovery
    if (checksToRun.includes('project')) {
        const projectResult = await runProjectCheck(options?.config);
        results.push(projectResult);

        // If project check fails, skip remaining checks that depend on it
        if (projectResult.status === 'fail' && checksToRun.length > 1) {
            for (const check of checksToRun.filter(c => c !== 'project')) {
                results.push({
                    name: capitalize(check),
                    status: 'skip',
                    message: 'Skipped due to project check failure',
                });
            }
            outputReport(buildReport(results, options), options);
            return;
        }
    }

    // Future checks (2-5) will be added here as they are implemented.
    // Each check will follow the same pattern:
    //   if (checksToRun.includes('checkName')) {
    //       results.push(await runCheckName(...));
    //   }

    outputReport(buildReport(results, options), options);
}

function resolveChecks(checkFlags?: string[]): string[] {
    if (!checkFlags || checkFlags.length === 0) {
        return [...ALL_CHECKS];
    }
    const valid = checkFlags.filter(c => (ALL_CHECKS as readonly string[]).includes(c));
    const invalid = checkFlags.filter(c => !(ALL_CHECKS as readonly string[]).includes(c));
    if (invalid.length > 0) {
        log.warn(`Unknown check(s): ${invalid.join(', ')}. Valid checks: ${ALL_CHECKS.join(', ')}`);
    }
    return valid.length > 0 ? valid : [...ALL_CHECKS];
}

function buildReport(checks: CheckResult[], options?: DoctorOptions): DoctorReport {
    const hasFail = checks.some(c => c.status === 'fail');
    const hasWarn = checks.some(c => c.status === 'warn');
    const overallStatus = hasFail || (options?.strict && hasWarn) ? 'failed' : 'passed';

    return {
        nodeVersion: process.version,
        checks,
        overallStatus,
    };
}

function outputReport(report: DoctorReport, options?: DoctorOptions): void {
    if (options?.format === 'json') {
        formatJsonReport(report);
    } else {
        formatConsoleReport(report);
    }

    if (report.overallStatus === 'failed') {
        process.exit(1);
    }
}

function capitalize(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
}
