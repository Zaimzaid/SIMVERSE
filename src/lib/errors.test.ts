import { describe, expect, it } from "vitest";
import { AppError, AuthenticationError, AuthorizationError, NotFoundError, isHiddenResourceError } from "./errors";

describe("detail page resource hiding", () => {
  it("hides both missing and forbidden records without disclosing their existence", () => {
    expect(isHiddenResourceError(new NotFoundError())).toBe(true);
    expect(isHiddenResourceError(new AuthorizationError())).toBe(true);
    expect(isHiddenResourceError(new AppError("missing", "NOT_FOUND", 404))).toBe(true);
    expect(isHiddenResourceError(new AppError("forbidden", "AUTHORIZATION_ERROR", 403))).toBe(true);
  });

  it("preserves authentication and unexpected failures", () => {
    expect(isHiddenResourceError(new AuthenticationError())).toBe(false);
    expect(isHiddenResourceError(new Error("database unavailable"))).toBe(false);
  });
});
