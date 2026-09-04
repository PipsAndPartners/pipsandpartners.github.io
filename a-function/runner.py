"""Starts an Apify actor run and polls it live until it finishes."""

import time
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
