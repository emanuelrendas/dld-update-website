import os
from unittest.mock import patch, MagicMock

from mission1.scheduler import acquire_lock, release_lock, start_scheduler, LOCK_FILE


def test_lock_acquire_and_release():
    release_lock()
    assert acquire_lock() is True
    assert os.path.exists(LOCK_FILE)
    release_lock()
    assert not os.path.exists(LOCK_FILE)


def test_scheduler_runs_once_when_flagged():
    with patch("mission1.scheduler.run_cycle") as mock_run:
        start_scheduler(interval_seconds=1, run_once=True)
        assert mock_run.called
