"""
Configuration for the Mission 1 pipeline and RAIOC backend.
"""
import os


class ConfigError(RuntimeError):
    """Raised when required configuration is missing."""


SUPABASE_PROJECT_ID = "tovfnshstqxmwwlllthj"  # raioc-os project, ap-south-1

# Outreach rate limits
MAX_SENDS_PER_RUN = int(os.environ.get("RAIOC_MAX_SENDS_PER_RUN", "10"))
SECONDS_BETWEEN_SENDS = float(os.environ.get("RAIOC_SECONDS_BETWEEN_SENDS", "3"))

REQUIRED_CONSENT_STATUS = "opted_in"


def get_supabase_url() -> str:
    """Resolves Supabase project URL with fallbacks for standard Vercel and local envs."""
    val = (
        os.environ.get("SUPABASE_URL")
        or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
        or os.environ.get("SUPABASE_REST_URL")
    )
    if not val:
        raise ConfigError(
            "Missing required environment variable: SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL). "
            "Set it in Vercel or your local environment."
        )
    return val.rstrip("/")


def get_supabase_service_key() -> str:
    """Resolves Supabase service role key with fallbacks for SUPABASE_SERVICE_ROLE_KEY and SUPABASE_SERVICE_KEY."""
    val = (
        os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
        or os.environ.get("SUPABASE_SERVICE_KEY")
        or os.environ.get("SUPABASE_SECRET_KEY")
        or os.environ.get("SUPABASE_KEY")
    )
    if not val:
        raise ConfigError(
            "Missing required environment variable: SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SERVICE_KEY / SUPABASE_SECRET_KEY). "
            "Set it in Vercel or your local environment."
        )
    return val


def require_env(name: str) -> str:
    if name in ("SUPABASE_SERVICE_KEY", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY"):
        return get_supabase_service_key()
    if name in ("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_REST_URL"):
        return get_supabase_url()
    value = os.environ.get(name)
    if not value:
        raise ConfigError(
            f"Missing required environment variable: {name}. "
            f"Set it before running the Mission 1 pipeline."
        )
    return value
