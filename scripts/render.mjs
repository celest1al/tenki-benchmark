const fmtSeconds = (s) => {
  if (s === null) return "—";
  const m = Math.floor(s / 60);
  const rest = Math.round(s - m * 60);
  return m ? `${m}m ${rest}s` : `${rest}s`;
};
const fmtUsd = (v) => (v === null ? "—" : `$${v.toFixed(5)}`);

function fmtComparison(c) {
  if (c.status === "insufficient") return `baseline: not enough runs (${c.baselineRuns}/${c.minRuns})`;
  const range = `${fmtSeconds(c.baselineMin)}–${fmtSeconds(c.baselineMax)}`;
  if (c.possibleRegression) return `⚠️ possible regression (above ${range} twice in a row)`;
  return `${c.status} baseline ${range}`;
}

export function render(result) {
  const lines = [
    `## Runner benchmark — ${result.createdAt.slice(0, 10)}`,
    "",
    `Run: ${result.runUrl} · commit \`${result.commit.slice(0, 7)}\` · pricing: ${result.pricing.source}`,
    "",
    "| Workload | Size | OK | Median | Min | Max | p90 | CV | Cost (median) | Queue (median) | Baseline |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
  ];
  for (const c of result.cells) {
    const cvText = c.cv === null ? "—" : `${(c.cv * 100).toFixed(1)}%${c.noisy ? " ⚠️ noisy" : ""}`;
    lines.push(
      `| ${c.workload} | ${c.size} | ${c.succeeded}/${c.samples} | ${fmtSeconds(c.medianSeconds)} | ${fmtSeconds(c.minSeconds)} | ${fmtSeconds(c.maxSeconds)} | ${fmtSeconds(c.p90Seconds)} | ${cvText} | ${fmtUsd(c.medianCostUsd)} | ${fmtSeconds(c.medianQueueSeconds)} | ${fmtComparison(c.comparison)} |`,
    );
  }
  lines.push("", "Noisy results (CV above the threshold) should not be published.");
  return lines.join("\n") + "\n";
}
