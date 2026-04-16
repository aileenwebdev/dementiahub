function parseAdminEmails(value: string | undefined) {
  return (value ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

const adminEmails = Array.from(
  new Set([
    ...parseAdminEmails(process.env.ADMIN_EMAILS),
    ...parseAdminEmails(process.env.ADMIN_EMAIL),
  ])
);

export function isAdminEmail(email: string | null | undefined) {
  if (!email) return false;
  return adminEmails.includes(email.trim().toLowerCase());
}

export const ENV = {
  cookieSecret: process.env.JWT_SECRET ?? "change-me-in-production",
  databaseUrl: process.env.DATABASE_URL ?? "",
  isProduction: process.env.NODE_ENV === "production",
  adminEmail: process.env.ADMIN_EMAIL ?? "",
  adminEmails,
  // Storage proxy (optional - only needed if file upload features are used)
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
};
