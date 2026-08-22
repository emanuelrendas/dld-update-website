# Connecting Live DLD Data

The site currently publishes verified static figures. This adds a live panel
fed directly from Dubai Land Department records via Dubai Pulse.

**Until you complete the steps below, nothing changes.** The function returns
`configured: false`, the panel stays hidden, and the site works exactly as it
does now. There is no broken state to worry about.

---

## Step 1 — Request the dataset (5 minutes, then wait)

1. Go to **dubaipulse.gov.ae**
2. Open the dataset: **dubaipulse.gov.ae/data/dld-transactions/dld_transactions-open**
3. Click **Request Permission**
4. Tick the terms acknowledgement, submit

You will receive an **API Key** and an **API Secret** in two separate emails.
Dubai Pulse states confirmation within 14 days.

Save both. You will not be shown them again.

---

## Step 2 — Add the credentials to Vercel (2 minutes)

1. Vercel → your project → **Settings** → **Environment Variables**
2. Add two variables:

| Name | Value |
|---|---|
| `DUBAI_PULSE_KEY` | the API Key from the first email |
| `DUBAI_PULSE_SECRET` | the API Secret from the second email |

3. Set both for **Production**
4. Go to **Deployments** → most recent → **⋯** → **Redeploy**

The credentials live on Vercel's server. They are never sent to the browser
and never appear in the page source.

---

## Step 3 — Confirm it works

Open `your-site.vercel.app/api/dld` directly in a browser.

**Working:**
```json
{ "configured": true, "ok": true, "totals": { "transactions": 24817, ... } }
```

**Not yet configured:**
```json
{ "configured": false, "message": "Dubai Pulse credentials not set..." }
```

**Authenticated but failing:** the `message` field names the problem.

When it works, a panel headed *"Registered transactions · trailing 90 days"*
appears in the Market Intelligence section with a green indicator.

---

## What it publishes

Trailing 90 days of registered transactions:

- Transaction count and total value
- Median price per sqft, citywide
- Off-plan versus completed share
- Per-community breakdown for eight tracked areas

**Data discipline built in:**

- Records with implausible area or value are discarded before any median
- Communities with fewer than 10 valid records are suppressed rather than
  published as noise
- Medians, not means — a single AED 200M villa does not distort a community
- Every figure carries the source line *"Dubai Land Department via Dubai Pulse"*

---

## Refresh cadence

The response is cached at Vercel's edge for **24 hours**.

This is deliberate. The DLD open dataset refreshes periodically, not
continuously — polling more aggressively would return identical data and
consume quota for nothing.

Describe it on the site as **"updated daily"**, never as "live" or "real time".
The source does not support that claim, and the whole positioning of this site
rests on not making claims the source does not support.

---

## If something goes wrong

| Symptom | Cause | Fix |
|---|---|---|
| Panel never appears | Credentials not set, or not redeployed | Check Settings → Environment Variables, then redeploy |
| `auth failed (401)` | Key or Secret wrong, or extra whitespace | Re-copy from the emails, no leading or trailing spaces |
| `Dataset query failed (403)` | Permission not granted yet | Check for the confirmation email from Dubai Pulse |
| `no records returned` | Filter syntax or field name changed | Field names in the open dataset occasionally change; send me the raw response |

The site degrades silently by design. If the API fails, visitors see the
published static figures and nothing appears broken.

---

## Field mapping

The function reads these fields from each record, with fallbacks:

| Purpose | Primary | Fallback |
|---|---|---|
| Transaction value | `actual_worth` | `trans_value` |
| Area (sqm) | `procedure_area` | `area` |
| Community | `area_name_en` | `area_name` |
| Registration type | `reg_type_en` | `reg_type` |

If Dubai Pulse changes its schema, these are the lines to adjust in
`api/dld.js`.
