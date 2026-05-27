import { spawn, type ChildProcess } from 'node:child_process';
import { describe, expect, it } from 'vitest';

import { waitForChildProcesses } from './cli-process-utils';

describe('cli process utils', () => {
    describe('waitForChildProcesses()', () => {
        it('waits for sibling processes to close after one process exits', async () => {
            const children: ChildProcess[] = [];
            const exitingChild = spawn(process.execPath, ['-e', 'setTimeout(() => process.exit(0), 20);'], {
                stdio: 'ignore',
            });
            const gracefulChild = spawn(
                process.execPath,
                [
                    '-e',
                    [
                        "process.on('SIGTERM', () => setTimeout(() => process.exit(0), 100));",
                        'setInterval(() => undefined, 1000);',
                    ].join('\n'),
                ],
                { stdio: 'ignore' },
            );
            children.push(exitingChild, gracefulChild);
            let gracefulChildClosed = false;
            gracefulChild.once('close', () => {
                gracefulChildClosed = true;
            });

            try {
                await expect(waitForChildProcesses(children)).resolves.toBe(0);
                expect(gracefulChildClosed).toBe(true);
            } finally {
                for (const child of children) {
                    if (child.exitCode === null && child.signalCode === null) {
                        child.kill('SIGKILL');
                    }
                }
            }
        });
    });
});
