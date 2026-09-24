export function quantile(values, q) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

export const median = (values) => quantile(values, 0.5);

// Coefficient of variation: population stdev / mean.
export function cv(values) {
  if (values.length < 2) return null;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  if (mean === 0) return 0;
  const variance = values.reduce((a, v) => a + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance) / mean;
}

export const cellKey = (s) => [s.provider, s.cache, s.workload, s.size].join("|");

export function summarize(samples, { noiseCv, noiseCvByWorkload = {} }) {
  const cells = new Map();
  for (const s of samples) {
    if (!cells.has(cellKey(s))) cells.set(cellKey(s), []);
    cells.get(cellKey(s)).push(s);
  }
  return [...cells.values()].map((group) => {
    const ok = group.filter((s) => s.status === "success");
    const durations = ok.map((s) => s.durationSeconds);
    const spread = cv(durations);
    const { provider, cache, workload, size } = group[0];
    return {
      provider,
      cache,
      workload,
      size,
      samples: group.length,
      succeeded: ok.length,
      medianSeconds: median(durations),
      minSeconds: durations.length ? Math.min(...durations) : null,
      maxSeconds: durations.length ? Math.max(...durations) : null,
      p90Seconds: quantile(durations, 0.9),
      cv: spread,
      noisy: spread !== null && spread > (noiseCvByWorkload[workload] ?? noiseCv),
      medianCostUsd: median(ok.map((s) => s.costUsd)),
      medianQueueSeconds: median(ok.map((s) => s.queueSeconds)),
    };
  });
}
