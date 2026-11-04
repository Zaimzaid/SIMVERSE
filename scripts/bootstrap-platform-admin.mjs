import "dotenv/config";
import {PrismaClient} from "@prisma/client";
import {PrismaBetterSqlite3} from "@prisma/adapter-better-sqlite3";

const email=process.argv[2]?.trim().toLowerCase();
if(!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){
 console.error("Usage: node scripts/bootstrap-platform-admin.mjs <existing-owner-email>");
 process.exit(1);
}
if(!process.env.DATABASE_URL)throw new Error("Set DATABASE_URL before bootstrapping.");
const prisma=new PrismaClient({adapter:new PrismaBetterSqlite3({url:process.env.DATABASE_URL})});
try{
 const user=await prisma.user.findUnique({where:{email},select:{id:true,twoFactorEnabledAt:true}});
 if(!user)throw new Error("The owner must register a normal KAVANDRO account first.");
 if(!user.twoFactorEnabledAt)throw new Error("Enable authenticator-based 2FA in account settings before bootstrapping.");
 const existing=await prisma.platformAdmin.findFirst({where:{role:"OWNER"}});
 if(existing && existing.userId!==user.id)throw new Error("A platform owner already exists; refusing to create another.");
 if(!existing){
  await prisma.$transaction(async tx=>{
   await tx.platformAdmin.create({data:{userId:user.id,role:"OWNER"}});
   await tx.auditLog.create({data:{actorUserId:user.id,action:"platform_admin.owner_bootstrapped"}});
  });
 }
 console.log("Platform owner ready. Visit /admin/access and enter your authenticator code.");
}finally{await prisma.$disconnect();}
