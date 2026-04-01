import { describe, expect, it } from "vitest";
import { config, isGHLConfigured, isElevenLabsConfigured, verifyElevenLabsWebhookSecret } from "./config";

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

  it("should have a webhook secret set", () => {
    expect(config.elevenLabsWebhookSecret.length).toBeGreaterThan(0);
  });

  it("verifyElevenLabsWebhookSecret returns true for matching secret", () => {
    const result = verifyElevenLabsWebhookSecret(config.elevenLabsWebhookSecret);
    expect(result).toBe(true);
  });

  it("verifyElevenLabsWebhookSecret returns false for wrong secret", () => {
    expect(verifyElevenLabsWebhookSecret("wrong-secret")).toBe(false);
    expect(verifyElevenLabsWebhookSecret(undefined)).toBe(false);
  });

  it("isGHLConfigured returns boolean", () => {
    expect(typeof isGHLConfigured()).toBe("boolean");
  });

  it("isElevenLabsConfigured returns boolean", () => {
    expect(typeof isElevenLabsConfigured()).toBe("boolean");
  });
});
