"""One-time: build a Daytona snapshot with Chromium pre-installed.

Detonation currently spends ~45s installing Chromium in a fresh sandbox every
run. Baking it into a named snapshot once means each later detonation just boots
from the snapshot (~5-10s) — fast enough to run live on stage.

Run once:  .venv/bin/python build_snapshot.py
Idempotent: skips if the snapshot already exists.
"""
import sys

from dotenv import load_dotenv

load_dotenv()

from daytona import Daytona, Image, CreateSnapshotParams

try:
    from daytona import Resources
except Exception:
    Resources = None

SNAPSHOT_NAME = "jaga-detonator"


def _existing_names(d) -> set:
    res = d.snapshot.list()
    items = getattr(res, "items", res)
    return {getattr(s, "name", None) for s in items}


def main() -> None:
    d = Daytona()
    try:
        if SNAPSHOT_NAME in _existing_names(d):
            print(f"snapshot '{SNAPSHOT_NAME}' already exists — nothing to build")
            return
    except Exception as exc:
        print(f"(could not list snapshots: {exc!r})", file=sys.stderr)

    image = (
        Image.debian_slim(python_version="3.12")
        .pip_install("playwright")
        .run_commands("playwright install --with-deps chromium")
    )
    kwargs = {"name": SNAPSHOT_NAME, "image": image}
    if Resources is not None:
        try:
            kwargs["resources"] = Resources(cpu=2, memory=4, disk=8)
        except Exception:
            pass

    print(f"building snapshot '{SNAPSHOT_NAME}' — one-time, a few minutes…", flush=True)
    d.snapshot.create(
        CreateSnapshotParams(**kwargs),
        on_logs=lambda m: print("  " + str(m), flush=True),
    )
    print(f"snapshot '{SNAPSHOT_NAME}' built ✓", flush=True)


if __name__ == "__main__":
    main()
