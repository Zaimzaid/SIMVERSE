/**
 * Centralized application error types.
 *
 * Services and the server layer throw these typed errors; the API layer maps
 * them to safe HTTP responses (see toErrorResponse). Raw ORM/database errors
 * are never surfaced to users.
 */
export type ErrorCode =
  | "VALIDATION_ERROR"
  | "AUTHENTICATION_ERROR"
  | "AUTHORIZATION_ERROR"
  | "NOT_FOUND"
  | "CONFLICT"
  | "INTERNAL_ERROR";

export interface FieldIssue {
  path: string;
  message: string;
}

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: FieldIssue[];

  constructor(
    message: string,
    code: ErrorCode,
    status: number,
    details?: FieldIssue[],
  ) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export class ValidationError extends AppError {
  constructor(message = "The information provided is invalid.", details?: FieldIssue[]) {
    super(message, "VALIDATION_ERROR", 400, details);
  }
}

export class AuthenticationError extends AppError {
  constructor(message = "Invalid email or password.") {
    super(message, "AUTHENTICATION_ERROR", 401);
  }
}

export class AuthorizationError extends AppError {
  constructor(message = "You do not have permission to perform this action.") {
    super(message, "AUTHORIZATION_ERROR", 403);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "The requested resource was not found.") {
    super(message, "NOT_FOUND", 404);
  }
}

export class ConflictError extends AppError {
  constructor(message = "This action conflicts with existing data.") {
    super(message, "CONFLICT", 409);
  }
}

export interface ErrorResponseBody {
  error: {
    code: ErrorCode;
    message: string;
    details?: FieldIssue[];
  };
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/** Hide both missing and inaccessible resources behind the same 404 in detail pages. */
export function isHiddenResourceError(error: unknown): error is AppError {
  return isAppError(error) &&
    (error.code === "NOT_FOUND" || error.code === "AUTHORIZATION_ERROR");
}
