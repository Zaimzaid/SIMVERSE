import { z } from "zod";
import { ValidationError, type FieldIssue } from "@/lib/errors";

export * from "./schemas";

/** Convert a ZodError into the app's field-issue shape. */
export function formatZodIssues(error: z.ZodError): FieldIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));
}

/**
 * Parse input with a schema, throwing a ValidationError (with field details)
 * on failure. Used by the server layer so validation is authoritative.
 */
export function parseOrThrow<T>(
  schema: z.ZodType<T>,
  input: unknown,
  message = "The information provided is invalid.",
): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new ValidationError(message, formatZodIssues(result.error));
  }
  return result.data;
}
