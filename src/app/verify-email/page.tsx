import type {Metadata} from "next";
import {VerifyEmail} from "@/components/auth/verify-email";
export const metadata:Metadata={title:"Verify your SIMVERSE email"};
export default async function VerifyEmailPage({searchParams}:{searchParams:Promise<{token?:string}>}){
 const {token=""}=await searchParams;
 return <main className="mx-auto flex min-h-screen max-w-md items-center p-6"><VerifyEmail token={token}/></main>;
}
