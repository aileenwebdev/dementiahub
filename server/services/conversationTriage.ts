type ConversationLine = {
  role: "user" | "assistant";
  content: string;
};

export type ConversationTriage = {
  safetyResult: "SAFE" | "CAUTION" | "UNSAFE";
  safetyFlagType: string;
  topicClassified: string;
  callbackRequested: boolean;
  consentVerballyConfirmed: boolean;
  conversationSummary: string;
  resolutionType: string;
  escalationTriggered: boolean;
  transcriptRaw: string;
};

const UNSAFE_PATTERNS: Array<{ pattern: RegExp; flag: string }> = [
  { pattern: /\b(suicide|kill myself|end my life|want to die|hurt myself|self harm|overdose)\b/i, flag: "self_harm_risk" },
  { pattern: /\b(end it all|end everything|want everything to end|i want it all to end|please end it|please let me die|better off dead|wish i was dead)\b/i, flag: "self_harm_risk" },
  { pattern: /\b(no reason to live|no point in living|dont want to live|do not want to live|cannot go on|can't go on|cant go on)\b/i, flag: "self_harm_risk" },
  { pattern: /\b(cannot cope anymore|can't cope anymore|cant cope anymore|i cant do this anymore|i can't do this anymore)\b/i, flag: "self_harm_risk" },
  { pattern: /\b(abuse|hit me|violent|violence|attack|assault)\b/i, flag: "abuse_risk" },
  { pattern: /\b(missing|wandered off|wandering alone|ran away)\b/i, flag: "wandering_risk" },
];

const CAUTION_PATTERNS: Array<{ pattern: RegExp; flag: string }> = [
  { pattern: /\b(fall|fell down|dizzy|fainted|injured)\b/i, flag: "fall_risk" },
  { pattern: /\b(choking|not breathing|chest pain|stroke|seizure|bleeding)\b/i, flag: "medical_risk" },
  { pattern: /\b(aggressive|agitated|confused and lost|unsafe at home)\b/i, flag: "behavioral_risk" },
  { pattern: /\b(hopeless|desperate|breakdown|breaking down|overwhelmed|cannot cope|can't cope|cant cope|no purpose|feel lost)\b/i, flag: "emotional_distress" },
];

const TOPIC_RULES: Array<{ topic: string; pattern: RegExp }> = [
  { topic: "medication", pattern: /\b(medication|medicine|dose|tablet|pill|prescription)\b/i },
  { topic: "behavior", pattern: /\b(aggressive|agitated|behavior|sundowning|hallucinat)\b/i },
  { topic: "safety", pattern: /\b(fall|wander|unsafe|danger|injur|emergency)\b/i },
  { topic: "caregiver_stress", pattern: /\b(exhausted|burnt out|burned out|overwhelmed|stressed|can't cope)\b/i },
  { topic: "resources", pattern: /\b(financial|grant|subsidy|support group|day care|home care|respite)\b/i },
];

const CALLBACK_PATTERN =
  /\b(call me|call back|callback|please contact|have someone contact|speak to someone|human support|staff follow up)\b/i;
const CONSENT_PATTERN = /\b(i consent|yes i agree|yes,? you can|consent given)\b/i;

function compactWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeForMatching(value: string) {
  return compactWhitespace(value)
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[^a-z0-9'\s]/g, " ");
}

function buildSummary(userMessages: string[]) {
  const recent = userMessages
    .map(compactWhitespace)
    .filter(Boolean)
    .slice(-3);

  if (recent.length === 0) {
    return "Portal chat started but no caregiver message has been saved yet.";
  }

  const joined = recent.join(" ");
  if (joined.length <= 280) {
    return joined;
  }
  return `${joined.slice(0, 277)}...`;
}

export function triageConversation(messages: ConversationLine[]): ConversationTriage {
  const transcriptRaw = messages
    .map((message) => `[${message.role.toUpperCase()}]: ${message.content.trim()}`)
    .join("\n");
  const combinedText = messages.map((message) => message.content).join("\n");
  const userMessages = messages.filter((message) => message.role === "user").map((message) => message.content);
  const userText = userMessages.join("\n");
  const normalizedUserText = normalizeForMatching(userText);
  const normalizedCombinedText = normalizeForMatching(combinedText);
  const classifierText = normalizedUserText || normalizedCombinedText;

  const unsafeMatch = UNSAFE_PATTERNS.find(({ pattern }) => pattern.test(classifierText));
  const cautionMatch = unsafeMatch ? null : CAUTION_PATTERNS.find(({ pattern }) => pattern.test(classifierText));
  const topicMatch = unsafeMatch?.flag === "self_harm_risk"
    ? { topic: "safety", pattern: /\bsafety\b/i }
    : TOPIC_RULES.find(({ pattern }) => pattern.test(classifierText));

  const safetyResult = unsafeMatch ? "UNSAFE" : cautionMatch ? "CAUTION" : "SAFE";
  const safetyFlagType = unsafeMatch?.flag ?? cautionMatch?.flag ?? "none";
  const callbackRequested = CALLBACK_PATTERN.test(classifierText);
  const consentVerballyConfirmed = CONSENT_PATTERN.test(classifierText);
  const escalationTriggered = safetyResult === "UNSAFE" || callbackRequested;
  const resolutionType =
    escalationTriggered || safetyResult === "CAUTION" ? "needs_staff" : "self_serve";

  return {
    safetyResult,
    safetyFlagType,
    topicClassified: topicMatch?.topic ?? "general",
    callbackRequested,
    consentVerballyConfirmed,
    conversationSummary: buildSummary(userMessages),
    resolutionType,
    escalationTriggered,
    transcriptRaw,
  };
}
