import { describe, expect, it } from "vitest";
import { triageConversation } from "./services/conversationTriage";

describe("triageConversation", () => {
  it("marks explicit self-harm language as unsafe", () => {
    const triage = triageConversation([
      {
        role: "user",
        content:
          "I cannot cope anymore. I am desperate. I do not know what to do. I want to end it all please end.",
      },
    ]);

    expect(triage.safetyResult).toBe("UNSAFE");
    expect(triage.safetyFlagType).toBe("self_harm_risk");
    expect(triage.topicClassified).toBe("safety");
    expect(triage.escalationTriggered).toBe(true);
    expect(triage.resolutionType).toBe("needs_staff");
  });

  it("marks strong emotional distress without self-harm phrasing as caution", () => {
    const triage = triageConversation([
      {
        role: "user",
        content: "I feel desperate and overwhelmed and I really cannot cope right now.",
      },
    ]);

    expect(triage.safetyResult).toBe("CAUTION");
    expect(triage.safetyFlagType).toBe("emotional_distress");
    expect(triage.resolutionType).toBe("needs_staff");
  });

  it("prioritizes the caregiver's words over assistant text", () => {
    const triage = triageConversation([
      {
        role: "assistant",
        content: "If you are in danger, please contact emergency help right away.",
      },
      {
        role: "user",
        content: "I want to die. I cannot go on anymore.",
      },
    ]);

    expect(triage.safetyResult).toBe("UNSAFE");
    expect(triage.safetyFlagType).toBe("self_harm_risk");
  });

  it("routes off-hours requests to staff follow-up", () => {
    const triage = triageConversation([
      {
        role: "user",
        content: "It is late at night and I need help arranging care tomorrow. Can someone contact me?",
      },
    ]);

    expect(triage.safetyResult).toBe("CAUTION");
    expect(triage.safetyFlagType).toBe("off_hours_request");
    expect(triage.callbackRequested).toBe(true);
    expect(triage.escalationTriggered).toBe(true);
    expect(triage.resolutionType).toBe("needs_staff");
  });

  it("routes unclear or mixed low-signal input to staff review", () => {
    const triage = triageConversation([
      {
        role: "user",
        content: "asdf qwer lah 我不知道 what thing ???",
      },
    ]);

    expect(triage.safetyResult).toBe("CAUTION");
    expect(triage.safetyFlagType).toBe("unclear_input");
    expect(triage.resolutionType).toBe("needs_staff");
  });
});
