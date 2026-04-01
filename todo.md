# DementiaHub Dashboard TODO

## Phase 1: Database Schema & Identity Mapping
- [x] Create user_identity_map table with GHL contact mapping fields
- [x] Create call_sessions table for tracking ElevenLabs conversations
- [x] Create call_transcripts table for storing real-time transcript data
- [x] Create failed_sync_queue table for retry support
- [x] Generate and apply database migrations via drizzle-kit

## Phase 2: API Service Layers
- [x] Create GHL API service with contact search, update, tag management
- [x] Create GHL API service for opportunity management and pipeline stages
- [x] Create ElevenLabs API service for conversation retrieval
- [x] Create ElevenLabs API service for call initiation with dynamic variables
- [x] Set up environment variables for API keys and webhook secrets (GHL_API_KEY, GHL_LOCATION_ID, ELEVENLABS_API_KEY, ELEVENLABS_AGENT_ID, ELEVENLABS_WEBHOOK_SECRET)
- [x] server/config.ts with all environment variable bindings

## Phase 3: User Authentication & GHL Sync
- [x] Extend user registration to create GHL contact on signup via ensureGHLIdentity()
- [x] Build identity mapping logic to link portal user to GHL contact
- [x] Store ghl_contact_id in user_identity_map table
- [x] Handle phone number collection during registration
- [x] Post-login sync hook in auth router

## Phase 4: tRPC Backend Routers
- [x] Create calls router: initiateCall, getCallHistory, getCallDetails, markCallCompleted procedures
- [x] Create identity router: getMyIdentity, setupIdentity, getGHLContact, updateProfile, checkSetupStatus procedures
- [x] Create ghl router: getIntegrationStatus, getPipelineStages procedures (cached)

## Phase 5: Webhook Endpoints
- [x] POST /api/webhooks/elevenlabs/post-call — receives and processes ElevenLabs post-call data
- [x] POST /api/webhooks/elevenlabs/consent — real-time consent verification with GHL tag update
- [x] Webhook secret verification (x-elevenlabs-secret header)
- [x] Post-call data sync to GHL (contact update, opportunity, note, conversation message)
- [x] Failed sync queue with retry support
- [x] GET /api/webhooks/health endpoint

## Phase 6: Frontend UI
- [x] DashboardLayout with DementiaHub navigation (Dashboard, Start a Call, History, Profile, Admin)
- [x] Healthcare-themed color palette (calm teal/blue, Inter font)
- [x] Dashboard home page with stats, recent calls, integration status, webhook URLs
- [x] Call Initiation page with GHL contact linkage display
- [x] Call History page with filters (safety, status) and search
- [x] Call Details page with full transcript viewer and GHL sync status
- [x] Profile page with phone number management and GHL contact sync
- [x] Setup checklist and incomplete profile banner
- [x] Loading states, empty states, and toast notifications throughout

## Phase 7: Real-Time WebSocket
- [x] Socket.IO server initialization on /api/socket.io
- [x] useCallSocket React hook for real-time transcript streaming
- [x] LiveCallPage with real-time transcript display and consent indicator
- [x] broadcastTranscriptChunk, broadcastCallStatus, broadcastConsentVerified helpers
- [x] Session room management (join/leave)

## Phase 8: Testing & Deployment
- [x] Vitest tests for webhook secret verification
- [x] Vitest tests for auth router (me, logout)
- [x] Vitest tests for ghl router (getIntegrationStatus)
- [x] Vitest tests for identity router (checkSetupStatus, getMyIdentity)
- [x] Vitest tests for calls router (getCallHistory, getCallDetails)
- [x] All 23 tests passing
- [x] Create comprehensive README.md with setup instructions
- [ ] Save checkpoint for deployment
- [ ] Set up GitHub repository and push code
