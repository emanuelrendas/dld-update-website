"""
Structured audit logging for Mission 1 runs.

Every meaningful event (lead validated, consent checked, enriched, dossier built,
outreach sent or skipped or failed) gets one structured record. This is separate
from Python's `logging` module output (which is for engineers debugging) -- this is
the durable, queryable record of what the business did to which lead and when,
which is what "complete audit log" in the Definition of Done actually means.

Writes newline-delimited JSON to a local file by default. Swap `sink` for a Supabase
insert once an `audit_log` table exists -- interface stays the same.
"""
import json
from dataclasses import dataclass, asdict
from typing import Callable


@dataclass
class AuditEvent:
    lead_id: str
    event: str  # e.g. "validated", "consent_checked", "enriched", "dossier_built",
    #              "outreach_sent", "outreach_skipped", "outreach_failed", "notified"
    detail: str
    timestamp: str  # ISO-8601, passed in by caller (no wall-clock calls in this module)


Sink = Callable[[AuditEvent], None]


def file_sink(path: str) -> Sink:
    def _write(event: AuditEvent) -> None:
        with open(path, "a", encoding="utf-8") as f:
            f.write(json.dumps(asdict(event), ensure_ascii=False) + "\n")
    return _write


def record(sink: Sink, lead_id: str, event: str, detail: str, timestamp: str) -> None:
    sink(AuditEvent(lead_id=lead_id, event=event, detail=detail, timestamp=timestamp))
