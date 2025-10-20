import { describe, expect, it } from 'vitest';
import { formatDuration, formatDurationLabel } from './time';

describe('time utilities', () => {
  it('formats durations consistently', () => {
    expect(formatDuration(0)).toBe('0ms');
    expect(formatDuration(500)).toBe('500ms');
    expect(formatDuration(1500)).toBe('1.5s');
    expect(formatDuration(12500)).toBe('13s');
    expect(formatDuration(60000)).toBe('1m');
    expect(formatDuration(90500)).toBe('1m 31s');
  });

  it('shares the same implementation for label formatting', () => {
    expect(formatDurationLabel(61000)).toBe(formatDuration(61000));
  });
});

