"""
Mission 1 pipeline orchestrator -- full flow.

validate -> assert_consent (hard gate) -> enrich -> build_dossier -> build_email ->
send_fn -> update_status_fn -> audit log -> (end of batch) executive notification.
"""
import logging
import time
from datetime import datetime, timezone
from typing import Callable, Optional

from mission1.audit_log import Sink, record
from mission1.config import MAX_SENDS_PER_RUN, SECONDS_BETWEEN_SENDS
from mission1.dossier import Dossier, build_dossier
from mission1.enrichment import enrich_lead
from mission1.outreach import build_email
from mission1.validation import Lead, ConsentError, assert_consent, validate_lead

logger = logging.getLogger("mission1.pipeline")

SendFn = Callable[[str, str, str], None]  # (to_email, subject, body) -> None
UpdateStatusFn = Callable[[str, str, str], None]  # (lead_id, status, notes) -> None
NotifyFn = Callable[[str], None]  # (report_text) -> None


class RunResult:
    def __init__(self) -> None:
        self.sent: list[str] = []
        self.skipped: list[tuple[str, str]] = []
        self.failed: list[tuple[str, str]] = []
        self.dossiers: list[Dossier] = []
        self.notify_error: Optional[str] = None


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def run_outreach_batch(
    leads: list[Lead],
    send_fn: SendFn,
    update_status_fn: UpdateStatusFn,
    audit_sink: Sink,
    notify_fn: Optional[NotifyFn] = None,
    now_fn: Callable[[], str] = _now,
) -> RunResult:
    result = RunResult()
    batch = leads[:MAX_SENDS_PER_RUN]
    logger.info("Starting outreach run: %d lead(s) in batch (cap=%d)", len(batch), MAX_SENDS_PER_RUN)

    for lead in batch:
        problems = validate_lead(lead)
        record(audit_sink, lead.id, "validated", f"problems={problems}", now_fn())
        if problems:
            reason = "; ".join(problems)
            logger.warning("Skipping lead %s: %s", lead.id, reason)
            result.skipped.append((lead.id, reason))
            update_status_fn(lead.id, "disqualified", f"Validation failed: {reason}")
            continue

        try:
            assert_consent(lead)
            record(audit_sink, lead.id, "consent_checked", "opted_in confirmed", now_fn())
        except ConsentError as e:
            logger.warning(str(e))
            record(audit_sink, lead.id, "consent_checked", str(e), now_fn())
            result.skipped.append((lead.id, "no consent"))
            continue

        enrichment = enrich_lead(lead)
        record(
            audit_sink,
            lead.id,
            "enriched",
            f"score={enrichment.score} tier={enrichment.tier} placeholder={enrichment.is_placeholder}",
            now_fn(),
        )

        dossier = build_dossier(lead, enrichment)
        result.dossiers.append(dossier)
        record(audit_sink, lead.id, "dossier_built", dossier.summary, now_fn())

        email = build_email(lead)
        try:
            send_fn(lead.email, email["subject"], email["body"])
        except Exception as e:  # noqa: BLE001 -- isolate this lead's failure
            logger.error("Send failed for lead %s: %s", lead.id, e)
            record(audit_sink, lead.id, "outreach_failed", str(e), now_fn())
            result.failed.append((lead.id, str(e)))
            update_status_fn(lead.id, "new", f"Send failed, will retry: {e}")
            continue

        result.sent.append(lead.id)
        record(audit_sink, lead.id, "outreach_sent", f"subject={email['subject']!r}", now_fn())
        update_status_fn(lead.id, "contacted", "Outreach email sent successfully.")
        logger.info("Sent to lead %s (%s)", lead.id, lead.email)

        if lead is not batch[-1]:
            time.sleep(SECONDS_BETWEEN_SENDS)

    logger.info(
        "Run complete: %d sent, %d skipped, %d failed",
        len(result.sent),
        len(result.skipped),
        len(result.failed),
    )

    if notify_fn is not None:
        from mission1.notify import format_run_report

        try:
            notify_fn(format_run_report(result))
        except Exception as e:  # noqa: BLE001 -- a failed report must not fail the run
            logger.error("Executive notification failed: %s", e)
            result.notify_error = str(e)

    return result
