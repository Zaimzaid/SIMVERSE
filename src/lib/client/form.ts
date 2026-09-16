import type { z } from "zod";

/** Convert a client-side ZodError into a { fieldName: firstMessage } map. */
export function zodFieldErrors(error: z.ZodError): Record<string, string> {
  const map: Record<string, string> = {};
  for (const issue of error.issues) {
    const path = issue.path.join(".");
    if (!map[path]) map[path] = issue.message;
  }
  return map;
}
