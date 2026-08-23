import pytest
from unittest.mock import patch, MagicMock

from mission1.email_adapter import (
    get_send_fn,
    send_via_dry_run,
    send_via_resend,
    send_via_smtp,
    EmailDeliveryError,
)


def test_get_send_fn_defaults_to_dry_run_when_no_creds(monkeypatch):
    monkeypatch.delenv("RESEND_API_KEY", raising=False)
    monkeypatch.delenv("SMTP_HOST", raising=False)
    monkeypatch.delenv("RAIOC_EMAIL_DRY_RUN", raising=False)

    fn = get_send_fn()
    assert fn == send_via_dry_run


def test_get_send_fn_uses_resend_when_configured(monkeypatch):
    monkeypatch.setenv("RESEND_API_KEY", "re_mock_key_123")
    monkeypatch.delenv("SMTP_HOST", raising=False)
    monkeypatch.delenv("RAIOC_EMAIL_DRY_RUN", raising=False)

    fn = get_send_fn()
    with patch("requests.post") as mock_post:
        mock_resp = MagicMock()
        mock_resp.raise_for_status.return_value = None
        mock_post.return_value = mock_resp

        fn("investor@example.com", "Test Subject", "Test Body")
        assert mock_post.called
        assert "api.resend.com" in mock_post.call_args[0][0]


def test_get_send_fn_uses_smtp_when_configured(monkeypatch):
    monkeypatch.delenv("RESEND_API_KEY", raising=False)
    monkeypatch.setenv("SMTP_HOST", "smtp.example.com")
    monkeypatch.setenv("SMTP_PORT", "587")
    monkeypatch.delenv("RAIOC_EMAIL_DRY_RUN", raising=False)

    fn = get_send_fn()
    with patch("smtplib.SMTP") as mock_smtp:
        mock_server = MagicMock()
        mock_smtp.return_value = mock_server

        fn("investor@example.com", "Test Subject", "Test Body")
        assert mock_smtp.called
        assert mock_server.sendmail.called


def test_resend_raises_delivery_error_on_http_failure():
    with patch("requests.post", side_effect=RuntimeError("Network down")):
        with pytest.raises(EmailDeliveryError):
            send_via_resend("a@b.com", "Sub", "Body", api_key="invalid")
