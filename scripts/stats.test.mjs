import { test } from "node:test";
import assert from "node:assert/strict";
import { cv, median, quantile, summarize } from "./stats.mjs";

const sample = (over) => ({
  provider: "tenki",
  cache: "cold",
  workload: "ripgrep",
  size: "tenki-standard-medium-4c-8g",
  status: "success",
  durationSeconds: 60,
  costUsd: 0.008,
  queueSeconds: 2,
  ...over,
});

test("median and quantile interpolate", () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([1, 2, 3, 4]), 2.5);
  assert.equal(quantile([10, 20, 30, 40, 50], 0.9), 46);
  assert.equal(median([]), null);
});

test("cv is population stdev over mean", () => {
  assert.equal(cv([5, 5, 5]), 0);
  assert.equal(cv([1]), null);
  assert.ok(Math.abs(cv([90, 110]) - 0.1) < 1e-12);
});

test("summarize ignores failed samples and flags noise", () => {
  const [cell] = summarize(
    [
      sample({ durationSeconds: 60 }),
      sample({ durationSeconds: 62 }),
      sample({ durationSeconds: 100 }),
      sample({ status: "failure", durationSeconds: 5 }),
    ],
    { noiseCv: 0.1 },
  );
  assert.equal(cell.samples, 4);
  assert.equal(cell.succeeded, 3);
  assert.equal(cell.medianSeconds, 62);
  assert.equal(cell.minSeconds, 60);
  assert.equal(cell.maxSeconds, 100);
  assert.equal(cell.noisy, true);
});

test("summarize splits cells by workload and size", () => {
  const cells = summarize(
    [sample({}), sample({ size: "tenki-standard-large-8c-16g" }), sample({ workload: "docker" })],
    { noiseCv: 0.1 },
  );
  assert.equal(cells.length, 3);
});

test("a cell where every sample failed has no median", () => {
  const [cell] = summarize([sample({ status: "failure" })], { noiseCv: 0.1 });
  assert.equal(cell.medianSeconds, null);
  assert.equal(cell.cv, null);
  assert.equal(cell.noisy, false);
});

test("a workload can override the noise threshold", () => {
  const spread = [sample({ durationSeconds: 26 }), sample({ durationSeconds: 34 })];
  const stats = { noiseCv: 0.1, noiseCvByWorkload: { ripgrep: 0.15 } };
  const [ripgrep] = summarize(spread, stats);
  const [citrea] = summarize(
    spread.map((s) => ({ ...s, workload: "citrea" })),
    stats,
  );
  assert.equal(ripgrep.noisy, false);
  assert.equal(citrea.noisy, true);
});
