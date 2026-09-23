// GitHub creates every matrix job when the run starts, so created_at → started_at also counts
// the wait for a max-parallel slot. Measure queue time from when a slot was free instead.
export function queueSeconds(jobs, maxParallel) {
  const t = (s) => (s ? Date.parse(s) : null);
  const completions = jobs
    .map((j) => t(j.completed_at))
    .filter((c) => c !== null)
    .sort((a, b) => a - b);
  const started = jobs.filter((j) => t(j.started_at) !== null).sort((a, b) => t(a.started_at) - t(b.started_at));

  const result = new Map();
  started.forEach((job, i) => {
    const slotFree = i < maxParallel ? t(job.created_at) : Math.max(t(job.created_at), completions[i - maxParallel]);
    result.set(job.id, Math.max(0, (t(job.started_at) - slotFree) / 1000));
  });
  return result;
}
