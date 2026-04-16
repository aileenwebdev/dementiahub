import { afterEach, describe, expect, it, vi } from "vitest";

const originalAdminEmail = process.env.ADMIN_EMAIL;
const originalAdminEmails = process.env.ADMIN_EMAILS;

describe("admin email allowlist", () => {
  afterEach(() => {
    process.env.ADMIN_EMAIL = originalAdminEmail;
    process.env.ADMIN_EMAILS = originalAdminEmails;
    vi.resetModules();
  });

  it("supports multiple admin emails and keeps ADMIN_EMAIL backward compatible", async () => {
    process.env.ADMIN_EMAIL = "owner@example.com";
    process.env.ADMIN_EMAILS = "team@example.com, demo@example.com ";

    const envModule = await import("./_core/env");

    expect(envModule.ENV.adminEmails).toEqual([
      "team@example.com",
      "demo@example.com",
      "owner@example.com",
    ]);
    expect(envModule.isAdminEmail("TEAM@example.com")).toBe(true);
    expect(envModule.isAdminEmail("demo@example.com")).toBe(true);
    expect(envModule.isAdminEmail("owner@example.com")).toBe(true);
    expect(envModule.isAdminEmail("user@example.com")).toBe(false);
  });
});
