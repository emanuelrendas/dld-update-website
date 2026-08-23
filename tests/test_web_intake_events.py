import pytest

from web_intake.events import ALL_EVENTS, UnknownEventError, WHATSAPP_CLICKED, validate_event_name


def test_known_event_passes():
    validate_event_name(WHATSAPP_CLICKED)  # does not raise


def test_unknown_event_raises():
    with pytest.raises(UnknownEventError):
        validate_event_name("totally_made_up_event")


def test_all_events_is_nonempty_and_closed():
    assert len(ALL_EVENTS) >= 10
    assert WHATSAPP_CLICKED in ALL_EVENTS
