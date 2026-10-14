"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Clapperboard } from "lucide-react";
import { apiFetch } from "@/lib/client/api";
import type { MediaAspectRatio } from "@/lib/media/constants";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

interface CreationResponse { artifact: { id: string } }

export function CreateContentButton({
  runId,
  aspectRatio = "LANDSCAPE_16_9",
  size = "md",
}: {
  runId: string;
  aspectRatio?: MediaAspectRatio;
  size?: "sm" | "md" | "lg";
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  async function create() {
    if (busy) return;
    setBusy(true);
    const result = await apiFetch<CreationResponse>("/api/media/artifacts/from-run", {
      method: "POST",
      body: JSON.stringify({ runId, aspectRatio }),
    });
    if (result.error || !result.data?.artifact) {
      setBusy(false);
      toast({ variant: "error", title: "Content could not be created", description: result.error?.message });
      return;
    }
    router.push(`/studio/${result.data.artifact.id}`);
  }

  return (
    <Button size={size} onClick={() => void create()} loading={busy}>
      <Clapperboard className="size-4" aria-hidden />
      Create Content
    </Button>
  );
}
