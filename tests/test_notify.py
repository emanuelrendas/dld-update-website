import pytest

from mission1.notify import format_run_report, send_executive_report, NotConfiguredError


class _FakeResult:
    def __init__(self, sent, skipped, failed):
        self.sent = sent
        self.skipped = skipped
        self.failed = failed


def test_format_run_report_includes_counts():
    result = _FakeResult(sent=["a", "b"], skipped=[("c", "no consent")], failed=[])
    text = format_run_report(result)
    assert "Sent: 2" in text
    assert "Skipped" in text


def test_send_executive_report_raises_clear_error_when_not_configured(monkeypatch):
    monkeypatch.delenv("TELEGRAM_BOT_TOKEN", raising=False)
    monkeypatch.delenv("TELEGRAM_CHAT_ID", raising=False)
    with pytest.raises(NotConfiguredError):
        send_executive_report("test report")
