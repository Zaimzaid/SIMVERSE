import { NotFoundError } from "@/lib/errors";
import { verifyEarthDestinationIntent } from "@/server/earth/destination-intent";
import { getEarthPlace } from "./earth-geography-service";

export async function resolveEarthDestinationIntent(
  userId: string,
  workspaceId: string,
  token: unknown,
  now = Date.now(),
) {
  const intent = verifyEarthDestinationIntent(token, now);
  const place = await getEarthPlace(userId, workspaceId, intent.placeId);
  if (place.kind !== "COUNTRY") {
    throw new NotFoundError("Earth destination is unavailable.");
  }
  return { intent, place };
}
