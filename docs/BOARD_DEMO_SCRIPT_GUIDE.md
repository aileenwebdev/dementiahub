# DementiaHub Board Demo Script Guide

Audience: DementiaHub board members, senior stakeholders, operations leads, and care leadership.

Purpose: demonstrate how the DementiaHub portal supports a caregiver journey from first contact through triage, follow-up, escalation, staff review, and operational reporting.

Tone for presenters: calm, non-technical, clinically responsible, and human. Do not describe backend vendors or tooling. Refer to the system as the DementiaHub portal and Wibiz support workflows.

## One-Minute Opening

Presenter says:

> Today we will show DementiaHub as a guided support portal for caregivers. The goal is not to replace human care teams. The goal is to make sure caregivers are heard quickly, their details are captured consistently, and urgent or unclear cases are routed for human follow-up instead of being missed.

> We will walk through three views: the caregiver view, the staff view, and the admin view. Together, these show the complete journey from first contact to operational oversight.

Key message for board:

- Caregivers get a simple, reassuring support experience.
- Staff get context and follow-up signals without manually piecing together history.
- Admins get visibility into readiness, activity, and workflow health.
- Sensitive internal triage is kept behind staff/admin views, not exposed to caregivers.

## Demo Roles

### Caregiver / User

Name for demo: Mei Tan

Profile:

- Daughter caring for her mother with dementia
- Needs care options, reassurance, and follow-up
- Uses text chat first, then tries voice support

Primary portal areas to show:

- Home dashboard
- Profile / Wibiz contact link
- Support Assistant
- Start a Call
- History

### Staff

Name for demo: Juliana

Profile:

- Care coordinator or support team member
- Reviews escalated cases and callbacks
- Can take over a conversation or follow up manually

Primary portal areas to show:

- Staff/admin conversation list
- Conversation detail
- Call detail
- Human reply
- Callback history

### Admin

Name for demo: Aileen

Profile:

- System owner / operations lead
- Confirms workflows are connected and demo-ready
- Monitors sync status, caregiver records, and failed items

Primary portal areas to show:

- Admin conversations
- Admin integration/status page
- Dry-run control room
- Recent activity
- Failed sync queue

## Recommended Demo Flow

Total suggested time: 18 to 25 minutes.

1. Admin readiness check: 3 minutes
2. Caregiver standard inquiry: 4 minutes
3. Caregiver distressed escalation: 4 minutes
4. Staff review and human follow-up: 5 minutes
5. Voice support journey: 4 minutes
6. Admin closeout: 2 minutes

Keep the language simple. Board members should understand the care value without needing to understand the technology.

## Journey 1: Admin Readiness and Governance

Objective: show that DementiaHub has operational oversight before real users enter the system.

Presenter says:

> Before demonstrating the caregiver experience, we first confirm the operating environment. This matters because caregiver support cannot depend on guesswork. We need to know that the portal, Wibiz support workflows, escalation paths, and recent activity are visible to the team.

Admin demo steps:

1. Log in as an admin.
2. Open the dry-run page: `/demo/dry-run`.
3. Show the readiness indicators.
4. Open Admin Conversations.
5. Show caregiver directory and recent support activity.
6. Open Admin Integration.
7. Show that Wibiz support status and workflow monitoring are available.

What to highlight:

- Admins can see whether the support workflow is ready.
- Recent support activity is visible in one place.
- Failed syncs or configuration issues have a place to be reviewed.
- The portal supports governance, not just chat.

Board-friendly language:

> This is the control layer. It helps the operating team answer: are we ready, are cases flowing, and is anything stuck?

Do not say:

- The names of backend AI or automation tools
- API details
- Webhook details unless specifically asked

Pass condition:

- Admin can see readiness, recent activity, caregiver records, and workflow health.

## Journey 2: Caregiver Standard Inquiry

Dry-run scenario covered: Standard Caregiver Inquiry.

Objective: show a normal caregiver entering the portal and asking for help in plain language.

Presenter says:

> We will now switch to the caregiver view. This is what a family member sees. Notice that the experience is not technical. It is designed around reassurance, continuity, and next steps.

Caregiver demo steps:

1. Log in as Mei Tan or a test caregiver.
2. Open Home.
3. Show that there is no history for a fresh account unless the caregiver has actually chatted or called.
4. Open Profile.
5. Confirm phone number and Wibiz support linkage are ready.
6. Open Support Assistant.
7. Send the standard inquiry prompt below.

Text AI prompt to type:

```text
I am looking for dementia care services for my mother. Can someone help me understand what options are available?
```

Expected assistant behavior:

- Responds empathetically.
- Asks relevant follow-up questions.
- Avoids clinical overclaiming.
- Captures the caregiver's need.
- Keeps the conversation saved for continuity.

Presenter says after response:

> The important point is continuity. If this caregiver comes back later, the portal should not treat them like a stranger. Their support history stays attached to their profile.

What to show next:

1. Open History.
2. Show the conversation appears only after a real message exists.
3. Open the conversation detail.
4. Show transcript and support status.

Pass condition:

- The caregiver receives a helpful response.
- The conversation is saved.
- No internal safety measurement is exposed to the caregiver.

## Journey 3: Caregiver Distress and Escalation

Dry-run scenario covered: Distressed Caregiver / Escalation Trigger.

Objective: show that urgent or distressed language is not treated as routine.

Presenter says:

> Next, we will test a more serious case. The aim is to show that when a caregiver sounds distressed, the portal changes posture. It should not simply continue as a normal FAQ chat.

Text AI prompt to type:

```text
I cannot cope anymore. I am desperate and I do not know what to do.
```

Expected assistant behavior:

- Responds calmly and empathetically.
- Encourages immediate emergency help if there is immediate danger.
- Routes the case for human follow-up.
- Marks the case internally for staff attention.
- Keeps the caregiver-facing language supportive and non-alarming.

Presenter says:

> This is where the system becomes operationally important. The caregiver is not shown an internal risk score. Instead, the staff team gets the signal that this needs attention.

Staff demo steps:

1. Switch to staff/admin view.
2. Open Admin Conversations.
3. Find the caregiver.
4. Open the latest conversation.
5. Show the staff-only internal review and case controls.
6. Demonstrate staff ownership or human reply.

Suggested staff reply:

```text
Hi Mei, this is Juliana from the DementiaHub support team. I am sorry this has been so overwhelming. I am going to follow up with you directly so we can understand what is happening and help you with next steps.
```

What to highlight:

- Staff sees the context.
- Staff can take over.
- Staff can log follow-up.
- The caregiver is protected from seeing internal measurements.

Pass condition:

- Escalation is visible to staff.
- Human handoff can be demonstrated.
- Caregiver-facing experience remains calm and respectful.

## Journey 4: Off-Hours Contact

Dry-run scenario covered: Off-Hours Contact.

Objective: show that caregivers do not experience silence outside operating hours.

Presenter says:

> Many caregiver needs happen after office hours. A safe support experience should acknowledge the message, set expectations, and preserve the case for follow-up.

Text AI prompt to type:

```text
It is late at night and I need help arranging care tomorrow. Can someone contact me?
```

Expected assistant behavior:

- Acknowledges the caregiver's request.
- Sets expectation that staff will follow up.
- Encourages emergency services if immediate danger is present.
- Flags callback or follow-up need internally.

Presenter says:

> The goal here is no dead silence. Even when a human is not immediately available, the caregiver receives a clear holding response and the team has a follow-up trail.

Staff/Admin follow-up:

1. Open the case from staff/admin view.
2. Show callback requested or follow-up status.
3. Explain that the team can use Wibiz support tags to trigger operational automations.

Pass condition:

- Caregiver receives expectation-setting response.
- Staff can identify follow-up requirement.

## Journey 5: Repeated Contact and Continuity

Dry-run scenario covered: Repeated Contact / Follow-Up.

Objective: show that returning caregivers do not restart from zero.

Presenter says:

> A common frustration in care support is having to repeat the same story. Here, we show that the portal preserves continuity.

Text AI prompt to type:

```text
Following up on our earlier conversation, my father is sundowning again and I need next steps.
```

Expected assistant behavior:

- Treats this as a continuation.
- Uses prior conversation context.
- Does not create duplicate empty history.
- Keeps the record attached to the same caregiver.

What to show:

1. Open the assistant.
2. Send the prompt.
3. Open History.
4. Show that the saved conversation is part of the same caregiver record.
5. Switch to staff/admin and show that staff can see the context.

Presenter says:

> This is the continuity benefit. The caregiver does not need to explain everything again, and staff do not need to search across disconnected channels.

Pass condition:

- Context is preserved.
- No cross-user data appears.
- No empty conversation record appears for a new account.

## Journey 6: Edge Case and Safe Fallback

Dry-run scenario covered: Edge Case / Unrecognised Input.

Objective: show that the system avoids guessing when it does not understand.

Text AI prompt to type:

```text
asdf qwer lah I don't know what thing ??? can or not?
```

Expected assistant behavior:

- Does not fabricate advice.
- Asks for clarification.
- Offers human support if unclear.
- Avoids harmful or misleading guidance.

Presenter says:

> A safe system should know when not to guess. In unclear situations, the better behavior is to clarify or route to a human.

Pass condition:

- Assistant gives a graceful fallback.
- Staff route is available if uncertainty remains.

## Journey 7: Voice AI Support

Dry-run scenarios covered:

- Standard inquiry by voice
- Distressed voice input
- Callback request
- Silence or unclear speech

Objective: show the same caregiver support journey through voice.

Presenter says:

> Some caregivers may prefer speaking instead of typing. The voice journey gives the same support pathway: listen, respond, save the transcript, and route follow-up when needed.

Caregiver demo steps:

1. Open Start a Call.
2. Choose Browser Voice Call.
3. Speak the voice script below.
4. End the call.
5. Open History.
6. Show the saved call record, transcript, and summary.

Voice script A: Standard inquiry

```text
Hi, I am caring for my mother who has dementia. I want to understand what support options are available and whether someone can guide me.
```

Expected behavior:

- Voice assistant responds empathetically.
- Session is saved to history.
- Staff/admin can see the completed call.

Voice script B: Distressed caregiver

```text
I am exhausted and I feel like I cannot manage tonight. I need someone to help me figure out what to do.
```

Expected behavior:

- Voice assistant acknowledges distress.
- Encourages emergency help if immediate danger is present.
- Flags the case for staff review.

Voice script C: Callback request

```text
Can someone call me tomorrow morning? I would like to speak to a person about care options.
```

Expected behavior:

- Callback need is captured.
- Staff/admin view shows follow-up requirement.
- Wibiz trigger tags can support operational automation.

Voice script D: Silence or unclear audio

```text
Pause for 8 seconds, then say: Sorry, I am not sure how to explain it.
```

Expected behavior:

- Assistant handles silence without breaking.
- Assistant asks a clarifying question.
- It should not invent details.

Presenter says:

> The value is not just the live conversation. The value is that the call becomes a usable support record for the team.

Pass condition:

- Call opens.
- Transcript or summary is saved after completion.
- Staff/admin can review the record.
- Follow-up status is visible when needed.

## Staff Journey Script

Objective: show the board how the care team acts on cases.

Presenter says:

> We will now move from caregiver experience to staff action. This is where the portal supports accountability.

Staff steps:

1. Log in as staff.
2. Open Admin Conversations or the staff case view.
3. Select the caregiver from the demo.
4. Review recent chat and voice records.
5. Open the distressed conversation.
6. Claim or take ownership of the case.
7. Send a human reply.
8. Log callback attempt if relevant.

Staff talk track:

> Staff do not need to ask, "Where did this message come from?" They can see the caregiver profile, the conversation history, the support status, and the recommended next operational step.

What to highlight:

- Human takeover
- Callback logging
- Staff-only internal review
- Conversation and voice history
- No need to expose internal scoring to caregivers

Pass condition:

- Staff can find the caregiver.
- Staff can review context.
- Staff can take action.

## Admin Journey Script

Objective: show operational visibility and readiness.

Presenter says:

> The admin view is for governance. It helps leadership and operations teams see whether the system is functioning, whether workflows are connected, and whether any cases are stuck.

Admin steps:

1. Open Admin Conversations.
2. Show caregiver directory.
3. Show recent support activity.
4. Open one caregiver record.
5. Show chat and voice history.
6. Open Admin Integration.
7. Show Wibiz support readiness and failed sync queue.
8. Open Dry Run Control Room.

Admin talk track:

> For a board-level view, this tells us whether DementiaHub can operate responsibly: are workflows connected, are cases visible, and can the team intervene when something needs attention?

Pass condition:

- Admin can see activity.
- Admin can inspect caregiver records.
- Admin can identify workflow health.

## Board-Level Closing

Presenter says:

> What we demonstrated today is a practical support model. A caregiver can ask for help in natural language. The portal keeps the experience simple for the caregiver while creating structured follow-up for the team. Staff can intervene when needed. Admins can monitor readiness and workflow health.

> The system is designed to reduce missed signals, reduce repeated storytelling, and give the care team a clearer operating view.

Final message:

- DementiaHub is not positioned as a replacement for clinical judgment.
- It is a support and routing layer.
- It improves continuity, responsiveness, and operational visibility.
- The safest demo story is: caregiver simplicity on the front end, staff accountability behind the scenes.

## Presenter Checklist

Before the meeting:

- Create one fresh caregiver account.
- Confirm fresh account has no history before first message.
- Confirm one linked caregiver profile exists.
- Confirm one admin account works.
- Confirm one staff account works.
- Confirm Wibiz support readiness is visible.
- Confirm browser voice call works before showing it live.
- Prepare one standard case, one distressed case, and one callback case.

During the meeting:

- Keep prompts short.
- Do not improvise urgent self-harm or medical content beyond the approved script.
- Do not mention backend vendor names.
- Do not expose API keys, integration IDs, or raw technical details.
- If a live integration is slow, show the saved record and explain the expected operational path.

After the meeting:

- Export or screenshot the demo results if the board requests evidence.
- Review any failed sync queue items.
- Clear or label test contacts so they are not mistaken for real caregivers.

## Quick Reference: Scenario Prompts

Standard inquiry:

```text
I am looking for dementia care services for my mother. Can someone help me understand what options are available?
```

Distressed escalation:

```text
I cannot cope anymore. I am desperate and I do not know what to do.
```

Off-hours:

```text
It is late at night and I need help arranging care tomorrow. Can someone contact me?
```

Repeated contact:

```text
Following up on our earlier conversation, my father is sundowning again and I need next steps.
```

Unrecognised input:

```text
asdf qwer lah I don't know what thing ??? can or not?
```

Voice standard:

```text
Hi, I am caring for my mother who has dementia. I want to understand what support options are available and whether someone can guide me.
```

Voice callback:

```text
Can someone call me tomorrow morning? I would like to speak to a person about care options.
```

