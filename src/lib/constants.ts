/**
 * Cross-cutting constants safe to import anywhere, including the Edge runtime
 * (middleware). Must not import server-only modules (env, crypto, Prisma).
 */
export const SESSION_COOKIE_NAME = "simverse_session";
export const ACTIVE_WORKSPACE_COOKIE_NAME = "simverse_active_workspace";

/** Top-level route segments that require authentication. */
export const PROTECTED_ROUTES = [
  "/dashboard",
  "/create",
  "/projects",
  "/simulations",
  "/anything-wars",
  "/entities",
  "/worlds",
  "/tournaments",
  "/assets",
  "/studio",
  "/templates",
  "/analytics",
  "/team",
  "/settings",
] as const;
