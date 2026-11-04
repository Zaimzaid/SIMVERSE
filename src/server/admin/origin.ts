import {AuthorizationError} from "@/lib/errors";
import {env} from "@/lib/env";
/** Reject cross-site admin mutations even if a cookie happens to accompany them. */
export function requireAdminSameOrigin(request:Request):void{
 const origin=request.headers.get("origin");
 if(origin && origin!==new URL(env.APP_URL).origin)
  throw new AuthorizationError("Administrative changes must originate from the KAVANDRO website.");
 const site=request.headers.get("sec-fetch-site");
 if(site && site!=="same-origin" && site!=="none")
  throw new AuthorizationError("Cross-site administrative requests are not allowed.");
}
