import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isHiddenResourceError } from "@/lib/errors";
import { requirePlatformContext } from "@/server/context";
import { getEconomyLab } from "@/server/services/economy-lab-service";
import { EconomyWorldShowcase } from "@/components/economy/economy-world-showcase";

export const metadata: Metadata = {
  title: "Living Town 3D | SIMVERSE Economy Lab",
  description: "Walk through a small illustrative 3D economy connected to saved SIMVERSE town data.",
};
export default async function EconomyWorldPage({
  params,
}: { params: Promise<{ labId: string }> }) {
  const ctx = await requirePlatformContext();
  const { labId } = await params;
  let town;
  try {
    town = await getEconomyLab(ctx.user.id, ctx.workspace.id, labId);
  } catch (error) {
    if (isHiddenResourceError(error)) notFound();
    throw error;
  }
  return <EconomyWorldShowcase initial={town}/>;
}
