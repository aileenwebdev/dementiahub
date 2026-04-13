# DementiaHub Dashboard QA and Sync Guide

## Current repo status

- Local repository is up to date with GitHub `main`.
- Checked on April 13, 2026.
- Result after `git fetch origin` and `git rev-list --left-right --count origin/main...HEAD`: `0 0`
- Local `origin` remote matches: `https://github.com/aileenwebdev/dementiahub.git`

## Automated checks run locally

- `pnpm test` ✅
- `pnpm check` ✅
- Current automated coverage is backend-heavy.
- Existing tests cover config, logout, and a subset of router behaviors.
- There is still no meaningful automated UI regression coverage for admin pages, caregiver flows, ElevenLabs live/browser voice flows, or GHL sync verification.

## What exists in the product today

### Caregiver portal

- Dashboard home
- AI assistant
- Browser voice call
- Phone call flow
- Call history
- Call details
- Live call monitor
- Profile and Wibiz contact linking

### Admin portal

- Caregiver directory
- Caregiver detail inspection
- Recent AI activity
- Recent voice outcomes
- Integration diagnostics
- Failed sync queue

### External integrations

- ElevenLabs agent and conversations
- ElevenLabs post-call webhook
- ElevenLabs consent webhook
- GHL/Wibiz contact sync
- GHL opportunity pipeline sync
- GHL notes and tags sync

## High-priority test plan

### 1. Authentication and access control

Test with:

- one admin account
- one normal caregiver account
- one brand-new account

Check:

- caregiver can sign up
- caregiver can log in and log out
- caregiver lands in the caregiver portal only
- caregiver cannot use admin pages
- admin can open `/admin/conversations`
- admin can open `/admin/integration`
- session remains valid after refresh
- logout clears access to protected data

Expected:

- non-admin users see admin access blocked
- protected pages never leak another caregiver's data

## Caregiver portal test checklist

### 2. Dashboard home

Check:

- stats load without console errors
- recent call history renders correctly
- integration status card reflects actual setup
- incomplete profile warning appears when phone is missing
- quick actions route correctly

Verify data consistency:

- total calls matches history count
- safe calls count matches completed records
- callback due count reflects unresolved callback cases

### 3. Profile and Wibiz contact setup

Source files:

- [client/src/pages/ProfilePage.tsx](/C:/dementiahub-dashboard/client/src/pages/ProfilePage.tsx)
- [server/routers/identity.ts](/C:/dementiahub-dashboard/server/routers/identity.ts)
- [server/services/identitySync.ts](/C:/dementiahub-dashboard/server/services/identitySync.ts)

Test cases:

- save a phone number with country code
- create Wibiz contact for a new caregiver
- re-sync an existing caregiver
- verify consent badge after consent flow
- verify language and phone persist after refresh

Check in dashboard:

- phone is shown correctly
- Wibiz contact ID appears after successful sync
- setup checklist updates immediately
- re-sync does not create obvious duplicates

Check in GHL/Wibiz:

- contact exists in the correct location
- contact name and email match portal user
- contact phone matches portal phone
- tags include `Portal User` and `DementiaHub`
- consent tags appear when consent is recorded
- custom fields include portal linkage values if configured

Watch for:

- duplicate contact creation when phone formatting changes
- missing country code causing failed search/match
- contact linked in portal but wrong contact in GHL

### 4. AI assistant

Source files:

- [client/src/pages/AssistantPage.tsx](/C:/dementiahub-dashboard/client/src/pages/AssistantPage.tsx)
- [server/routers/ai.ts](/C:/dementiahub-dashboard/server/routers/ai.ts)
- [server/services/chatSync.ts](/C:/dementiahub-dashboard/server/services/chatSync.ts)

Test cases:

- open assistant as existing caregiver
- confirm saved history reloads
- send new user messages
- receive assistant responses
- reload the page and verify continuity
- log out and log in as a different caregiver and confirm no cross-user leakage

Check:

- recognized identity sidebar shows correct portal user
- Wibiz contact ID matches profile page
- safety and topic fields update when applicable
- chat persists and appears in admin recent AI activity

### 5. Browser voice call

Source files:

- [client/src/pages/CallPage.tsx](/C:/dementiahub-dashboard/client/src/pages/CallPage.tsx)
- [server/routers/calls.ts](/C:/dementiahub-dashboard/server/routers/calls.ts)

Test cases:

- start browser voice call
- confirm live room opens
- speak as caregiver and confirm transcript appears
- complete the call
- confirm call is stored in history
- open call details and verify transcript and summary

Check:

- session is created before voice room opens
- session status moves from active to completed/synced
- transcript chunks save
- triage fields populate: safety, topic, callback, resolution
- history item opens the correct session

Important manual verification:

- browser voice call uses the logged-in caregiver identity
- prompt includes caregiver name and linked Wibiz contact context
- no other caregiver data appears in the session

### 6. Real phone call flow

Source files:

- [client/src/pages/CallPage.tsx](/C:/dementiahub-dashboard/client/src/pages/CallPage.tsx)
- [server/services/elevenlabs.ts](/C:/dementiahub-dashboard/server/services/elevenlabs.ts)

Test cases:

- attempt phone call before setup is complete
- verify blocking message appears
- complete profile and Wibiz link
- start a real call to a safe test number
- confirm call session is created
- confirm ElevenLabs conversation ID is stored
- confirm webhook later marks the session as synced

Check:

- correct phone number is used
- dynamic variables include `ghl_contact_id`, `ghl_location_id`, `portal_user_id`, and `session_id`
- post-call summary lands in dashboard and GHL

## Admin portal test checklist

### 7. Admin conversations page

Source file:

- [client/src/pages/AdminConversationsPage.tsx](/C:/dementiahub-dashboard/client/src/pages/AdminConversationsPage.tsx)

Test cases:

- open caregiver directory
- search by name
- search by email
- search by phone
- search by Wibiz contact ID
- inspect one caregiver with calls
- inspect one caregiver with chats

Check:

- stats cards load
- selected caregiver updates correctly
- recent voice calls open the right session
- saved AI threads preview correctly
- consent and Wibiz link status match profile data

### 8. Admin integration page

Source file:

- [client/src/pages/AdminIntegrationPage.tsx](/C:/dementiahub-dashboard/client/src/pages/AdminIntegrationPage.tsx)

Test cases:

- load diagnostics with valid credentials
- refresh diagnostics
- refresh Wibiz pipeline cache
- inspect recent ElevenLabs conversations
- inspect failed sync queue
- open health endpoint

Check:

- Wibiz configured and connected values are correct
- caregiver pipeline is found
- stage list matches actual GHL pipeline
- ElevenLabs agent ID matches the live production/test agent
- recent conversations correspond to real ElevenLabs records
- failed sync queue is empty or actionable

## End-to-end sync scenarios your team should run

### 9. New caregiver onboarding sync

Steps:

- create a new caregiver account
- save phone number
- create Wibiz contact from profile
- open assistant
- start browser call
- complete call

Confirm:

- portal user exists in local DB and dashboard
- identity map links caregiver to correct GHL contact
- assistant session is saved
- call session is saved
- admin can see the caregiver, conversation, and call
- GHL contact exists and is the same linked contact

### 10. Consent sync

Source files:

- [server/webhooks.ts](/C:/dementiahub-dashboard/server/webhooks.ts)
- [server/services/identitySync.ts](/C:/dementiahub-dashboard/server/services/identitySync.ts)

Steps:

- trigger consent through the intended ElevenLabs flow
- wait for `/api/webhooks/elevenlabs/consent`

Confirm in portal:

- caregiver profile shows consent verified
- admin page shows consent verified

Confirm in GHL:

- `Consent Verified` tag exists
- consent timestamp field is updated
- consent channel is correct for the path used

### 11. Post-call sync to GHL

Source files:

- [server/services/postCallSync.ts](/C:/dementiahub-dashboard/server/services/postCallSync.ts)
- [server/services/ghl.ts](/C:/dementiahub-dashboard/server/services/ghl.ts)

Steps:

- complete a voice call that includes a clear topic and outcome
- let ElevenLabs send the post-call webhook

Confirm in portal:

- session changes to `synced`
- transcript is stored
- call summary is stored
- safety result is stored
- callback flag is correct
- topic classification is correct

Confirm in GHL:

- contact was updated
- call tags were added
- opportunity was created or updated in the `Caregiver Cases` pipeline
- opportunity stage matches the rules:
  - unsafe or caution -> `Needs Staff - Awaiting Contact`
  - callback requested -> `Callback Scheduled`
  - self serve -> `Self-Serve Resolved`
- note contains summary and transcript
- custom fields were updated with safety, resolution, transcript, and case notes

### 12. Failed sync recovery

Steps:

- intentionally break a webhook dependency in a non-production environment
- send a consent or post-call event

Confirm:

- webhook returns failure and queues item
- admin failed sync queue shows the item
- error message is understandable
- team knows the manual replay process

Manual follow-up needed:

- define a repeatable retry/replay SOP because the code queues failures but there is no visible admin retry button in the UI yet

## ElevenLabs manual audit checklist

Open ElevenLabs and verify:

- the correct agent ID is the one configured in the app
- post-call webhook URL matches the current environment URL
- consent webhook URL matches the current environment URL
- secrets in ElevenLabs match server env values
- browser voice and phone call are both pointed at the intended agent
- agent prompt matches DementiaHub caregiver support scope
- dynamic variables expected by the portal are available and spelled correctly
- recent conversations in ElevenLabs match records visible in admin diagnostics
- test calls reach the right phone targets and not real end users unintentionally

Double-check variable names specifically:

- `ghl_contact_id`
- `ghl_location_id`
- `portal_user_id`
- `session_id`
- `portal_call_session_id`
- `wibiz_contact_id`
- `wibiz_location_id`

If any naming is off, sync will partially fail even when calls appear successful.

## GHL / Wibiz manual audit checklist

Open GHL and verify:

- API key belongs to the correct sub-account/location
- configured location ID matches the intended workspace
- `Caregiver Cases` pipeline exists exactly with the expected name
- stage names match the code expectations exactly
- contacts are being created in the right location
- duplicate contacts are not being created for the same caregiver
- contact tags are not being unexpectedly overwritten
- opportunity records are opening in the correct pipeline
- notes are attached to the correct contact
- custom field keys used by the app actually exist in GHL

Stage names expected by code:

- `Needs Staff - Awaiting Contact`
- `Callback Scheduled`
- `Self-Serve Resolved`

Tags and values to verify:

- `Portal User`
- `DementiaHub`
- `Consent Verified`
- `Portal Consent`
- `Voice Case - SAFE`
- `Voice Case - CAUTION`
- `Voice Case - UNSAFE`
- `Callback Requested`

## Manual fixes and double-checks identified from the code

### 1. Admin webhook secret status is misleading

Reference:

- [client/src/pages/AdminIntegrationPage.tsx:213](/C:/dementiahub-dashboard/client/src/pages/AdminIntegrationPage.tsx:213)

Issue:

- the admin page checks `integration.data?.webhooks.secretConfigured` as a single truthy value
- backend returns an object with separate `postCall` and `consent` booleans
- because objects are truthy, the UI can show "Configured on the server" even when one or both secrets are missing

What to do:

- split the UI into separate post-call and consent secret checks
- until that is fixed, trust `/api/webhooks/health` and server envs more than the badge

### 2. Admin page uses a hardcoded production health URL

Reference:

- [client/src/pages/AdminIntegrationPage.tsx:279](/C:/dementiahub-dashboard/client/src/pages/AdminIntegrationPage.tsx:279)

Issue:

- the "Open live webhook health" button is hardcoded to one Railway URL
- this can mislead testing in staging, preview, or local environments

What to do:

- replace with environment-driven URL from `APP_URL` or the integration query payload

### 3. Webhook secret has an insecure fallback default

Reference:

- [server/config.ts:15](/C:/dementiahub-dashboard/server/config.ts:15)

Issue:

- if env vars are missing, the app falls back to `dementiahub-webhook-secret-2026`
- that is convenient for local testing but risky if a real environment ever relies on the default

What to do:

- require explicit secrets in non-local environments
- add deployment checks so production cannot start with the default secret

### 4. Failed sync queue has monitoring but no visible replay workflow

Reference:

- [client/src/pages/AdminIntegrationPage.tsx:229](/C:/dementiahub-dashboard/client/src/pages/AdminIntegrationPage.tsx:229)
- [server/webhooks.ts:118](/C:/dementiahub-dashboard/server/webhooks.ts:118)

Issue:

- the queue is visible, but there is no admin action to retry queued items from the UI

What to do:

- document the manual replay process now
- later add admin retry and resolution controls

### 5. Real end-to-end coverage is still mostly manual

Evidence:

- backend tests pass, but there are no frontend or external integration tests for core caregiver/admin workflows

What to do:

- add Playwright or equivalent coverage for:
  - login/logout
  - profile linking
  - admin access control
  - assistant persistence
  - browser voice call completion path

## Recommended team regression set before every release

- caregiver signup and login
- caregiver profile save
- Wibiz contact creation
- assistant history persistence
- browser voice call start and completion
- post-call record appears in history
- consent tag sync
- admin caregiver lookup
- admin failed sync queue review
- admin integration diagnostics review
- ElevenLabs webhook health check
- GHL pipeline stage validation

## Suggested ownership split for your team

- QA/Product: caregiver portal journeys, UI consistency, error handling, mobile checks
- Admin/Ops: admin portal data accuracy, failed sync queue, webhook health, release signoff
- CRM owner: GHL contact rules, pipeline stages, tags, custom fields, duplicate prevention
- Voice AI owner: ElevenLabs agent config, webhooks, secrets, dynamic variables, call logs

## Release signoff checklist

- local branch matches GitHub target branch
- automated tests pass
- typecheck passes
- webhook health endpoint returns OK
- ElevenLabs webhooks point to the correct environment
- GHL location and pipeline are correct
- one fresh caregiver account tested end to end
- one existing caregiver account regression tested
- one admin account regression tested
- failed sync queue reviewed and empty or understood

