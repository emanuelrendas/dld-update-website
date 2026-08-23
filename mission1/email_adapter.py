"""
Production Email Adapter for RAIOC.

Supports:
1. Resend API (via RESEND_API_KEY)
2. Standard SMTP (via SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD)
3. Simulated / Dry-Run logger (fallback when credentials are not configured or RAIOC_EMAIL_DRY_RUN=1)
"""
import logging
import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Callable
import requests

logger = logging.getLogger("mission1.email_adapter")

DEFAULT_FROM_EMAIL = os.environ.get("RAIOC_FROM_EMAIL", "Emanuel Rendas <emanuel@raioc.ai>")


class EmailDeliveryError(RuntimeError):
    """Raised when email delivery fails."""


def send_via_resend(to_email: str, subject: str, body: str, api_key: str, from_email: str = DEFAULT_FROM_EMAIL) -> None:
    url = "https://api.resend.com/emails"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "from": from_email,
        "to": [to_email],
        "subject": subject,
        "text": body,
    }
    try:
        resp = requests.post(url, headers=headers, json=payload, timeout=15)
        resp.raise_for_status()
        logger.info("Email delivered via Resend to %s", to_email)
    except Exception as e:
        raise EmailDeliveryError(f"Resend delivery failed for {to_email}: {e}") from e


def send_via_smtp(
    to_email: str,
    subject: str,
    body: str,
    host: str,
    port: int = 587,
    user: str | None = None,
    password: str | None = None,
    from_email: str = DEFAULT_FROM_EMAIL,
    use_tls: bool = True,
) -> None:
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = from_email
    msg["To"] = to_email
    msg.attach(MIMEText(body, "plain", "utf-8"))

    try:
        if port == 465:
            server = smtplib.SMTP_SSL(host, port, timeout=15)
        else:
            server = smtplib.SMTP(host, port, timeout=15)
            if use_tls:
                server.starttls()

        if user and password:
            server.login(user, password)

        server.sendmail(from_email, [to_email], msg.as_string())
        server.quit()
        logger.info("Email delivered via SMTP to %s", to_email)
    except Exception as e:
        raise EmailDeliveryError(f"SMTP delivery failed for {to_email}: {e}") from e


def send_via_dry_run(to_email: str, subject: str, body: str) -> None:
    logger.info("[DRY-RUN] Outreach email simulated -> To: %s | Subject: %s", to_email, subject)


def get_send_fn() -> Callable[[str, str, str], None]:
    """
    Returns the appropriate send function based on runtime environment configuration.
    """
    dry_run = os.environ.get("RAIOC_EMAIL_DRY_RUN", "").lower() in ("1", "true", "yes")
    if dry_run:
        return send_via_dry_run

    resend_key = os.environ.get("RESEND_API_KEY")
    if resend_key:
        return lambda to, sub, body: send_via_resend(to, sub, body, api_key=resend_key)

    smtp_host = os.environ.get("SMTP_HOST")
    if smtp_host:
        smtp_port = int(os.environ.get("SMTP_PORT", "587"))
        smtp_user = os.environ.get("SMTP_USER")
        smtp_pass = os.environ.get("SMTP_PASSWORD")
        smtp_from = os.environ.get("SMTP_FROM", DEFAULT_FROM_EMAIL)
        use_tls = os.environ.get("SMTP_USE_TLS", "1").lower() in ("1", "true", "yes")
        return lambda to, sub, body: send_via_smtp(
            to, sub, body, host=smtp_host, port=smtp_port, user=smtp_user, password=smtp_pass, from_email=smtp_from, use_tls=use_tls
        )

    # Fallback to safe dry-run logger if no provider is configured
    return send_via_dry_run
