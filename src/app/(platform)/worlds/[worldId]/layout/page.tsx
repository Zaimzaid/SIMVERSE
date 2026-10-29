import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin } from "lucide-react";
import { requirePlatformContext } from "@/server/context";
import { loadWorldLayout } from "@/server/services/world-layout-service";
import { NotFoundError } from "@/lib/errors";
import { WorldLayoutStudio } from "@/components/worlds/world-layout-studio";

export const metadata={title:"3D World Layout | SIMVERSE"};
export default async function WorldLayoutPage({params}:{params:Promise<{worldId:string}>}){
  const {worldId}=await params;
  const {user,workspace,permissions}=await requirePlatformContext();
  let layout;
  try {layout=await loadWorldLayout(user.id,workspace.id,worldId);}
  catch(error){if(error instanceof NotFoundError)notFound();throw error;}
  return <main className="mx-auto max-w-7xl space-y-5 pb-16">
    <Link href={`/worlds/${worldId}`} className="inline-flex items-center gap-2 text-sm text-muted">
      <ArrowLeft className="size-4"/>Back to {layout.worldName}
    </Link>
    <header>
      <p className="flex items-center gap-2 text-sm text-muted"><MapPin className="size-4"/>SIMVERSE World Creator</p>
      <h1 className="mt-2 text-3xl font-bold">3D World Layout</h1>
      <p className="mt-2 text-sm text-muted">Position, rotate and resize assets in a real 3D preview. Saving creates a new World version.</p>
    </header>
    <WorldLayoutStudio initial={layout} canEdit={permissions.includes("world.manage")&&layout.status!=="ARCHIVED"}/>
  </main>;
}
