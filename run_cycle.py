"""
RAIOC Production Pipeline Cycle Runner (run_cycle.py)

Orchestrates the end-to-end batch outreach cycle:
1. Ingests consented new leads from Supabase.
2. Validates format and enforces the consent gate.
3. Enriches data and builds internal dossiers.
4. Generates personalized Spanish outreach email drafts.
5. Dispatches outreach emails with rate-limiting and failure isolation.
6. Updates lead status and writes durable audit logs.
7. Dispatches the executive summary report via Telegram.
"""
import logging
import os
import sys

# Ensure project root is on sys.path
root_dir = os.path.dirname(os.path.abspath(__file__))
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

from mission1 import audit_log, db, email_adapter, notify, pipeline
from mission1.config import MAX_SENDS_PER_RUN, SECONDS_BETWEEN_SENDS

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("raioc.run_cycle")


def run_cycle() -> pipeline.RunResult:
    logger.info("=== Starting RAIOC Outreach Cycle ===")
    logger.info("Configuration: max_sends=%d, sleep_between=%ss", MAX_SENDS_PER_RUN, SECONDS_BETWEEN_SENDS)

    # 1. Fetch leads from Supabase
    try:
        leads = db.fetch_consented_leads_as_models(limit=MAX_SENDS_PER_RUN)
        logger.info("Fetched %d opted_in leads from Supabase", len(leads))
    except Exception as e:
        logger.error("Failed to query Supabase leads: %s", e)
        leads = []

    if not leads:
        logger.info("No new opted_in leads to process. Cycle complete.")
        return pipeline.RunResult()

    # 2. Configure audit sink (writes to audit.jsonl)
    sink = audit_log.file_sink(os.path.join(root_dir, "audit.jsonl"))

    # 3. Configure production email sender
    send_fn = email_adapter.get_send_fn()

    # 4. Configure Telegram executive notification
    def notify_adapter(report_text: str) -> None:
        try:
            notify.send_executive_report(report_text)
            logger.info("Executive report delivered via Telegram")
        except notify.NotConfiguredError:
            logger.info("Telegram notification skipped: credentials not set")
        except Exception as e:
            logger.warning("Telegram notification failed: %s", e)

    # 5. Execute outreach batch
    result = pipeline.run_outreach_batch(
        leads=leads,
        send_fn=send_fn,
        update_status_fn=db.update_lead_status,
        audit_sink=sink,
        notify_fn=notify_adapter,
    )

    logger.info(
        "=== Cycle Complete: %d sent, %d skipped, %d failed ===",
        len(result.sent),
        len(result.skipped),
        len(result.failed),
    )
    return result


if __name__ == "__main__":
    res = run_cycle()
    if res.failed:
        sys.exit(1)
    sys.exit(0)
