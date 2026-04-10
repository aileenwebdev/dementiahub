import type { Express } from "express";

// Local auth is handled via tRPC (auth.login, auth.register).
// This file is kept for import compatibility with the server entry point.
export function registerOAuthRoutes(_app: Express) {}
