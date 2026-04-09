import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LocalRateLimiter, parseDuration } from './rate-limiter';

describe('parseDuration', () => {
    it('returns a number unchanged', () => {
        expect(parseDuration(0)).toBe(0);
        expect(parseDuration(250)).toBe(250);
        expect(parseDuration(10_000)).toBe(10_000);
    });

    it('throws on a negative or non-finite number', () => {
        expect(() => parseDuration(-1)).toThrow(/Invalid duration/);
        expect(() => parseDuration(Number.NaN)).toThrow(/Invalid duration/);
        expect(() => parseDuration(Number.POSITIVE_INFINITY)).toThrow(/Invalid duration/);
    });

    it('parses millisecond strings', () => {
        expect(parseDuration('0ms')).toBe(0);
        expect(parseDuration('500ms')).toBe(500);
    });

    it('parses second/minute/hour/day strings', () => {
        expect(parseDuration('30s')).toBe(30_000);
        expect(parseDuration('5m')).toBe(5 * 60_000);
        expect(parseDuration('1h')).toBe(3_600_000);
        expect(parseDuration('2d')).toBe(2 * 86_400_000);
    });

    it('trims surrounding whitespace', () => {
        expect(parseDuration('  1h  ')).toBe(3_600_000);
    });

    it('throws on malformed strings', () => {
        expect(() => parseDuration('')).toThrow(/Invalid duration/);
        expect(() => parseDuration('1.5s')).toThrow(/Invalid duration/);
        expect(() => parseDuration('1 hour')).toThrow(/Invalid duration/);
        expect(() => parseDuration('hour')).toThrow(/Invalid duration/);
        expect(() => parseDuration('1000x')).toThrow(/Invalid duration/);
    });
});

describe('LocalRateLimiter', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2024-01-01T00:00:00.000Z'));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('rejects invalid constructor arguments', () => {
        expect(() => new LocalRateLimiter(0, 1000)).toThrow(/positive/);
        expect(() => new LocalRateLimiter(-1, 1000)).toThrow(/positive/);
        expect(() => new LocalRateLimiter(1, 0)).toThrow(/positive/);
        expect(() => new LocalRateLimiter(1, -100)).toThrow(/positive/);
    });

    it('allows up to max calls within the window', () => {
        const limiter = new LocalRateLimiter(3, 1000);

        expect(limiter.check()).toBe(0);
        limiter.record();
        expect(limiter.check()).toBe(0);
        limiter.record();
        expect(limiter.check()).toBe(0);
        limiter.record();

        // 4th call within the same window should be rejected
        expect(limiter.check()).toBeGreaterThan(0);
    });

    it('returns the correct wait time when the window is full', () => {
        const limiter = new LocalRateLimiter(2, 1000);

        limiter.record(Date.now()); // t=0
        vi.advanceTimersByTime(200);
        limiter.record(Date.now()); // t=200

        // Now at t=200, window is full, oldest is at 0 so next slot at 1000
        expect(limiter.check()).toBe(800);
    });

    it('allows new calls once the oldest timestamp falls outside the window', () => {
        const limiter = new LocalRateLimiter(2, 1000);

        limiter.record(Date.now()); // t=0
        limiter.record(Date.now()); // t=0
        expect(limiter.check()).toBe(1000);

        vi.advanceTimersByTime(1001);
        // Old timestamps are now outside the 1s window
        expect(limiter.check()).toBe(0);
    });

    it('prunes stale timestamps on subsequent checks', () => {
        const limiter = new LocalRateLimiter(5, 500);

        for (let i = 0; i < 5; i++) {
            limiter.record(Date.now());
        }
        expect(limiter.check()).toBeGreaterThan(0);

        vi.advanceTimersByTime(600);

        // All old entries should have been pruned
        expect(limiter.check()).toBe(0);
        limiter.record(Date.now());
        expect(limiter.check()).toBe(0);
    });

    it('handles a sliding window with steady traffic', () => {
        const limiter = new LocalRateLimiter(2, 1000);

        limiter.record(Date.now()); // t=0
        vi.advanceTimersByTime(400);
        limiter.record(Date.now()); // t=400
        expect(limiter.check()).toBeGreaterThan(0);

        vi.advanceTimersByTime(601); // t=1001
        // t=0 is now outside the window, t=400 still in
        expect(limiter.check()).toBe(0);
        limiter.record(Date.now()); // t=1001

        // Window now has [400, 1001]; next allowed after 400+1000=1400 -> wait ~399
        const wait = limiter.check();
        expect(wait).toBeGreaterThan(0);
        expect(wait).toBeLessThanOrEqual(400);
    });
});
