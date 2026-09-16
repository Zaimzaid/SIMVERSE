import { NextResponse } from "next/server";
import { isAppError, type ErrorResponseBody } from "@/lib/errors";
import { logger } from "@/lib/logger";

const log = logger.child("api");

/**
 * Convert any thrown value into a safe JSON error response. Known AppErrors map
 * to their status + code; anything else becomes a generic 500 (the raw error is
 * logged server-side, never leaked to the client).
 */
export function errorResponse(error: unknown): NextResponse<ErrorResponseBody> {
  if (isAppError(error)) {
    return NextResponse.json(
      {
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
      },
      { status: error.status },
    );
  }

  log.error("Unhandled error in route handler", {
    error: error instanceof Error ? error.message : String(error),
  });

  return NextResponse.json(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: "Something went wrong. Please try again.",
      },
    },
    { status: 500 },
  );
}

/** Standard success envelope. */
export function dataResponse<T>(data: T, status = 200): NextResponse<{ data: T }> {
  return NextResponse.json({ data }, { status });
}
