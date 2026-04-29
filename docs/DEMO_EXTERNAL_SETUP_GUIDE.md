# DementiaHub Demo External Setup Guide

Use this before the HSKD dry run to connect the portal to Wibiz/GHL, ElevenLabs, and Twilio.

## Required Portal Environment

Set these in the deployed environment, then restart the app:

```bash
APP_URL=https://<your-demo-domain>
DATABASE_URL=<mysql-url>
JWT_SECRET=<strong-random-secret>

GHL_API_KEY=<sub-account-private-integration-token>
GHL_LOCATION_ID=<sub-account-location-id>
GHL_CASES_PIPELINE_ID=<optional-pipeline-id>

ELEVENLABS_API_KEY=<elevenlabs-api-key>
ELEVENLABS_AGENT_ID=<agent-id>
ELEVENLABS_POSTCALL_WEBHOOK_SECRET=<strong-random-secret>
ELEVENLABS_CONSENT_WEBHOOK_SECRET=<strong-random-secret>

TWILIO_ACCOUNT_SID=<twilio-account-sid>
TWILIO_AUTH_TOKEN=<twilio-auth-token>
TWILIO_PHONE_NUMBER=<sms-number>
TWILIO_WHATSAPP_NUMBER=whatsapp:<whatsapp-number>

ADMIN_EMAILS=juliana@example.com,aileen@example.com
STAFF_EMAILS=<staff-email-1>,<staff-email-2>

VOICE_QA_MODE=true
QA_APPROVED_PHONE_NUMBERS=+65XXXXXXXX,+65YYYYYYYY
```

After deploy, open:

```text
https://<your-demo-domain>/api/webhooks/health
```

Pass condition:

- `ghl` is `configured`
- `elevenlabs` is `configured`
- `twilio` is `configured` if WhatsApp/SMS is part of the demo
- both ElevenLabs webhook secrets show `configured`

## GHL / Wibiz Setup

1. In the correct sub-account/location, create or confirm a Private Integration token.
2. Token must be for the same location as `GHL_LOCATION_ID`.
3. Grant scopes for contacts, tags, notes, conversations/messages, locations/custom fields, pipelines, and opportunities.
4. Create or confirm the pipeline named:

```text
Caregiver Cases
```

5. Confirm these exact stage names exist:

```text
Needs Staff - Awaiting Contact
Callback Scheduled
Self-Serve Resolved
```

6. Confirm these tags are allowed/usable:

```text
Portal User
DementiaHub
Consent Verified
Portal Consent
Voice Case - SAFE
Voice Case - CAUTION
Voice Case - UNSAFE
Callback Requested
Portal Chat - SAFE
Portal Chat - CAUTION
Portal Chat - UNSAFE
```

7. Confirm opportunity/contact custom fields exist or can be created by your GHL owner:

```text
safety_gate_result
safety_flag_type
case_channel
case_category
callback_requested
resolution_type
escalation_triggered
case_notes
chat_transcript
last_call_summary
last_call_safety_result
last_call_topic
last_call_transcript
last_call_resolution
consent_given
consent_channel
consent_timestamp
```

Dry-run pass condition:

- New portal caregiver profile creates or links one GHL contact.
- Escalated chat/call creates or updates one open opportunity in `Needs Staff - Awaiting Contact`.
- Callback request moves/creates an opportunity in `Callback Scheduled`.
- Safe self-serve case moves/creates an opportunity in `Self-Serve Resolved`.

## ElevenLabs Setup

1. Use the intended live/test Conversational AI agent and copy its agent ID into `ELEVENLABS_AGENT_ID`.
2. Configure post-call webhook:

```text
POST https://<your-demo-domain>/api/webhooks/elevenlabs/post-call
Header: x-elevenlabs-secret: <ELEVENLABS_POSTCALL_WEBHOOK_SECRET>
```

3. Configure consent webhook or tool/webhook action:

```text
POST https://<your-demo-domain>/api/webhooks/elevenlabs/consent
Header: x-elevenlabs-secret: <ELEVENLABS_CONSENT_WEBHOOK_SECRET>
```

4. Confirm the agent accepts these dynamic variables:

```text
caregiver_name
caregiver_email
portal_user_id
portal_open_id
ghl_contact_id
ghl_location_id
wibiz_contact_id
wibiz_location_id
caregiver_language
session_id
portal_call_session_id
```

5. Configure analysis/data collection fields so post-call payloads can include:

```text
safety_result
safety_flag_type
topic_classified
callback_requested
consent_verbally_confirmed
whatsapp_summary_requested
resolution_type
escalation_triggered
call_summary
```

Dry-run pass condition:

- Browser/phone voice call receives the logged-in caregiver variables.
- Post-call webhook returns `200`.
- Portal history updates from active/completed into completed/synced state.
- Staff portal shows UNSAFE/CAUTION cases.

## Twilio Setup

Configure these webhooks on the Twilio number or messaging service used for the demo:

```text
Incoming message webhook:
POST https://<your-demo-domain>/api/webhooks/twilio/messaging

Message status callback:
POST https://<your-demo-domain>/api/webhooks/twilio/status

Incoming voice webhook:
POST https://<your-demo-domain>/api/webhooks/twilio/voice
```

The portal verifies Twilio signatures when `TWILIO_AUTH_TOKEN` is configured, so the webhook URL must match the public deployed URL Twilio calls.

Dry-run pass condition:

- WhatsApp/SMS from a linked caregiver phone creates a portal chat message.
- Unknown phone receives the sign-in/linking response.
- Staff portal updates within the 15-second polling window.

## Demo Dry Run Order

1. Confirm `/api/webhooks/health`.
2. Log in as admin and open `/demo/dry-run`.
3. Confirm `Wibiz connected` is ready.
4. Create one fresh caregiver and link phone/contact.
5. Run standard inquiry.
6. Run distressed caregiver escalation.
7. Run off-hours contact.
8. Run repeated contact.
9. Run unrecognized/mixed input.
10. Run voice only if all internal voice tests pass.

