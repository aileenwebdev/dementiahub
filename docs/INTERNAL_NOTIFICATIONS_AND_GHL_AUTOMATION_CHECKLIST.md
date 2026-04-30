# Internal Notifications And GHL Automation Checklist

Audience: DementiaHub admins, staff leads, CRM/Wibiz owners, operations managers, and future support team members.

Purpose: list the manual follow-up work that still needs people today, then define the internal notifications and GHL automations that can be built as the project matures. This is separate from the demo script. It is an operations planning document.

Planning assumption: WhatsApp is not yet the primary connected channel. Once WhatsApp is connected, many staff/admin alerts can become automated internal notifications, task creation rules, pipeline moves, and follow-up reminders in GHL/Wibiz.

## 1. Operating Principle

DementiaHub should not only respond to caregivers. It should help the internal team notice, own, and close the right work.

The internal workflow should answer five questions:

1. What happened?
2. Who needs to act?
3. How urgent is it?
4. What is the next step?
5. Has the case been closed or followed up?

Until every notification path is automated, assign a human owner for each manual check.

## 2. Manual Work Needed Today

These items should be checked manually during dry runs, early pilots, and any period where WhatsApp/GHL automation is not fully connected.

| Manual item | Owner | When to check | What to do |
|---|---|---|---|
| New caregiver profile created | Admin or staff lead | Daily during pilot | Confirm name, email, phone, and Wibiz contact link |
| Missing phone number | Staff | Daily | Contact caregiver or ask them to complete profile |
| Wibiz/GHL contact linked | CRM owner | After signup or profile update | Confirm correct contact, no duplicate contact created |
| Standard assistant conversation saved | Staff | After test/demo conversation | Confirm the conversation appears in caregiver history and admin view |
| Distress/escalation case visible | Staff lead | Immediately after trigger | Confirm case is visible and assigned to a human |
| Callback request captured | Staff | Same business day | Create callback task or update opportunity stage |
| Off-hours request | Staff | Start of next business day | Review overnight requests and assign follow-up |
| Voice call completed | Voice owner or staff | After call | Confirm transcript, summary, and outcome are available |
| Consent verified | Admin or CRM owner | After consent flow | Confirm portal status and GHL tag/custom field |
| Failed sync queue reviewed | Admin | Daily during pilot | Identify stuck items and manually reconcile in GHL |
| Duplicate caregiver records | CRM owner | Weekly | Merge or mark duplicates, confirm portal links one correct contact |
| Staff reply sent | Staff lead | After escalated case | Confirm caregiver received human response |
| Case closed/resolved | Staff lead | End of day | Update status, notes, and next action |

## 3. Manual Staff Checklist

Use this checklist at the start and end of each operating day during pilot.

Start-of-day checklist:

- [ ] Open admin conversations.
- [ ] Review new caregiver records from the last 24 hours.
- [ ] Check for UNSAFE or CAUTION cases.
- [ ] Check for callback requested cases.
- [ ] Check for off-hours messages.
- [ ] Check failed sync queue.
- [ ] Confirm Wibiz/GHL pipeline stages look correct.
- [ ] Assign each open case to a staff member.
- [ ] Confirm no demo/test contacts are mixed with real caregiver records.

End-of-day checklist:

- [ ] Confirm every UNSAFE case has a named human owner.
- [ ] Confirm every callback request has a task, appointment, or note.
- [ ] Confirm every staff reply was sent or scheduled.
- [ ] Confirm unresolved items have a next follow-up date.
- [ ] Confirm failed sync items were reviewed.
- [ ] Add notes for any manual workaround used.
- [ ] Flag urgent blockers to the admin/CRM owner.

## 4. Case Types To Track Internally

Use consistent case types so GHL workflows can trigger cleanly later.

| Case type | Example trigger | Suggested urgency | Internal owner |
|---|---|---|---|
| Standard inquiry | Caregiver asks about dementia care services | Normal | Staff |
| Callback requested | Caregiver asks someone to call | High if same-day, normal otherwise | Staff |
| Distressed caregiver | "I cannot cope", "I am desperate" | High | Staff lead |
| Immediate safety concern | Missing person, danger, self-harm wording | Critical | Staff lead/admin |
| Off-hours contact | Message outside operating hours asking for help | High next business day | Staff |
| Repeated contact | Caregiver follows up on existing issue | Normal or high depending on content | Staff |
| Unclear input | Garbled, mixed language, incomplete request | Normal | Staff |
| Consent update | Caregiver confirms consent | Normal | Admin/CRM owner |
| Sync failure | Portal could not update GHL | Operational high | Admin/CRM owner |
| Duplicate record risk | Same phone/email appears twice | Operational normal | CRM owner |

## 5. Recommended GHL/Wibiz Tags

These tags help automation and reporting. Use exact names consistently if possible.

Caregiver identity:

- `Portal User`
- `DementiaHub`
- `WhatsApp Linked`
- `Phone Verified`
- `Consent Verified`

Case status:

- `Portal Chat - SAFE`
- `Portal Chat - CAUTION`
- `Portal Chat - UNSAFE`
- `Voice Case - SAFE`
- `Voice Case - CAUTION`
- `Voice Case - UNSAFE`
- `Callback Requested`
- `Staff Follow-Up Needed`
- `Staff Replied`
- `Resolved`
- `Off-Hours Contact`
- `Sync Review Needed`

Pilot/demo control:

- `Demo Contact`
- `Test Contact`
- `Do Not Contact - Demo`

## 6. Recommended GHL Pipeline Stages

Use or map to these stages for caregiver cases.

| Stage | Meaning | Exit condition |
|---|---|---|
| New Portal Contact | Caregiver just registered or linked | Profile/contact reviewed |
| Needs Staff - Awaiting Contact | Staff must review or respond | Staff accepts case |
| Callback Scheduled | Caregiver requested a call | Callback completed or rescheduled |
| In Staff Follow-Up | Staff is actively handling | Outcome recorded |
| Self-Serve Resolved | Safe inquiry answered without staff action | No further action needed |
| Escalated - Safety Review | Distress or immediate safety concern | Staff lead/admin reviews |
| Sync Review Needed | Portal/GHL update failed or mismatched | CRM owner resolves |
| Closed | Case complete | Final note added |

## 7. Internal Notifications To Build

These are the notification types the team should plan to automate.

| Notification | Trigger | Recipient | Channel | Priority |
|---|---|---|---|---|
| New caregiver registered | New portal user/contact created | Admin/staff lead | GHL task or internal email | Normal |
| Profile incomplete | Missing phone after signup | Staff | GHL task | Normal |
| Wibiz contact linked | Contact successfully created/linked | Admin/CRM owner | GHL note/activity | Low |
| Distressed caregiver | Safety result CAUTION or UNSAFE | Staff lead | GHL task + internal alert | High |
| Immediate safety review | UNSAFE or explicit danger wording | Staff lead/admin | GHL task + urgent internal alert | Critical |
| Callback requested | Callback flag true or tag added | Staff | GHL task + pipeline move | High |
| Off-hours message | Message received outside support hours | Staff next-day queue | GHL task | High |
| Staff reply needed | Assistant routes to human | Staff queue | GHL task | High |
| Staff reply sent | Human response sent | Admin/staff lead | GHL note/activity | Low |
| Voice call completed | Post-call summary received | Staff | GHL note/activity | Normal |
| Consent verified | Consent webhook or portal consent update | Admin/CRM owner | GHL tag + note | Normal |
| Failed sync created | Failed sync queue item inserted | Admin/CRM owner | GHL task or internal email | High |
| No staff action after SLA | Case open too long | Staff lead/admin | Escalation task | High |
| Case resolved | Resolution status set | Admin dashboard/activity | GHL note | Low |

## 8. GHL Automation Recipes

These are future workflow recipes the team can build in GHL/Wibiz once the fields, tags, and WhatsApp channel are ready.

### Automation A: New Portal Contact

Trigger:

- Contact tag added: `Portal User`

Actions:

1. Add tag `DementiaHub`.
2. Create internal task: "Review new caregiver profile."
3. If phone is missing, add tag `Profile Incomplete`.
4. If phone exists, assign to staff queue.
5. Add note: "Caregiver created from DementiaHub portal."

Checklist:

- [ ] Tag trigger works.
- [ ] Task owner is correct.
- [ ] Duplicate contacts are not created.
- [ ] Staff can see portal source in contact notes.

### Automation B: Distress Or Safety Escalation

Trigger:

- Tag added: `Portal Chat - UNSAFE`
- Tag added: `Voice Case - UNSAFE`
- Field `safety_gate_result` equals `UNSAFE`

Actions:

1. Move opportunity to `Escalated - Safety Review` or `Needs Staff - Awaiting Contact`.
2. Create urgent task for staff lead.
3. Add tag `Staff Follow-Up Needed`.
4. Send internal notification to assigned staff lead.
5. Add case note with transcript summary and recommended next step.

Checklist:

- [ ] Critical cases never stay in self-serve stage.
- [ ] Staff lead receives alert.
- [ ] Alert contains caregiver name, phone, latest message summary, and link to contact.
- [ ] Escalation does not send alarming automated messages to caregiver.

### Automation C: Callback Requested

Trigger:

- Tag added: `Callback Requested`
- Field `callback_requested` equals `true`
- Caregiver message contains approved callback intent from portal logic

Actions:

1. Move opportunity to `Callback Scheduled`.
2. Create task: "Call caregiver back."
3. Assign due date based on operating hours.
4. Send staff reminder if task is not completed by SLA.
5. After completion, add tag `Staff Replied` or `Resolved`.

Checklist:

- [ ] Callback task has an owner.
- [ ] Due date is clear.
- [ ] Missed callback reminder is active.
- [ ] Completed callback leaves a note.

### Automation D: Off-Hours Contact

Trigger:

- Message received outside operating hours.
- Tag added: `Off-Hours Contact`.

Actions:

1. Add tag `Staff Follow-Up Needed`.
2. Create next-business-day task.
3. Move case to `Needs Staff - Awaiting Contact`.
4. Optional: send caregiver acknowledgement through WhatsApp once approved.

Checklist:

- [ ] Operating hours are correct.
- [ ] Weekend/public holiday handling is defined.
- [ ] Staff queue shows off-hours items first next morning.
- [ ] Caregiver acknowledgement does not promise immediate live support.

### Automation E: WhatsApp Linked Caregiver

Trigger:

- WhatsApp number linked to existing portal caregiver.
- Tag added: `WhatsApp Linked`.

Actions:

1. Add note: "WhatsApp linked to portal caregiver."
2. Confirm phone field format is correct.
3. Route future WhatsApp messages into the same caregiver record.
4. Notify admin if the phone matches multiple contacts.

Checklist:

- [ ] WhatsApp number matches only one caregiver.
- [ ] Unknown numbers get a safe linking response.
- [ ] Existing portal history remains attached.
- [ ] Staff can distinguish WhatsApp, web chat, and voice source.

### Automation F: Failed Sync Review

Trigger:

- Tag added: `Sync Review Needed`
- Failed sync queue item created by portal

Actions:

1. Create admin task: "Review portal sync failure."
2. Add note with error summary.
3. Keep opportunity in current stage unless case safety requires escalation.
4. After manual fix, add note and remove `Sync Review Needed`.

Checklist:

- [ ] Admin receives task.
- [ ] Error summary is understandable.
- [ ] Manual fix is recorded.
- [ ] Resolved item is removed from daily open review.

## 9. WhatsApp-Ready Notification Ideas

Build these only after WhatsApp is connected, tested, and approved for caregiver communication.

Internal notifications:

- Notify staff when a linked caregiver sends a WhatsApp message after hours.
- Notify staff lead when WhatsApp message is classified as CAUTION or UNSAFE.
- Notify CRM owner when an unknown WhatsApp number cannot be linked.
- Notify staff when a caregiver asks for a callback over WhatsApp.
- Notify admin when WhatsApp delivery fails for a staff reply or acknowledgement.

Caregiver-facing WhatsApp messages to consider later:

- Profile linking confirmation.
- Callback request received.
- Staff follow-up scheduled.
- Safe acknowledgement for off-hours contact.
- Reminder to complete profile or consent step.

Do not automate caregiver-facing WhatsApp messages until wording, consent, opt-out, and operating-hour policy are approved.

## 10. Suggested Custom Fields

These fields make reporting and workflows easier.

| Field | Type | Purpose |
|---|---|---|
| `portal_user_id` | Text | Link contact to portal user |
| `portal_open_id` | Text | Link external login identity |
| `case_channel` | Select | Web chat, WhatsApp, voice, phone |
| `case_category` | Select | Standard inquiry, callback, distress, off-hours, unclear |
| `safety_gate_result` | Select | SAFE, CAUTION, UNSAFE |
| `safety_flag_type` | Text/select | Why the case was flagged |
| `callback_requested` | Boolean | Drives callback workflows |
| `escalation_triggered` | Boolean | Drives staff alert workflows |
| `staff_owner` | User/text | Named person responsible |
| `last_staff_action_at` | Date/time | SLA monitoring |
| `last_caregiver_message_at` | Date/time | New message monitoring |
| `last_call_summary` | Long text | Voice call review |
| `last_chat_summary` | Long text | Chat review |
| `consent_given` | Boolean | Consent state |
| `consent_timestamp` | Date/time | Consent audit |
| `whatsapp_linked` | Boolean | WhatsApp readiness |
| `sync_status` | Select | Synced, pending, failed |

## 11. SLA Suggestions

These are planning suggestions, not clinical promises.

| Case type | Suggested internal target |
|---|---|
| Immediate safety concern | Review as soon as staff sees alert |
| Distressed caregiver | Same business day, sooner if possible |
| Callback requested | Same or next business day depending on operating hours |
| Off-hours message | Next business day |
| Standard inquiry | Within normal staff review cycle |
| Sync failure | Same business day during pilot |
| Duplicate contact | Weekly cleanup unless linked to urgent case |

Avoid publishing these targets externally until leadership approves them.

## 12. Build Priority

Recommended order:

1. Staff tasks for UNSAFE/CAUTION cases.
2. Callback requested task and pipeline move.
3. Off-hours next-business-day task.
4. Failed sync admin task.
5. WhatsApp linked/unknown number routing.
6. Staff reply sent and case resolved tracking.
7. SLA reminders for unowned cases.
8. Reporting dashboard for open cases, callbacks, escalations, and sync failures.

## 13. Operations Signoff Checklist

Use this before turning on any automation for real caregivers.

- [ ] Tags are finalized and documented.
- [ ] Pipeline stages are finalized and match portal sync rules.
- [ ] Custom fields exist in the correct GHL/Wibiz location.
- [ ] Staff owners are assigned for each notification type.
- [ ] Operating hours and public holiday behavior are defined.
- [ ] WhatsApp consent and opt-out wording is approved.
- [ ] Caregiver-facing automated wording is reviewed by leadership.
- [ ] UNSAFE/CAUTION cases create internal tasks reliably.
- [ ] Callback requests create tasks with due dates.
- [ ] Off-hours messages route to next-business-day review.
- [ ] Failed sync alerts go to admin/CRM owner.
- [ ] Test contacts are tagged as `Demo Contact` or `Test Contact`.
- [ ] No automation sends messages to real users during testing.
- [ ] Staff know how to manually override or close a case.
- [ ] Admin knows how to pause automation if something misfires.

## 14. Notes For Future Staff/Admin

- Always check the latest caregiver message before replying.
- Do not rely only on tags. Read the transcript or summary for context.
- Do not close a case just because the assistant replied.
- A callback request needs a human-owned task.
- An UNSAFE or CAUTION case needs a named staff owner.
- A sync failure is an operations issue, not a caregiver issue.
- WhatsApp should connect back to the same caregiver record, not create a separate support trail.
- When unsure, leave a note and assign the case to a staff lead.
