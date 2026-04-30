# DementiaHub Team Dry Run Runbook

Audience: internal demo team, product owners, care operations, CRM/Wibiz owner, voice owner, and technical support.

Purpose: provide a controlled, fool-proof rehearsal script that proves the full project value without relying on improvisation. This runbook is for the team before and during the dry run. For the board-facing talk track, use `docs/BOARD_DEMO_SCRIPT_GUIDE.md`.

Demo principle: show caregiver simplicity, staff accountability, and admin governance. Keep the demo calm, human, and operationally credible.

## 1. Actor Roster

Minimum team: 6 people.

| Actor | Person Assigned | Owns | During demo |
|---|---|---|---|
| Stage Manager | TBD | Timing, sequence, pass/fail decisions | Calls each cue, stops drift, decides fallback |
| Lead Presenter | TBD | Main narration | Speaks to audience and bridges role switches |
| Caregiver Actor | TBD | Caregiver account and prompts | Types or speaks only approved caregiver prompts |
| Staff Actor | TBD | Staff portal and human follow-up | Reviews escalated case, sends staff reply |
| Admin Actor | TBD | Admin readiness and governance | Shows dry-run center, records, diagnostics |
| Technical Operator | TBD | Browser tabs, audio, network, recovery | Keeps backup tabs open, handles errors quietly |
| CRM/Wibiz Owner | TBD | Wibiz/GHL verification | Confirms contact, tags, notes, opportunity state |
| Voice Owner | TBD | ElevenLabs/browser voice readiness | Runs voice tests and decides whether voice is safe to show |

Minimum live actors if short-handed: Stage Manager, Lead Presenter, Caregiver Actor, Staff/Admin Actor, Technical Operator.

Do not let the Lead Presenter operate the browser. The presenter should stay focused on story, timing, and audience confidence.

## 2. Demo Accounts And Devices

Prepare these before the dry run.

| Account | Role | Purpose | Must be confirmed |
|---|---|---|---|
| Mei Tan | Caregiver | Fresh or controlled caregiver journey | Can log in, phone/profile ready, no unrelated history |
| Juliana | Staff | Human follow-up and case ownership | Can access `/portal/staff` |
| Aileen | Admin | Governance and integration views | Can access `/demo/dry-run`, `/admin/conversations`, `/admin/integration` |

Device setup:

- Main demo laptop: browser zoom 90-100%, notifications muted, no bookmarks or secrets visible.
- Backup laptop: logged in to admin and caregiver accounts, same environment.
- Phone/audio device: only if voice is part of the live demo.
- CRM/Wibiz screen: hidden from audience unless explicitly needed.
- Internal comms: one silent backchannel for Stage Manager, Technical Operator, CRM Owner, and Voice Owner.

## 3. Pre-Flight Checklist

Run this 60-90 minutes before the dry run.

| Check | Owner | Pass condition |
|---|---|---|
| App loads | Technical Operator | Demo URL opens without console-visible failures |
| Admin login | Admin Actor | `/demo/dry-run` opens |
| Caregiver login | Caregiver Actor | Dashboard, Assistant, Profile, History open |
| Staff login | Staff Actor | `/portal/staff` opens |
| Integration health | Admin Actor | `/api/webhooks/health` shows required services configured |
| Wibiz/GHL link | CRM Owner | Demo caregiver has correct contact or can create one |
| Assistant chat | Caregiver Actor | Standard prompt receives a useful answer |
| Escalation visibility | Staff Actor | Distress case appears in staff/admin view |
| Voice readiness | Voice Owner | All internal voice tests pass twice |
| Backup evidence | Technical Operator | Screenshots or pre-seeded records ready if live integration slows |

Hard stop rules:

- If admin cannot log in, do not start the dry run.
- If caregiver account shows unrelated or sensitive records, replace the account.
- If voice fails any internal test, do not show live voice. Use the saved voice record fallback.
- If Wibiz/GHL is unstable, continue with portal-only journey and say "external workflow verification is running in the background."

## 4. Browser Tab Setup

Technical Operator opens these tabs in order.

1. Caregiver dashboard: `/`
2. Caregiver assistant: `/assistant`
3. Caregiver profile: `/profile`
4. Caregiver history: `/history`
5. Staff portal: `/portal/staff`
6. Admin dry-run center: `/demo/dry-run`
7. Admin conversations: `/admin/conversations`
8. Admin integration: `/admin/integration`
9. Optional voice page: `/call`
10. Optional health endpoint: `/api/webhooks/health`

Keep CRM/Wibiz and ElevenLabs tabs off the projected screen unless needed for a technical audience.

## 5. Controlled Demo Flow

Target duration: 22 minutes.

| Segment | Time | Actor driving | Value shown |
|---|---:|---|---|
| Opening | 1 min | Lead Presenter | Caregiver support plus operational accountability |
| Admin readiness | 3 min | Admin Actor | Governance before live usage |
| Caregiver standard inquiry | 4 min | Caregiver Actor | Simple support and continuity |
| Distress escalation | 5 min | Caregiver Actor + Staff Actor | Human handoff for serious cases |
| Off-hours callback | 3 min | Caregiver Actor + Staff Actor | No dead silence, follow-up trail |
| Voice journey | 4 min | Voice Owner + Caregiver Actor | Spoken support and saved record |
| Admin closeout | 2 min | Admin Actor + Lead Presenter | Workflow visibility and next-step confidence |

Stage Manager should call time at the halfway point of each segment. If a segment exceeds its time by 60 seconds, move to the next planned screen.

## 6. Segment-By-Segment Script

### Segment 0: Opening

Screen: Admin dry-run center, `/demo/dry-run`

Lead Presenter says:

> Today we are showing DementiaHub as a guided support portal for caregivers and the team behind them. The goal is not to replace human care. The goal is to listen consistently, preserve context, and route the right cases to staff before they are missed.

> We will show three views: caregiver, staff, and admin. Together they show the full journey from first contact to follow-up and oversight.

Stage Manager cue: "Move to admin readiness."

Pass condition: audience understands the three-view structure.

### Segment 1: Admin Readiness

Screen order:

1. `/demo/dry-run`
2. `/admin/integration`
3. `/admin/conversations`

Admin Actor actions:

1. Show dry-run readiness cards.
2. Open integration diagnostics.
3. Show Wibiz/support workflow readiness.
4. Open admin conversations.
5. Show caregiver directory and recent activity.

Lead Presenter says:

> Before any caregiver journey, the team checks readiness. This gives operations an answer to three questions: are we connected, are cases visible, and is anything stuck?

> This is important because caregiver support cannot depend on guesswork. The admin view gives the team a control layer.

What not to say:

- Do not name raw backend vendors unless asked.
- Do not show API keys, IDs, secrets, or raw webhook payloads.
- Do not claim production metrics that are not measured.

Pass condition:

- Admin readiness page opens.
- Integration status is visible.
- Recent caregiver or support activity is visible.

Fallback line if diagnostics are slow:

> The diagnostic check is still refreshing, so we will continue with the prepared record and come back to the health view at the end.

Stage Manager cue: "Switch to caregiver standard inquiry."

### Segment 2: Caregiver Standard Inquiry

Screen order:

1. Caregiver dashboard `/`
2. Profile `/profile`
3. Assistant `/assistant`
4. History `/history`

Caregiver Actor actions:

1. Show caregiver dashboard.
2. Open profile and confirm phone/contact setup is ready.
3. Open Support Assistant.
4. Type the exact prompt below.

Approved prompt:

```text
I am looking for dementia care services for my mother. Can someone help me understand what options are available?
```

Expected assistant result:

- Empathetic response.
- Practical next questions or next steps.
- No medical overclaiming.
- Conversation is saved.
- No internal safety score appears to the caregiver.

Lead Presenter says:

> This is the normal caregiver path. The caregiver is not asked to understand systems or workflows. They simply ask for help in plain language.

After the assistant response, Caregiver Actor opens History.

Lead Presenter says:

> The important part is continuity. When this caregiver returns, the conversation is not lost and the team can review the support history.

Pass condition:

- Assistant replies.
- Conversation appears in history.
- Caregiver view does not expose internal triage details.

Fallback line if assistant response is slow:

> The live response is taking longer than expected, so we will use the saved conversation record to show the same continuity outcome.

Stage Manager cue: "Move to distress escalation."

### Segment 3: Distress Escalation And Staff Handoff

Screen order:

1. Caregiver Assistant `/assistant`
2. Staff portal `/portal/staff`
3. Admin conversations `/admin/conversations` if staff portal needs backup

Caregiver Actor types:

```text
I cannot cope anymore. I am desperate and I do not know what to do.
```

Expected assistant result:

- Calm supportive response.
- Emergency guidance if there is immediate danger.
- Stops treating the case as routine.
- Routes or flags for staff attention.

Lead Presenter says:

> This is where the system must change posture. A serious message should not be handled like a normal FAQ. The caregiver receives calm language, while staff receive the operational signal.

Staff Actor actions:

1. Open Staff Portal.
2. Find the latest case for Mei Tan.
3. Open the case.
4. Show staff-only context.
5. Send the approved staff reply.

Approved staff reply:

```text
Hi Mei, this is Juliana from the DementiaHub support team. I am sorry this has been so overwhelming. I am going to follow up with you directly so we can understand what is happening and help you with next steps.
```

Lead Presenter says:

> Staff do not need to piece together where the message came from. They can see the caregiver, the recent context, and the follow-up need in one operational view.

Pass condition:

- Distressed case is visible to staff or admin.
- Staff can send or demonstrate human follow-up.
- Caregiver-facing page stays calm and respectful.

Fallback line if staff queue does not refresh:

> The staff queue refresh can take a moment, so we will open the same caregiver from the admin conversation view and show the staff review path there.

Stage Manager cue: "Move to off-hours callback."

### Segment 4: Off-Hours Callback

Screen order:

1. Caregiver Assistant `/assistant`
2. Staff Portal `/portal/staff`

Caregiver Actor types:

```text
It is late at night and I need help arranging care tomorrow. Can someone contact me?
```

Expected assistant result:

- Acknowledges the request.
- Sets realistic expectations.
- Encourages emergency services if immediate danger is present.
- Captures callback or follow-up need internally.

Lead Presenter says:

> Many caregiver needs happen outside office hours. The important experience here is not silence. The caregiver receives a clear holding response and the team has a follow-up trail.

Staff Actor actions:

1. Show callback or follow-up status in the staff/admin view.
2. Confirm the case is actionable.

Pass condition:

- Callback need is visible or can be explained from the case record.
- No claim is made that live staff are available if they are not.

Fallback line if callback status is not visible:

> The message is captured in the caregiver record. Callback tagging is the operational layer we verify in Wibiz after the run.

Stage Manager cue: "Voice decision."

### Segment 5: Voice Journey

Before this segment, Voice Owner tells Stage Manager either "voice green" or "use saved voice fallback."

If voice is green:

Screen order:

1. `/call`
2. Live call monitor if opened
3. `/history`
4. Call detail page

Caregiver Actor speaks:

```text
Hi, I am caring for my mother who has dementia. I want to understand what support options are available and whether someone can guide me.
```

Optional callback voice line:

```text
Can someone call me tomorrow morning? I would like to speak to a person about care options.
```

Lead Presenter says:

> Some caregivers may prefer speaking rather than typing. The value is not only the live conversation. The value is that the call becomes a support record the team can review.

Expected result:

- Call starts.
- Assistant responds.
- Call record appears in history or prepared call record is shown.
- Transcript or summary is available for review.

If voice is not green:

Lead Presenter says:

> We tested the voice path before this session and chose not to run it live because we want the dry run to stay controlled. Here is the saved call record showing the intended outcome: transcript, summary, and staff visibility.

Pass condition:

- Either live voice succeeds, or saved voice record clearly shows the same workflow.

Stage Manager cue: "Admin closeout."

### Segment 6: Admin Closeout

Screen order:

1. `/admin/conversations`
2. `/admin/integration`
3. `/demo/dry-run`

Admin Actor actions:

1. Show caregiver record with chat and/or voice history.
2. Show recent activity.
3. Show integration or failed-sync visibility.
4. Return to dry-run center.

Lead Presenter says:

> What we demonstrated is the full operating model. Caregivers get a simple support experience. Staff get context and follow-up signals. Admins get visibility into readiness and workflow health.

> DementiaHub is a support and routing layer. It improves continuity, responsiveness, and accountability while keeping human care teams in control.

Pass condition:

- Admin can locate the caregiver record.
- Admin can see activity and workflow health.
- The closing message reinforces human oversight.

## 7. Approved Prompts Only

Do not improvise urgent, self-harm, medical, or legal content during the dry run. Use only these prompts.

| Scenario | Prompt |
|---|---|
| Standard inquiry | `I am looking for dementia care services for my mother. Can someone help me understand what options are available?` |
| Distress escalation | `I cannot cope anymore. I am desperate and I do not know what to do.` |
| Off-hours callback | `It is late at night and I need help arranging care tomorrow. Can someone contact me?` |
| Repeated contact | `Following up on our earlier conversation, my father is sundowning again and I need next steps.` |
| Unclear input | `asdf qwer lah I don't know what thing ??? can or not?` |
| Voice standard | `Hi, I am caring for my mother who has dementia. I want to understand what support options are available and whether someone can guide me.` |
| Voice callback | `Can someone call me tomorrow morning? I would like to speak to a person about care options.` |

## 8. Fallback Matrix

| Problem | Owner | Immediate action | Presenter line |
|---|---|---|---|
| App page slow | Technical Operator | Refresh once, then switch to prepared tab | `We will use the prepared record so the flow stays clear.` |
| Assistant response slow | Caregiver Actor | Open saved history | `The live response is still generating, so we will show the saved result of the same workflow.` |
| Staff queue delayed | Staff Actor | Use admin conversations view | `The queue refresh can take a moment; the same case is visible from admin records.` |
| Voice unstable | Voice Owner | Use saved voice record | `We tested voice before the session and will show the saved record for a controlled run.` |
| Wibiz/GHL unavailable | CRM Owner | Verify after session | `External workflow verification is running separately; the portal record remains intact.` |
| Wrong account visible | Stage Manager | Stop screen share, switch account | `Give us one moment to switch to the clean demo account.` |
| Sensitive data visible | Stage Manager | Stop screen share immediately | `We are pausing screen share briefly before continuing.` |

## 9. Pass/Fail Scorecard

Use this immediately after the dry run.

| Area | Pass | Fail notes |
|---|---|---|
| Admin readiness visible | Yes / No | |
| Caregiver standard inquiry completed | Yes / No | |
| Conversation saved to history | Yes / No | |
| Distress escalation visible to staff/admin | Yes / No | |
| Staff reply or handoff demonstrated | Yes / No | |
| Off-hours callback captured | Yes / No | |
| Voice shown live or via saved record | Yes / No | |
| Admin can locate final caregiver record | Yes / No | |
| No sensitive data exposed | Yes / No | |
| No unsupported claims made | Yes / No | |

Overall dry-run decision:

- Green: all critical rows pass.
- Amber: core portal flow passes, but one integration needs manual verification.
- Red: login, caregiver history, staff visibility, or sensitive-data control fails.

Critical rows: admin readiness, caregiver standard inquiry, saved history, distress escalation visibility, no sensitive data exposed.

## 10. Rehearsal Schedule

Run three rehearsals.

1. Technical rehearsal: no audience, stop often, verify every integration.
2. Timing rehearsal: run the full script under 25 minutes, no ad-libbing.
3. Final rehearsal: treat it like the real dry run, use backup only if needed.

After each rehearsal:

- Record what failed.
- Assign one owner per fix.
- Re-run only the failed segment.
- Do not add new demo content after the final rehearsal unless it fixes a blocker.

## 11. Final Team Notes

- The safest story is not "the system does everything." The safest story is "the system helps the right humans act sooner."
- Do not over-explain technology. Show the operational outcome.
- Do not show raw integration setup unless the audience is technical.
- Do not promise clinical diagnosis, emergency response, or guaranteed real-time human availability.
- Keep the caregiver experience simple, the staff workflow accountable, and the admin view grounded in readiness.
