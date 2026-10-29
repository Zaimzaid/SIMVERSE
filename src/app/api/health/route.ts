import { NextResponse } from "next/server";
import { prisma } from "@/server/db/client";

/** An injectable probe keeps both success and failure paths independently testable. */
export async function respondToHealthProbe(probe: () => Promise<unknown>) {
  try {
    await probe();
    return NextResponse.json({ status: "ok" }, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json({ status: "unavailable" }, {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }
}

export function GET() {
  return respondToHealthProbe(() => prisma.$queryRaw`SELECT 1`);
}
