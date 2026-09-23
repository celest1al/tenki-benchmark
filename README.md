# tenki-benchmark

Repeatable build benchmarks for [Tenki](https://tenki.cloud) GitHub Actions runners.

Every run builds the same pinned workloads with cold caches, measures each job through the GitHub Jobs API, and opens a pull request with the results. Nothing is published until someone merges that pull request.

## What runs

| Workload  | What it does                                                                                     |
| --------- | ------------------------------------------------------------------------------------------------ |
| `ripgrep` | `cargo build --release --locked` of ripgrep 15.2.0 with Rust 1.98.1 and an empty crate registry. |
| `docker`  | `docker build --no-cache` of `workloads/docker`, with base images pinned by digest.              |

Each workload runs 5 times on `tenki-standard-medium-4c-8g` and `tenki-standard-large-8c-16g`, 4 jobs at a time.

## What is measured

- **Time**: the job's `started_at → completed_at`. Queue time (`created_at → started_at`) is stored separately.
- **Cost**: whole seconds × the list rate per minute in `config.json`, which is how Tenki bills.
- **Steps**: the duration of every step, so a change can be traced to download or compile time.
- **Runner**: CPU model, core count and runner name for every sample.

Each cell reports the median, min, max, p90 and coefficient of variation (CV). A cell whose CV is above `stats.noiseCv` is marked noisy and should not be published.

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
