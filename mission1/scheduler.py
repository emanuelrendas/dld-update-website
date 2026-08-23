"""
RAIOC Production Scheduler.

Runs periodic outreach cycles on a configurable schedule with concurrency locking
and graceful shutdown.
"""
import argparse
import atexit
import logging
import os
import signal
import sys
import time

# Ensure project root is in sys.path
root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

from run_cycle import run_cycle

logger = logging.getLogger("mission1.scheduler")
LOCK_FILE = os.path.join(root_dir, "raioc_scheduler.lock")
_running = True


def is_pid_running(pid: int) -> bool:
    try:
        os.kill(pid, 0)
        return True
    except (OSError, AttributeError):
        return False


def acquire_lock() -> bool:
    if os.path.exists(LOCK_FILE):
        try:
            with open(LOCK_FILE, "r") as f:
                content = f.read().strip()
                if content:
                    pid = int(content)
                    if is_pid_running(pid):
                        logger.error("Another scheduler process is already running (PID %d). Exiting.", pid)
                        return False
                    else:
                        logger.warning("Removing stale lock file from PID %d", pid)
                        os.remove(LOCK_FILE)
        except Exception:
            pass

    try:
        with open(LOCK_FILE, "w") as f:
            f.write(str(os.getpid()))
        return True
    except Exception as e:
        logger.error("Failed to acquire lock file %s: %s", LOCK_FILE, e)
        return False


def release_lock() -> None:
    if os.path.exists(LOCK_FILE):
        try:
            os.remove(LOCK_FILE)
        except Exception:
            pass


def handle_shutdown(signum, frame):
    global _running
    logger.info("Received termination signal (%s). Shutting down scheduler gracefully...", signum)
    _running = False


def start_scheduler(interval_seconds: int = 3600, run_once: bool = False) -> None:
    global _running
    _running = True
    if not acquire_lock():
        sys.exit(1)

    atexit.register(release_lock)
    try:
        signal.signal(signal.SIGINT, handle_shutdown)
        signal.signal(signal.SIGTERM, handle_shutdown)
    except (ValueError, AttributeError):
        pass

    logger.info("RAIOC Scheduler active. Interval: %d seconds. PID: %d", interval_seconds, os.getpid())

    while _running:
        try:
            logger.info("Triggering scheduled outreach cycle...")
            run_cycle()
        except Exception as e:
            logger.error("Error during cycle execution: %s", e)

        if run_once:
            break

        # Sleep in small slices to respond promptly to shutdown signals
        slept = 0
        while _running and slept < interval_seconds:
            time.sleep(min(5, interval_seconds - slept))
            slept += 5

    logger.info("RAIOC Scheduler stopped.")
    release_lock()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="RAIOC Outreach Scheduler")
    parser.add_argument("--interval", type=int, default=3600, help="Interval in seconds between runs (default: 3600)")
    parser.add_argument("--once", action="store_true", help="Run once and exit immediately")
    args = parser.parse_args()

    start_scheduler(interval_seconds=args.interval, run_once=args.once)
