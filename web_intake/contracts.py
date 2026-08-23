"""
API contracts for the website lead capture surface.

These dataclasses are the source of truth for request/response shapes. They are
framework-agnostic on purpose -- when GitHub/Vercel access is restored, wiring
these into actual Vercel Functions / Next.js API routes is a thin adapter layer
(parse JSON -> construct these -> call web_intake.intake functions -> serialize
response), not a rewrite. See docs/LEAD_CAPTURE_ARCHITECTURE.md for the endpoint
list these map to.
"""
from dataclasses import dataclass, field


@dataclass
class Attribution:
    """Where a visitor/lead came from. Every field optional -- most direct-traffic
    and WhatsApp-referred visitors won't have UTM params, and that's fine."""

    utm_source: str | None = None
    utm_medium: str | None = None
    utm_campaign: str | None = None
    referrer_url: str | None = None
    page_url: str | None = None


@dataclass
class EventRequest:
    """POST /api/events -- fire-and-forget funnel tracking, called from the browser."""

    session_id: str
    event_name: str
    event_props: dict = field(default_factory=dict)
    page_url: str | None = None
    lead_id: str | None = None  # set once the visitor has identified


@dataclass
class AssessmentSubmitRequest:
    """POST /api/assessment/submit -- the assessment's answers, submitted once the
    visitor reaches the gate. Contact fields are optional here on purpose: the
    assessment can compute and preview-tease a score before asking for contact
    details (see docs/LEAD_CAPTURE_ARCHITECTURE.md User Journey)."""

    session_id: str
    answers: dict[str, str]
    attribution: Attribution = field(default_factory=Attribution)


@dataclass
class AssessmentSubmitResponse:
    score: int
    tier: str
    tier_label: str
    is_gated: bool  # True until contact info is captured -- controls whether the
    # frontend shows the full personalized breakdown or a teaser + capture form


@dataclass
class LeadCaptureRequest:
    """POST /api/leads -- the moment a session becomes an identified lead. Used both
    by the assessment gate (name + email only) and the existing Private Investment
    Brief form (full detail). Both write to the same `leads` row via session_id
    correlation -- see ADR-0005."""

    session_id: str
    name: str
    email: str
    consent_given: bool  # must be explicit and true; there is no default, mirroring
    # ADR-0001's no-bypass-parameter principle for the outbound consent gate
    mobile: str | None = None
    location: str | None = None
    investment_objective: str | None = None
    budget_band: str | None = None
    mandate_description: str | None = None
    lead_magnet: str | None = None
    attribution: Attribution = field(default_factory=Attribution)


@dataclass
class LeadCaptureResponse:
    lead_id: str
    score: int | None
    tier: str | None
    next_step: str  # "view_full_report" | "whatsapp_consultation" | "await_review"
