import type { ErrorCode, FieldIssue } from "@/lib/errors";

export interface ApiError {
  code: ErrorCode | string;
  message: string;
  details?: FieldIssue[];
}

export interface ApiResult<T> {
  data?: T;
  error?: ApiError;
}

/**
 * Thin client wrapper around fetch for our JSON API. Returns a discriminated
 * result rather than throwing, so forms can render field-level errors from the
 * server's ValidationError details.
 */
export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<ApiResult<T>> {
  let res: Response;
  try {
    res = await fetch(path, {
      headers: { "Content-Type": "application/json" },
      ...init,
    });
  } catch {
    return {
      error: {
        code: "INTERNAL_ERROR",
        message: "Network error. Check your connection and try again.",
      },
    };
  }

  const json = (await res.json().catch(() => null)) as
    | { data?: T; error?: ApiError }
    | null;

  if (!res.ok) {
    return {
      error:
        json?.error ?? {
          code: "INTERNAL_ERROR",
          message: "Something went wrong. Please try again.",
        },
    };
  }

  return { data: json?.data };
}

/** Reduce an API error's field details into a { fieldName: message } map. */
export function fieldErrorsFrom(error?: ApiError): Record<string, string> {
  const map: Record<string, string> = {};
  for (const issue of error?.details ?? []) {
    if (!map[issue.path]) map[issue.path] = issue.message;
  }
  return map;
}
