export function formatDuration(ms: number): string {
  const clamped = Math.max(0, ms);
  if (clamped >= 60000) {
    const minutes = Math.floor(clamped / 60000);
    const seconds = Math.round((clamped % 60000) / 1000);
    if (seconds === 0) {
      return `${minutes}m`;
    }
    return `${minutes}m ${seconds}s`;
  }
  if (clamped >= 10000) {
    return `${Math.round(clamped / 1000)}s`;
  }
  if (clamped >= 1000) {
    return `${(clamped / 1000).toFixed(1)}s`;
  }
  return `${clamped}ms`;
}

export function formatDurationLabel(ms: number): string {
  return formatDuration(ms);
}

