"""
Outreach draft generation for Spain/Portugal investor market.

Pure functions: produce personalized email drafts with clean name and city extraction.
"""
from mission1.validation import Lead


def first_name(full_name: str) -> str:
    cleaned = (full_name or "").strip()
    if not cleaned:
        return "Inversor"
    for prefix in ("dr.", "dr ", "sr.", "sr ", "sra.", "sra ", "d.", "d ", "dna.", "dna ", "eng.", "eng "):
        if cleaned.lower().startswith(prefix):
            cleaned = cleaned[len(prefix):].strip()
            break
    parts = cleaned.split()
    return parts[0] if parts else "Inversor"


def city_from_address(address: str | None) -> str:
    if not address or not address.strip():
        return "su zona"
    parts = [p.strip() for p in address.split(",") if p.strip()]
    if len(parts) >= 2:
        # e.g. "Calle Serrano 45, Madrid, España" -> "Madrid"
        return parts[-2] if len(parts) >= 3 else parts[1]
    return parts[0]


def build_email(lead: Lead) -> dict:
    """Returns {"subject": ..., "body": ...} for the given lead."""
    fn = first_name(lead.name)
    city = city_from_address(lead.address)
    subject = f"Inversión inmobiliaria en Dubai — una idea rápida para {fn}"
    body = (
        f"Hola {fn},\n\n"
        f"Soy Emanuel Rendas, asesor de inversión inmobiliaria enfocado en el mercado "
        f"de Dubai. Te escribo porque cada vez más inversores de {city} están mirando "
        f"hacia Dubai por la rentabilidad de alquiler y las ventajas fiscales frente al "
        f"mercado europeo.\n\n"
        f"No te escribo para vender nada — si te interesa, puedo enviarte un resumen "
        f"de 2 minutos con datos reales del mercado actual, y si no es para ti ahora, "
        f"dímelo y no te vuelvo a escribir.\n\n"
        f"Un saludo,\n"
        f"Emanuel Rendas\n"
        f"Asesor de Inversión Inmobiliaria, Dubai\n"
    )
    return {"subject": subject, "body": body}
