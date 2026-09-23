// Builds one result file from the current workflow run's bench jobs.
import { readFileSync, readdirSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { summarize } from "./stats.mjs";
import { compare } from "./compare.mjs";
import { render } from "./render.mjs";
import { queueSeconds } from "./queue.mjs";

const { GITHUB_TOKEN, GITHUB_REPOSITORY, GITHUB_RUN_ID, GITHUB_RUN_ATTEMPT, GITHUB_SHA, GITHUB_SERVER_URL } =
  process.env;
const META_DIR = process.env.META_DIR ?? "meta";
const RESULTS_DIR = "results";
const config = JSON.parse(readFileSync("config.json", "utf8"));

const seconds = (from, to) => (from && to ? (Date.parse(to) - Date.parse(from)) / 1000 : null);

async function listJobs() {
  const jobs = [];
  for (let page = 1; ; page++) {
    const url = `https://api.github.com/repos/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}/attempts/${GITHUB_RUN_ATTEMPT}/jobs?per_page=100&page=${page}`;
    const res = await fetch(url, {
      headers: { authorization: `Bearer ${GITHUB_TOKEN}`, accept: "application/vnd.github+json" },
    });
    if (!res.ok) throw new Error(`jobs API ${res.status}: ${await res.text()}`);
    const body = await res.json();
    jobs.push(...body.jobs);
    if (jobs.length >= body.total_count || body.jobs.length === 0) return jobs;
  }
}

function readMeta(workload, size, sample) {
  const file = join(META_DIR, `${workload}__${size}__${sample}.json`);
  return existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : null;
}

function toSample(job, queue) {
  // Job names are "bench / <workload> / <size> / <sample>", set in benchmark.yml.
  const [, workload, size, sample] = job.name.split(" / ");
  const durationSeconds = seconds(job.started_at, job.completed_at);
  const rate = config.pricing.ratesPerMinuteUsd[size];
  const meta = readMeta(workload, size, sample);
  return {
    provider: "tenki",
    cache: "cold",
    workload,
    size,
    sample: Number(sample),
    status: job.conclusion,
    jobUrl: job.html_url,
    queueSeconds: queue.get(job.id) ?? null,
    durationSeconds,
    // Tenki bills whole seconds of started_at → completed_at, truncated.
    costUsd: durationSeconds === null || rate === undefined ? null : (Math.floor(durationSeconds) * rate) / 60,
    steps: (job.steps ?? []).map((s) => ({
      name: s.name,
      conclusion: s.conclusion,
      durationSeconds: seconds(s.started_at, s.completed_at),
    })),
    runnerName: meta?.runnerName ?? job.runner_name ?? null,
    cpuModel: meta?.cpuModel ?? null,
    cpus: meta?.cpus ?? null,
  };
}

function readHistory() {
  if (!existsSync(RESULTS_DIR)) return [];
  return readdirSync(RESULTS_DIR)
    .filter((f) => f.endsWith(".json") && f !== "latest.json")
    .map((f) => JSON.parse(readFileSync(join(RESULTS_DIR, f), "utf8")))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

const jobs = (await listJobs()).filter((j) => j.name.startsWith("bench / "));
if (jobs.length === 0) throw new Error("no bench jobs found in this run");

const queue = queueSeconds(jobs, config.maxParallel);
const samples = jobs
  .map((j) => toSample(j, queue))
  .sort((a, b) => `${a.workload}${a.size}${a.sample}`.localeCompare(`${b.workload}${b.size}${b.sample}`));
const cells = compare(summarize(samples, config.stats), readHistory(), config.baseline);

const createdAt = new Date().toISOString();
const result = {
  schemaVersion: 1,
  createdAt,
  runId: Number(GITHUB_RUN_ID),
  runAttempt: Number(GITHUB_RUN_ATTEMPT),
  runUrl: `${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}`,
  commit: GITHUB_SHA,
  pricing: config.pricing,
  cells,
  samples,
};

mkdirSync(RESULTS_DIR, { recursive: true });
const name = `${createdAt.slice(0, 10)}-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}.json`;
writeFileSync(join(RESULTS_DIR, name), JSON.stringify(result, null, 2) + "\n");
writeFileSync(join(RESULTS_DIR, "latest.json"), JSON.stringify(result, null, 2) + "\n");
writeFileSync("summary.md", render(result));
console.log(`wrote ${RESULTS_DIR}/${name}`);
