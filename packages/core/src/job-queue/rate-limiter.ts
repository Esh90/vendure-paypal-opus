/**
 * @description
 * Parses a duration that is either a number (ms) or a shorthand string like
 * `'500ms'`, `'30s'`, `'5m'`, `'1h'`, `'2d'`, and returns the equivalent in
 * milliseconds.
 *
 * Throws an Error if the input is a string that does not match the expected
 * format.
 *
 * @docsCategory JobQueue
 */
export function parseDuration(d: number | string): number {
    if (typeof d === 'number') {
        if (!Number.isFinite(d) || d < 0) {
            throw new Error(`Invalid duration: ${d}`);
        }
        return d;
    }
    const match = /^(\d+)(ms|s|m|h|d)$/.exec(d.trim());
    if (!match) {
        throw new Error(`Invalid duration: "${d}". Expected e.g. '500ms', '30s', '5m', '1h', '2d'.`);
    }
    const value = Number(match[1]);
    const unit = match[2];
    const multipliers: Record<string, number> = {
        ms: 1,
        s: 1_000,
        m: 60_000,
        h: 3_600_000,
        d: 86_400_000,
    };
    return value * multipliers[unit];
}

/**
 * @description
 * A simple sliding-window rate limiter used by the polling job queue strategies
 * to enforce a per-queue rate limit within a single Vendure worker process.
 *
 * This limiter is intentionally local (in-memory) — the SQL strategy layers an
 * additional cross-worker check on top to coordinate between horizontally-scaled
 * workers.
 *
 * @docsCategory JobQueue
 */
export class LocalRateLimiter {
    private timestamps: number[] = [];

    constructor(
        readonly max: number,
        readonly durationMs: number,
    ) {
        if (!Number.isFinite(max) || max <= 0) {
            throw new Error(`LocalRateLimiter: "max" must be a positive number, got ${max}`);
        }
        if (!Number.isFinite(durationMs) || durationMs <= 0) {
            throw new Error(`LocalRateLimiter: "durationMs" must be a positive number, got ${durationMs}`);
        }
    }

    /**
     * @description
     * Returns `0` if a new job can be started immediately, otherwise returns the
     * number of milliseconds the caller should wait before the next slot becomes
     * available.
     */
    check(now: number = Date.now()): number {
        this.prune(now);
        if (this.timestamps.length < this.max) {
            return 0;
        }
        // this.timestamps[0] is guaranteed to exist because length >= max >= 1
        const oldest = this.timestamps[0];
        return Math.max(0, oldest + this.durationMs - now);
    }

    /**
     * @description
     * Records that a job has been dispatched at the given timestamp. Callers
     * should invoke this immediately after a successful `check()`.
     */
    record(now: number = Date.now()): void {
        this.timestamps.push(now);
    }

    private prune(now: number): void {
        const cutoff = now - this.durationMs;
        while (this.timestamps.length > 0 && this.timestamps[0] <= cutoff) {
            this.timestamps.shift();
        }
    }
}
