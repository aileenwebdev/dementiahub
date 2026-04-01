# DementiaHub Dashboard

A full-stack portal integrating **ElevenLabs Voice AI** with **GoHighLevel (GHL) CRM** for managing dementia care voice call workflows. The portal acts as a trust boundary between ElevenLabs (voice AI layer) and GHL (single source of truth for contact records).

---

## Architecture Overview

```
Portal User ──► Manus OAuth ──► Portal Dashboard
                                      │
                    ┌─────────────────┼─────────────────┐
                    ▼                 ▼                   ▼
              ElevenLabs API    GHL API V2          Socket.IO
              (call initiation) (contacts, CRM)    (live transcripts)
                    │                 ▲
                    └──── Webhooks ───┘
                    POST /api/webhooks/elevenlabs/post-call
                    POST /api/webhooks/elevenlabs/consent
```

**Stack:** React 19 + TypeScript + Tailwind 4 + tRPC 11 + Express + Drizzle ORM + MySQL + Socket.IO

---

## Features

| Feature | Description |
|---|---|
| **Identity Mapping** | Each portal user is automatically linked to a GHL sub-account contact on registration |
| **Call Initiation** | Start ElevenLabs voice calls with dynamic variables (name, phone, GHL contact ID) |
| **Post-Call Sync** | Webhook receives ElevenLabs call data and writes to GHL (contact tags, opportunity, notes, conversation) |
| **Consent Verification** | Real-time consent webhook triggers GHL tag `Consent Verified` and updates identity map |
| **Live Transcript** | Socket.IO streams real-time transcript chunks to the browser during active calls |
| **Call History** | Full call log with safety result badges, status filters, and transcript viewer |
| **Profile Management** | Users can update phone number and re-sync their GHL contact |
| **Failed Sync Queue** | Webhook failures are queued for retry |

---

## Environment Variables

| Variable | Description |
|---|---|
| `GHL_API_KEY` | GoHighLevel Bearer API token (V2) |
| `GHL_LOCATION_ID` | GHL sub-account location ID |
| `ELEVENLABS_API_KEY` | ElevenLabs API key |
| `ELEVENLABS_AGENT_ID` | ElevenLabs agent ID for outbound calls |
| `ELEVENLABS_WEBHOOK_SECRET` | Shared secret for webhook signature verification (defaults to `dementiahub-webhook-secret-2026`) |
| `DATABASE_URL` | MySQL connection string (auto-injected in Manus/Railway) |
| `JWT_SECRET` | Session cookie signing secret (auto-injected) |

---

## Webhook Configuration

Configure these URLs in your ElevenLabs agent settings:

| Webhook | URL |
|---|---|
| Post-Call | `https://your-domain.com/api/webhooks/elevenlabs/post-call` |
| Consent | `https://your-domain.com/api/webhooks/elevenlabs/consent` |

**Authentication:** Include the header `x-elevenlabs-secret: <your-secret>` in all webhook requests.

The Dashboard home page displays your exact webhook URLs once deployed.

---

## GHL Integration Details

### Contact Creation
When a user registers and saves their phone number, the portal:
1. Searches GHL for an existing contact by email/phone
2. Creates a new contact if not found
3. Stores the `ghlContactId` in `user_identity_map`
4. Tags the contact with `Portal User`

### Post-Call Sync
After each call, the webhook:
1. Updates the GHL contact with call metadata
2. Creates/updates a GHL opportunity in the pipeline
3. Adds a note with transcript summary and safety result
4. Logs a conversation message with the call outcome

### Consent Verification
When ElevenLabs detects consent during a call:
1. Webhook fires to `/api/webhooks/elevenlabs/consent`
2. GHL contact is tagged with `Consent Verified`
3. `consentGiven` and `consentTimestamp` are updated in `user_identity_map`
4. Socket.IO broadcasts `consent:verified` event to connected clients

---

## Database Schema

| Table | Purpose |
|---|---|
| `users` | Portal user accounts (Manus OAuth) |
| `user_identity_map` | Links portal users to GHL contacts and ElevenLabs agents |
| `call_sessions` | Tracks each call session with status, duration, and safety result |
| `call_transcripts` | Stores transcript chunks per session |
| `failed_sync_queue` | Queues failed GHL webhook syncs for retry |

---

## Development

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Run tests
pnpm test

# Type check
npx tsc --noEmit

# Generate & apply DB migrations
pnpm drizzle-kit generate
pnpm drizzle-kit migrate
```

---

## Deployment (Railway)

1. Push to GitHub (see GitHub setup below)
2. Create a new Railway project and connect the GitHub repo
3. Add environment variables in Railway dashboard
4. Railway auto-detects Node.js and runs `pnpm build && pnpm start`
5. Configure your ElevenLabs webhooks to point to the Railway URL

---

## GitHub Setup

```bash
gh repo create dementiahub-dashboard --private
git remote add origin https://github.com/<your-org>/dementiahub-dashboard.git
git push -u origin main
```

---

## Pages

| Route | Description |
|---|---|
| `/` | Dashboard with stats, recent calls, integration status |
| `/call` | Start a new voice call |
| `/call/:sessionId` | Call details with transcript |
| `/call/:sessionId/live` | Live call monitor with real-time transcript |
| `/history` | Full call history with filters |
| `/profile` | User profile and GHL contact management |
