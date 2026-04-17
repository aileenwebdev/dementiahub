import { afterEach, describe, expect, it, vi } from "vitest";

const originalAdminEmail = process.env.ADMIN_EMAIL;
const originalAdminEmails = process.env.ADMIN_EMAILS;
const originalStaffEmail = process.env.STAFF_EMAIL;
const originalStaffEmails = process.env.STAFF_EMAILS;

describe("admin email allowlist", () => {
  afterEach(() => {
    process.env.ADMIN_EMAIL = originalAdminEmail;
    process.env.ADMIN_EMAILS = originalAdminEmails;
    process.env.STAFF_EMAIL = originalStaffEmail;
    process.env.STAFF_EMAILS = originalStaffEmails;
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

  it("supports staff email allowlist and resolves roles correctly", async () => {
    process.env.ADMIN_EMAILS = "admin@example.com";
    process.env.STAFF_EMAIL = "staff1@example.com";
    process.env.STAFF_EMAILS = "staff2@example.com, staff3@example.com";

    const envModule = await import("./_core/env");

    expect(envModule.ENV.staffEmails).toEqual([
      "staff2@example.com",
      "staff3@example.com",
      "staff1@example.com",
    ]);
    expect(envModule.isStaffEmail("STAFF1@example.com")).toBe(true);
    expect(envModule.isStaffEmail("staff3@example.com")).toBe(true);
    expect(envModule.resolvePortalRole("admin@example.com")).toBe("admin");
    expect(envModule.resolvePortalRole("staff2@example.com")).toBe("staff");
    expect(envModule.resolvePortalRole("caregiver@example.com")).toBe("user");
  });
});
