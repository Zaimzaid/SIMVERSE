"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore } from "lucide-react";
import { apiFetch } from "@/lib/client/api";
import type { ExperienceProfileStatus } from "@/lib/experiences/constants";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

export function ExperienceActions({ profile }: { profile: { id: string; status: ExperienceProfileStatus } }) {
  const router = useRouter(); const { toast } = useToast(); const [busy, setBusy] = useState(false);
  const archived = profile.status === "ARCHIVED";
  async function run() {
    setBusy(true); const result = await apiFetch(`/api/experiences/${profile.id}/${archived ? "restore" : "archive"}`, { method: "POST" }); setBusy(false);
    if (result.error) { toast({ variant: "error", title: "Profile status was not changed", description: result.error.message }); return; }
    toast({ variant: "success", title: archived ? "Experience Profile restored" : "Experience Profile archived" }); router.refresh();
  }
  return <Button variant="secondary" onClick={run} loading={busy}>{archived ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />}{archived ? "Restore" : "Archive"}</Button>;
}
