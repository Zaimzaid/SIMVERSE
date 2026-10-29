import {beforeEach,afterEach,describe,expect,it,vi} from "vitest";
import {prisma} from "@/server/db/client";
import {registerUser} from "./auth-service";
import {resetDb} from "../../../test/helpers/db";
import {beginGoogleDriveOAuth,finishGoogleDriveOAuth,backupAccountSnapshotToGoogleDrive,disconnectGoogleDrive,googleDriveStatus} from "./google-drive-service";
vi.mock("@/server/auth/session",()=>({getCurrentSessionId:async()=> "test-session-123"}));
const previousId=process.env.GOOGLE_DRIVE_CLIENT_ID;
const previousSecret=process.env.GOOGLE_DRIVE_CLIENT_SECRET;
beforeEach(async()=>{await resetDb();process.env.GOOGLE_DRIVE_CLIENT_ID="test-google-client";
 process.env.GOOGLE_DRIVE_CLIENT_SECRET="test-google-secret";});
afterEach(()=>{
 vi.unstubAllGlobals();
 if(previousId===undefined)delete process.env.GOOGLE_DRIVE_CLIENT_ID;else process.env.GOOGLE_DRIVE_CLIENT_ID=previousId;
 if(previousSecret===undefined)delete process.env.GOOGLE_DRIVE_CLIENT_SECRET;else process.env.GOOGLE_DRIVE_CLIENT_SECRET=previousSecret;
});
describe("Google Drive connector without external network",()=>{
 it("binds OAuth state to user/session, encrypts tokens and uploads a JSON snapshot",async()=>{
  const a=await registerUser({displayName:"Cloud Tester",email:"cloud@example.com",password:"Password123",confirmPassword:"Password123"});
  const b=await registerUser({displayName:"Other Tester",email:"other@example.com",password:"Password123",confirmPassword:"Password123"});
  const oauthUrl=await beginGoogleDriveOAuth(a.user.id);
  expect(oauthUrl).toContain("accounts.google.com/o/oauth2/v2/auth");
  const url=new URL(oauthUrl);
  expect(url.searchParams.get("scope")).toBe("https://www.googleapis.com/auth/drive.file");
  const state=url.searchParams.get("state")!;
  const mock=vi.fn(async(url:RequestInfo|URL)=>{
   const target=String(url);
   if(target==="https://oauth2.googleapis.com/token")return new Response(JSON.stringify({
     access_token:"fake-access-token",refresh_token:"fake-refresh-token",expires_in:3600,
     scope:"https://www.googleapis.com/auth/drive.file",
   }),{status:200});
   if(target.includes("/upload/drive/v3/files"))return new Response(JSON.stringify({id:"fileID_ABC123",name:"test.json"}),{status:200});
   if(target.includes("oauth2.googleapis.com/revoke"))return new Response("",{status:200});
   return new Response("Unexpected test destination",{status:500});
  });
  vi.stubGlobal("fetch",mock);
  await expect(finishGoogleDriveOAuth(b.user.id,state,"sample-code")).rejects.toMatchObject({status:401});
  await finishGoogleDriveOAuth(a.user.id,state,"sample-code");
  await expect(finishGoogleDriveOAuth(a.user.id,state,"sample-code")).rejects.toMatchObject({status:401});
  const stored=await prisma.googleDriveConnection.findUniqueOrThrow({where:{userId:a.user.id}});
  expect(stored.encryptedAccessToken).not.toContain("fake-access-token");
  expect(stored.encryptedRefreshToken).not.toContain("fake-refresh-token");
  expect((await googleDriveStatus(a.user.id)).connected).toBe(true);
  const backup=await backupAccountSnapshotToGoogleDrive(a.user.id);
  expect(backup.url).toBe("https://drive.google.com/file/d/fileID_ABC123/view");
  expect(mock).toHaveBeenCalled();
  await disconnectGoogleDrive(a.user.id);
  expect((await googleDriveStatus(a.user.id)).connected).toBe(false);
 });
});
