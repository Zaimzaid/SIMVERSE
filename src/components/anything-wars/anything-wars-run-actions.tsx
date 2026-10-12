"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, RefreshCw } from "lucide-react";
import { apiFetch } from "@/lib/client/api";
import { anythingWarsRunHref } from "@/lib/anything-wars/routes";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

interface RunResponse {
  run: { id: string; status: string };
}

export function AnythingWarsRunActions({
  simulationId,
  runId,
  status,
}: {
  simulationId: string;
  runId: string;
  status: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  async function runAgain() {
    setBusy(true);
    const created = await apiFetch<RunResponse>(`/api/anything-wars/events/${simulationId}/runs`, { method: "POST" });
    if (created.error || !created.data?.run) {
      setBusy(false);
      toast({ variant: "error", title: "Could not create another Run", description: created.error?.message });
      return;
    }
    const started = await apiFetch<RunResponse>(`/api/simulation-runs/${created.data.run.id}/start`, { method: "POST" });
    setBusy(false);
    if (started.error) {
      toast({ variant: "error", title: "Run created but could not start", description: started.error.message });
    }
    router.push(anythingWarsRunHref(simulationId, created.data.run.id));
    router.refresh();
  }

  async function cancel() {
    setBusy(true);
    const result = await apiFetch<RunResponse>(`/api/simulation-runs/${runId}/cancel`, { method: "POST" });
    setBusy(false);
    if (result.error) {
      toast({ variant: "error", title: "Run could not be cancelled", description: result.error.message });
      return;
    }
    toast({ variant: "success", title: "Run cancelled" });
    router.refresh();
  }

  return (
    <div className="flex flex-wrap gap-2">
      {status === "COMPLETED" || status === "CANCELLED" || status === "FAILED" ? (
        <Button variant="secondary" onClick={() => void runAgain()} loading={busy}>
          <RefreshCw className="size-4" /> Run Again
        </Button>
      ) : null}
      {["CREATED", "RUNNING", "PAUSED"].includes(status) ? (
        <Button variant="danger" onClick={() => void cancel()} loading={busy}>
          <Ban className="size-4" /> Cancel Run
        </Button>
      ) : null}
    </div>
  );
}
