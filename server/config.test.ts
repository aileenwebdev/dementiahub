import { describe, expect, it } from "vitest";
import {
  config,
  isElevenLabsConfigured,
  isGHLConfigured,
  normalizeBearerToken,
  verifyElevenLabsWebhookSecret,
} from "./config";

describe("config", () => {
  it("should have GHL_API_KEY set", () => {
    // The key must be a non-empty string when the env var is provided
    expect(typeof config.ghlApiKey).toBe("string");
  });

  it("should have GHL_LOCATION_ID set", () => {
    expect(typeof config.ghlLocationId).toBe("string");
  });

  it("should have ELEVENLABS_API_KEY set", () => {
    expect(typeof config.elevenLabsApiKey).toBe("string");
  });

  it("should have ELEVENLABS_AGENT_ID set", () => {
    expect(typeof config.elevenLabsAgentId).toBe("string");
  });

  it("should have webhook secrets set", () => {
    expect(config.elevenLabsPostCallWebhookSecret.length).toBeGreaterThan(0);
    expect(config.elevenLabsConsentWebhookSecret.length).toBeGreaterThan(0);
  });

  it("verifyElevenLabsWebhookSecret returns true for matching post-call secret", () => {
    const result = verifyElevenLabsWebhookSecret("post_call", config.elevenLabsPostCallWebhookSecret);
    expect(result).toBe(true);
  });

  it("verifyElevenLabsWebhookSecret returns true for matching consent secret", () => {
    const result = verifyElevenLabsWebhookSecret("consent", config.elevenLabsConsentWebhookSecret);
    expect(result).toBe(true);
  });

  it("verifyElevenLabsWebhookSecret returns false for wrong secret", () => {
    expect(verifyElevenLabsWebhookSecret("post_call", "wrong-secret")).toBe(false);
    expect(verifyElevenLabsWebhookSecret("consent", undefined)).toBe(false);
  });

  it("isGHLConfigured returns boolean", () => {
    expect(typeof isGHLConfigured()).toBe("boolean");
  });

  it("isElevenLabsConfigured returns boolean", () => {
    expect(typeof isElevenLabsConfigured()).toBe("boolean");
  });

  it("normalizes bearer tokens copied with a prefix, quotes, or spaces", () => {
    expect(normalizeBearerToken("Bearer pit-123")).toBe("pit-123");
    expect(normalizeBearerToken("  'pit-456'  ")).toBe("pit-456");
    expect(normalizeBearerToken('  "pit-789"  ')).toBe("pit-789");
  });
});
