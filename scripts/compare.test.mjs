import { test } from "node:test";
import assert from "node:assert/strict";
import { compare } from "./compare.mjs";

const opts = { window: 8, minRuns: 4 };
const cell = (medianSeconds, comparison) => ({
  provider: "tenki",
  cache: "cold",
  workload: "ripgrep",
  size: "tenki-standard-medium-4c-8g",
  medianSeconds,
  ...(comparison && { comparison }),
});
const run = (medianSeconds, status = "within") => ({ cells: [cell(medianSeconds, { status })] });

test("reports insufficient baseline until minRuns earlier runs exist", () => {
  const [c] = compare([cell(60)], [run(60), run(61), run(62)], opts);
  assert.deepEqual(c.comparison, { status: "insufficient", baselineRuns: 3, minRuns: 4 });
});

test("within, above and below the baseline range", () => {
  const history = [run(58), run(60), run(61), run(62)];
  assert.equal(compare([cell(60)], history, opts)[0].comparison.status, "within");
  assert.equal(compare([cell(70)], history, opts)[0].comparison.status, "above");
  assert.equal(compare([cell(50)], history, opts)[0].comparison.status, "below");
});

test("one run above the range is not yet a possible regression", () => {
  const [c] = compare([cell(70)], [run(58), run(60), run(61), run(62)], opts);
  assert.equal(c.comparison.possibleRegression, false);
});

test("two runs in a row above the range is a possible regression", () => {
  const [c] = compare([cell(70)], [run(58), run(60), run(61), run(62), run(69, "above")], opts);
  assert.equal(c.comparison.status, "above");
  assert.equal(c.comparison.possibleRegression, true);
});

test("baseline uses only the last `window` runs", () => {
  const history = [run(1000), run(60), run(60), run(60), run(60)];
  const [c] = compare([cell(100)], history, { window: 4, minRuns: 4 });
  assert.equal(c.comparison.baselineMax, 60);
  assert.equal(c.comparison.status, "above");
});

test("cells missing from a run or with no median are skipped in the baseline", () => {
  const other = { cells: [{ ...cell(60), workload: "docker" }] };
  const history = [run(60), other, run(null), run(61), run(62)];
  const [c] = compare([cell(60)], history, opts);
  assert.equal(c.comparison.status, "insufficient");
  assert.equal(c.comparison.baselineRuns, 3);
});
