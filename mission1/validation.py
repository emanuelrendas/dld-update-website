"""
Validation and the consent gate.

This module is deliberately the most conservative part of the codebase. Its job is to
say "no" by default. A bug here that lets an unconsented lead through is a business
and reputational incident, not a normal software bug -- treat changes to this file
with more scrutiny than anywhere else in the repo.
"""
import re
from dataclasses import dataclass

from mission1.config import REQUIRED_CONSENT_STATUS

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class ConsentError(RuntimeError):
    """Raised when a lead does not have verified consent. Never caught-and-ignored."""


@dataclass
class Lead:
    id: str
    name: str
    email: str
    mobile: str | None
    address: str | None
    consent_status: str
    status: str


def is_valid_email(email: str) -> bool:
    return bool(email and EMAIL_RE.match(email.strip()))


def assert_consent(lead: Lead) -> None:
    """
    Hard stop. Raises ConsentError unless consent_status is exactly 'opted_in'.

    There is intentionally no bypass parameter. If a future engineering need requires
    one, that is an architectural change and must go through Emanuel per the Operating
    Directive -- not be quietly added here.
    """
    if lead.consent_status != REQUIRED_CONSENT_STATUS:
        raise ConsentError(
            f"Refusing to contact lead {lead.id} ({lead.email}): "
            f"consent_status is '{lead.consent_status}', not '{REQUIRED_CONSENT_STATUS}'."
        )


def validate_lead(lead: Lead) -> list[str]:
    """Returns a list of validation problems. Empty list means the lead is clean."""
    problems = []
    if not lead.name or not lead.name.strip():
        problems.append("missing name")
    if not is_valid_email(lead.email):
        problems.append(f"invalid email format: {lead.email!r}")
    return problems
