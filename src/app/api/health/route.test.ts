import { beforeEach, describe, expect, it, vi } from "vitest";

const query = vi.hoisted(() => vi.fn());
vi.mock("@/server/db/client", () => ({ prisma: { $queryRaw: query } }));

import { GET, respondToHealthProbe } from "./route";

describe("public health check", () => {
  beforeEach(() => query.mockReset());

  it("reports ok after a successful database query, with no sensitive fields", async () => {
    query.mockResolvedValue([{ one: 1 }]);
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({ status: "ok" });
    expect(query).toHaveBeenCalledTimes(1);
  });

  it("returns 503 for a failing probe without leaking database errors", async () => {
    const response = await respondToHealthProbe(async () => {
      throw new Error("DB password private");
    });
    expect(response.status).toBe(503);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({ status: "unavailable" });
  });
});
