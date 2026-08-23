from mission1.pipeline import run_outreach_batch
from mission1.validation import Lead


def make_lead(**overrides) -> Lead:
    base = dict(
        id="lead-1", name="Ana Garcia", email="ana@example.com",
        mobile="34600000000", address="Madrid, Spain",
        consent_status="opted_in", status="new",
    )
    base.update(overrides)
    return Lead(**base)


def fixed_now():
    return "2026-08-19T00:00:00+00:00"


def collecting_audit_sink(events):
    def sink(event):
        events.append(event)
    return sink


def test_opted_in_lead_gets_sent_and_marked_contacted():
    sent_calls = []
    status_calls = []
    events = []

    result = run_outreach_batch(
        [make_lead()],
        send_fn=lambda to, s, b: sent_calls.append((to, s, b)),
        update_status_fn=lambda lid, st, notes: status_calls.append((lid, st, notes)),
        audit_sink=collecting_audit_sink(events),
        now_fn=fixed_now,
    )

    assert result.sent == ["lead-1"]
    assert len(sent_calls) == 1
    assert status_calls[-1][0:2] == ("lead-1", "contacted")
    event_types = [e.event for e in events]
    assert event_types == ["validated", "consent_checked", "enriched", "dossier_built", "outreach_sent"]


def test_unconsented_lead_never_calls_send_fn():
    sent_calls = []
    events = []

    leads = [make_lead(id="lead-2", consent_status="unknown")]
    result = run_outreach_batch(
        leads,
        send_fn=lambda to, s, b: sent_calls.append((to, s, b)),
        update_status_fn=lambda *a: None,
        audit_sink=collecting_audit_sink(events),
        now_fn=fixed_now,
    )

    assert sent_calls == []  # the entire point of this test
    assert result.sent == []
    assert ("lead-2", "no consent") in result.skipped
    assert [e.event for e in events] == ["validated", "consent_checked"]  # stops before enrichment


def test_send_failure_does_not_crash_the_batch():
    def failing_send(to, subject, body):
        raise RuntimeError("simulated Gmail outage")

    status_calls = []
    result = run_outreach_batch(
        [make_lead(id="lead-3")],
        send_fn=failing_send,
        update_status_fn=lambda lid, st, notes: status_calls.append((lid, st)),
        audit_sink=lambda e: None,
        now_fn=fixed_now,
    )

    assert result.sent == []
    assert result.failed[0][0] == "lead-3"
    assert status_calls[-1] == ("lead-3", "new")  # stays retryable, not corrupted


def test_batch_respects_max_sends_cap(monkeypatch):
    import mission1.pipeline as pipeline_module
    monkeypatch.setattr(pipeline_module, "MAX_SENDS_PER_RUN", 2)

    leads = [make_lead(id=f"lead-{i}") for i in range(5)]
    result = run_outreach_batch(
        leads,
        send_fn=lambda to, s, b: None,
        update_status_fn=lambda *a: None,
        audit_sink=lambda e: None,
        now_fn=fixed_now,
    )
    assert len(result.sent) == 2


def test_notify_failure_does_not_invalidate_a_successful_run():
    def failing_notify(text):
        raise RuntimeError("simulated Telegram outage")

    result = run_outreach_batch(
        [make_lead()],
        send_fn=lambda to, s, b: None,
        update_status_fn=lambda *a: None,
        audit_sink=lambda e: None,
        notify_fn=failing_notify,
        now_fn=fixed_now,
    )

    assert result.sent == ["lead-1"]  # the send still succeeded
    assert result.notify_error is not None  # but we know the report didn't go out


def test_notify_fn_receives_a_report_when_run_succeeds():
    received = []
    run_outreach_batch(
        [make_lead()],
        send_fn=lambda to, s, b: None,
        update_status_fn=lambda *a: None,
        audit_sink=lambda e: None,
        notify_fn=lambda text: received.append(text),
        now_fn=fixed_now,
    )
    assert len(received) == 1
    assert "Sent: 1" in received[0]
