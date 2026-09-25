# tenki-benchmark

Repeatable build benchmarks for [Tenki](https://tenki.cloud) GitHub Actions runners.

Every run builds the same pinned workloads with cold caches, measures each job through the GitHub Jobs API, and opens a pull request with the results. Nothing is published until someone merges that pull request.

## What runs

| Workload  | What it does                                                                                                                                                 |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `ripgrep` | `cargo build --release --locked` of ripgrep 15.2.0 with Rust 1.98.1 and an empty crate registry.                                                             |
| `docker`  | `docker build --no-cache` of `workloads/docker`, with base images pinned by digest.                                                                          |
| `citrea`  | citrea v2.8.0's own CI build (`make build` with mold and risc0 3.0.3), including the RISC Zero guest programs.                                               |
| `n8n`     | n8n 2.40.6's own CI build (`pnpm install --frozen-lockfile` and `pnpm build` with Node 26.5.1 and pnpm 12.3.4), with an empty pnpm store and no turbo cache. |

"Cold" means the workflow uses no cache of its own. Downloads still go through the cache proxy that every Tenki runner uses by default, for example the `tenki-proxy` crate registry. The n8n workload leaves out SafeChain, the supply-chain scanner that n8n's CI puts in front of pnpm.

Each workload runs 5 times on `tenki-standard-medium-4c-8g` and `tenki-standard-large-8c-16g`, 4 jobs at a time.

## What is measured

- **Time**: the job's `started_at → completed_at`. Queue time is stored separately, measured from when a `max-parallel` slot was free to `started_at`.
- **Cost**: whole seconds × the list rate per minute in `config.json`, which is how Tenki bills.
- **Steps**: the duration of every step, so a change can be traced to download or compile time.
- **Runner**: CPU model, core count and runner name for every sample.

Each cell reports the median, min, max, p90 and coefficient of variation (CV). A cell whose CV is above `stats.noiseCv` (10%) is marked noisy and should not be published. `stats.noiseCvByWorkload` raises the limit to 15% for `ripgrep` and `docker`, which take about 20 s, so a 2–3 s difference between runner CPUs moves their CV a lot.

The pull request also compares every median with the last 8 runs. A cell is marked as a possible regression when its median is above that range in two runs in a row. The comparison starts after 4 runs.

## Run it

1. Install the Tenki GitHub App on this repository.
2. In **Settings → Actions → General**, turn on **Allow GitHub Actions to create and approve pull requests**.
3. Start the **Benchmark** workflow from the Actions tab.

## Results

- `results/<date>-<run-id>-<attempt>.json`: one file per run, with every sample and cell.
- `results/latest.json`: a copy of the newest run.

## Develop

```bash
npm test
```
