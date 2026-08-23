"""
Telegram executive notification.

Sends daily / per-run summary to Emanuel via Telegram Bot API.
"""
import requests

from mission1.config import require_env, ConfigError


class NotConfiguredError(RuntimeError):
    """Telegram credentials are not set."""


class TelegramSendError(RuntimeError):
    """Telegram API rejected the request or network call failed."""


def format_run_report(result) -> str:
    """result is a mission1.pipeline.RunResult."""
    lines = [
        "RAIOC — Mission 1 Outreach Run Report",
        f"Sent: {len(result.sent)}",
        f"Skipped (no consent / invalid): {len(result.skipped)}",
        f"Failed (will retry): {len(result.failed)}",
    ]
    if result.skipped:
        lines.append("Skipped reasons: " + "; ".join(f"{lid}: {reason}" for lid, reason in result.skipped[:5]))
    if result.failed:
        lines.append("Failures: " + "; ".join(f"{lid}: {err}" for lid, err in result.failed[:5]))

    dossiers = getattr(result, "dossiers", [])
    if dossiers:
        lines.append("\nExecutive Dossier Highlights:")
        for d in dossiers[:3]:
            lines.append(f"• {d.headline} [{d.data_confidence.upper()}]: {d.recommended_angle}")

    report = "\n".join(lines)
    # Guard against Telegram 4096 character limit
    if len(report) > 4000:
        report = report[:3950] + "\n\n... [Report truncated for Telegram limit]"
    return report


def send_executive_report(text: str) -> None:
    try:
        token = require_env("TELEGRAM_BOT_TOKEN")
        chat_id = require_env("TELEGRAM_CHAT_ID")
    except ConfigError as e:
        raise NotConfiguredError(str(e)) from e

    # Guard length
    safe_text = text if len(text) <= 4000 else text[:3950] + "\n... [truncated]"

    url = f"https://api.telegram.org/bot{token}/sendMessage"
    try:
        resp = requests.post(url, json={"chat_id": chat_id, "text": safe_text}, timeout=10)
        resp.raise_for_status()
    except requests.RequestException as e:
        raise TelegramSendError(f"Telegram send failed: {e}") from e
