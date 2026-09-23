import { cellKey } from "./stats.mjs";

// history: earlier results, oldest first. Mutates nothing; returns cells with a `comparison` field.
export function compare(cells, history, { window, minRuns }) {
  return cells.map((cell) => {
    const key = cellKey(cell);
    const previous = history
      .map((r) => r.cells.find((c) => cellKey(c) === key))
      .filter((c) => c && c.medianSeconds !== null);
    const baseline = previous.slice(-window).map((c) => c.medianSeconds);

    if (cell.medianSeconds === null || baseline.length < minRuns) {
      return { ...cell, comparison: { status: "insufficient", baselineRuns: baseline.length, minRuns } };
    }

    const min = Math.min(...baseline);
    const max = Math.max(...baseline);
    const status = cell.medianSeconds > max ? "above" : cell.medianSeconds < min ? "below" : "within";
    const last = previous.at(-1)?.comparison?.status;
    return {
      ...cell,
      comparison: {
        status,
        baselineRuns: baseline.length,
        baselineMin: min,
        baselineMax: max,
        possibleRegression: status === "above" && last === "above",
      },
    };
  });
}
