import type { MockInstance } from 'vitest';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { performance } from 'perf_hooks';
import { stall } from './stall.js';

let performanceNowSpy: MockInstance;

beforeEach(() => {
	vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
	performanceNowSpy = vi.spyOn(performance, 'now').mockReturnValue(0);
});

afterEach(() => {
	vi.useRealTimers();
	vi.restoreAllMocks();
});

const STALL_TIME = 100;

test('does not stall if elapsed time has already past the stall time', () => {
	const startTime = performance.now();

	// intentionally advance past the stall time first
	performanceNowSpy.mockReturnValueOnce(1000);

	stall(STALL_TIME, startTime);

	expect(vi.getTimerCount()).toBe(0);
});

test('should stall for a set amount of time', () => {
	const startTime = performance.now();

	stall(STALL_TIME, startTime);

	expect(vi.getTimerCount()).toBe(1);

	vi.advanceTimersByTime(STALL_TIME);

	expect(vi.getTimerCount()).toBe(0);
});
