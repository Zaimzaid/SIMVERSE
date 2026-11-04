/** Local-process TOTP attempt limiter. Use shared atomic storage before multi-instance deployment. */
const WINDOW_MS=15*60_000;
const MAX_ATTEMPTS=5;
const attempts=new Map<string,{count:number;resetAt:number}>();
export function takeAdminTotpAttempt(userId:string,now=Date.now()):boolean {
 if(attempts.size>4096) {
  for(const [key,value] of attempts){if(value.resetAt<=now)attempts.delete(key);}
  if(attempts.size>4096)attempts.clear();
 }
 const previous=attempts.get(userId);
 if(!previous || previous.resetAt<=now){attempts.set(userId,{count:1,resetAt:now+WINDOW_MS});return true;}
 if(previous.count>=MAX_ATTEMPTS)return false;
 previous.count+=1;return true;
}
export function clearAdminTotpAttempts(userId:string){attempts.delete(userId);}
export function resetAdminTotpAttemptsForTests(){attempts.clear();}
