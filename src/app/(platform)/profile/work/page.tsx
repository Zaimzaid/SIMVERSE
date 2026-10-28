import type { Metadata } from "next";
import Link from "next/link";
import { BriefcaseBusiness } from "lucide-react";
import { requireUser } from "@/server/context";
import { getMyWorkCenter } from "@/server/services/player-work-service";
import { getOrientationInfo } from "@/server/services/player-training-business-service";
import { PageHeader } from "@/components/ui/page-header";
import { PlayerWorkCenter } from "@/components/player/player-work-center";

export const metadata: Metadata = { title: "Qualifications & Employment | SIMVERSE" };
export default async function PlayerWorkPage() {
  const user = await requireUser();
  const [work, orientation] = await Promise.all([
    getMyWorkCenter(user.id), getOrientationInfo(user.id),
  ]);
  return <div className="mx-auto max-w-5xl space-y-6">
    <PageHeader icon={BriefcaseBusiness} title="Qualifications, Businesses & Jobs"
      description="Build your introductory fictional career qualifications, request business reviews and apply for in-world jobs."/>
    <Link href="/profile/career" className="text-sm font-semibold text-accent hover:underline">← Back to career & wallet</Link>
    <PlayerWorkCenter initial={work} initialQuestions={orientation}/>
  </div>;
}
