"""Starts an Apify actor run and polls it live until it finishes."""

import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Callable

from apify_client import ApifyClient

TERMINAL_STATUSES = {"SUCCEEDED", "FAILED", "ABORTED", "TIMED-OUT"}


def run_actor_live(
    client: ApifyClient,
    platform_name: str,
    actor_id: str,
    run_input: dict,
    poll_seconds: float = 5.0,
    on_progress: Callable[[str, int], None] | None = None,
) -> list[dict]:
    """Start an actor run and poll it while it's still executing.

    Rather than blocking on `.call()` until the whole run finishes, this starts
    the run, then repeatedly checks the run status and dataset item count so
    you can see profiles arrive in near real-time before the run completes.
    `on_progress(status, item_count)`, if given, fires on every status/count change.
    """
    actor_client = client.actor(actor_id)
    run = actor_client.start(run_input=run_input)
    run_id = run.id
    dataset_client = client.dataset(run.default_dataset_id)
    print(f"[{platform_name}] started run {run_id} (actor {actor_id})")

    status = run.status
    last_seen = -1
    while status not in TERMINAL_STATUSES:
        item_count = dataset_client.get().item_count
        if item_count != last_seen:
            print(f"[{platform_name}] {status} - {item_count} items scraped so far")
            if on_progress:
                on_progress(status, item_count)
            last_seen = item_count
        time.sleep(poll_seconds)
        run = client.run(run_id).get()
        status = run.status

    if status != "SUCCEEDED":
        raise RuntimeError(f"[{platform_name}] run {run_id} ended with status={status}")

    items = list(dataset_client.iterate_items())
    print(f"[{platform_name}] finished - {len(items)} items")
    return items


def run_actor_parallel(
    jobs: list[dict],
    poll_seconds: float = 5.0,
    tokens: list[str] | None = None,
) -> list[dict]:
    """Run several actor jobs at once, spread across all Apify tokens.

    Each job is a dict: {"platform", "actor_id", "run_input"} (optionally "token"
    to pin a specific one). Jobs are handed out round-robin across the token pool,
    with at most one concurrent run per token, so four free accounts do four runs
    in the time one account would do one -- while each stays within its own limits.

    Returns a list aligned with `jobs`: {"platform", "items"} on success or
    {"platform", "error"} on failure (one bad job never sinks the others).
    """
    from apify_config import TokenPool  # local import: avoid import cycle

    toks = TokenPool(tokens).tokens
    results: list[dict] = [{} for _ in jobs]

    def _one(idx: int, job: dict) -> tuple[int, dict]:
        token = job.get("token") or toks[idx % len(toks)]
        try:
            items = run_actor_live(
                ApifyClient(token), job["platform"], job["actor_id"], job["run_input"], poll_seconds
            )
            return idx, {"platform": job["platform"], "items": items}
        except Exception as exc:  # noqa: BLE001 - report per-job, keep the rest
            return idx, {"platform": job["platform"], "error": repr(exc)}

    with ThreadPoolExecutor(max_workers=len(toks)) as pool:
        futures = [pool.submit(_one, i, job) for i, job in enumerate(jobs)]
        for future in as_completed(futures):
            idx, res = future.result()
            results[idx] = res
    return results
