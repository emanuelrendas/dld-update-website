import json
import os
import tempfile

from mission1.audit_log import file_sink, record


def test_file_sink_writes_valid_jsonl():
    with tempfile.TemporaryDirectory() as d:
        path = os.path.join(d, "audit.jsonl")
        sink = file_sink(path)
        record(sink, "lead-1", "validated", "no problems", "2026-08-19T00:00:00+00:00")
        record(sink, "lead-1", "outreach_sent", "subject=test", "2026-08-19T00:00:01+00:00")

        with open(path) as f:
            lines = [json.loads(line) for line in f if line.strip()]

        assert len(lines) == 2
        assert lines[0]["event"] == "validated"
        assert lines[1]["lead_id"] == "lead-1"
