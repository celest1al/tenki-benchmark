import { test } from "node:test";
import assert from "node:assert/strict";
import { queueSeconds } from "./queue.mjs";

const at = (s) => new Date(Date.UTC(2026, 8, 23, 12, 0, s)).toISOString();
const job = (id, started, completed) => ({
  id,
  created_at: at(0),
  started_at: started === null ? null : at(started),
  completed_at: completed === null ? null : at(completed),
});

test("first round waits only for a runner", () => {
  const q = queueSeconds([job(1, 3, 20), job(2, 5, 25)], 2);
  assert.equal(q.get(1), 3);
  assert.equal(q.get(2), 5);
});

test("later rounds are measured from when a slot was free", () => {
  // Slots free at 20 and 25; job 3 starts at 22, job 4 at 30.
  const q = queueSeconds([job(1, 3, 20), job(2, 5, 25), job(3, 22, 40), job(4, 30, 50)], 2);
  assert.equal(q.get(3), 2);
  assert.equal(q.get(4), 5);
});

test("jobs that never started have no queue time", () => {
  const q = queueSeconds([job(1, 3, 20), job(2, null, null)], 1);
  assert.equal(q.has(2), false);
});
