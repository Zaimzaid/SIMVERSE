import { AuthenticationError, ValidationError } from "@/lib/errors";
import { getSessionUser } from "@/server/auth/session";
import { dataResponse, errorResponse } from "@/server/api/response";
import { ensurePlayerIdentity } from "@/server/services/player-identity-service";
import { savePlayerBanner } from "@/server/services/uploaded-image-service";
export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) throw new AuthenticationError("Sign in to upload a banner.");
    if (Number(req.headers.get("content-length") || 0) > 900_000)
      throw new ValidationError("Image upload is too large.");
    const form = await req.formData();
    const image = form.get("image");
    if (!(image instanceof File)) throw new ValidationError("Select a PNG, JPEG or WebP image.");
    await ensurePlayerIdentity(user.id);
    return dataResponse(await savePlayerBanner(user.id, new Uint8Array(await image.arrayBuffer()), image.type));
  } catch (error) { return errorResponse(error); }
}
