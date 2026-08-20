#!/usr/bin/env bash
set -euo pipefail
BASE="${BASE_URL:-http://localhost:3000}"

echo "Running quick site verification against $BASE"
echo

# Helper: curl headers + body, check Content-Type and valid JSON
check_json() {
  local url="$1"
  echo "→ GET $url"
  local hdrs body
  hdrs=$(mktemp) || exit 1
  body=$(mktemp) || exit 1
  curl -sS -D "$hdrs" "$url" -o "$body" || { echo "  ERROR: curl failed for $url"; rm -f "$hdrs" "$body"; exit 2; }
  local ct
  ct=$(grep -i '^Content-Type:' "$hdrs" | tr -d '\r' || true)
  if [[ "$ct" != *"application/json"* ]]; then
    echo "  FAIL: Content-Type not application/json for $url (got: ${ct:-none})"
    rm -f "$hdrs" "$body"
    exit 3
  else
    echo "  OK: Content-Type: $ct"
  fi
  if ! jq . "$body" >/dev/null 2>&1; then
    echo "  FAIL: Invalid JSON returned from $url"
    cat "$body"
    rm -f "$hdrs" "$body"
    exit 4
  fi
  echo "  OK: Valid JSON"
  echo "  Keys: $(jq 'keys' "$body" 2>/dev/null || echo 'unknown')"
  rm -f "$hdrs" "$body"
  echo
}

# 1) fx endpoint
check_json "$BASE/api/fx"

# 2) dld endpoint - check for configured field (configured:false when creds missing)
echo "→ GET $BASE/api/dld (checking configured)"
dld_resp=$(curl -sS "$BASE/api/dld" || { echo "  ERROR: curl failed for /api/dld"; exit 5; })
if ! echo "$dld_resp" | jq . >/dev/null 2>&1; then
  echo "  FAIL: /api/dld returned invalid JSON"; echo "$dld_resp"; exit 6
fi
configured=$(echo "$dld_resp" | jq -r '.configured // "MISSING"')
echo "  configured: $configured"
if [[ "$configured" == "MISSING" ]]; then
  echo "  WARN: 'configured' key missing from /api/dld response"
fi
echo

# 3) quick site route smoke (no deep rendering, just HTTP status)
routes=(/ /about /advisory /intelligence /addresses /instruments /contact)
echo "→ Checking routes for 200 and no 5xx/4xx"
for r in "${routes[@]}"; do
  url="$BASE$r"
  status=$(curl -s -o /dev/null -w "%{http_code}" "$url" || echo "000")
  if [[ "$status" =~ ^2 ]]; then
    echo "  OK $r -> $status"
  else
    echo "  WARN $r -> $status (inspect in browser)"
  fi
done
echo

echo "Done. If all checks are OK, you can approve the PR. To exercise fx fallback, temporarily block api.frankfurter.app (hosts or firewall) and re-run the fx check — expected: live:false and FALLBACK rates."
