"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Flame, Pause, Play } from "lucide-react";
import { apiFetch } from "@/lib/client/api";
import { Button } from "@/components/ui/button";

type ActiveStatus = "CREATED" | "RUNNING" | "PAUSED";
interface RunResponse { run: { id: string; status: string; currentTick: number } }

interface Props {
  simulationId: string;
  runId?: string;
  status?: ActiveStatus;
  currentTick?: number;
  maxTicks: number;
  createRunPath?: string;
  runBasePath?: string;
}

/** Drives bounded Core endpoints; all Survival state transitions remain server-authoritative. */
export function SurvivalRunControls({ simulationId, runId, status, currentTick = 0, maxTicks, createRunPath, runBasePath }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [recoveryRunId, setRecoveryRunId] = useState<string | null>(null);
  const busyRef = useRef(false);

  async function post(path: string, body?: object): Promise<RunResponse> {
    const result = await apiFetch<RunResponse>(path, { method: "POST", body: JSON.stringify(body ?? {}) });
    if (result.error) throw new Error(result.error.message);
    if (!result.data?.run) throw new Error("The server did not return a Survival run.");
    return result.data;
  }

  async function execute() {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setMessage("");
    setRecoveryRunId(null);
    let activeRunId = runId;
    try {
      let activeTick = currentTick;
      let currentStatus: string = status ?? "CREATED";
      if (!activeRunId) {
        setMessage("Creating Survival run…");
        const created = await post(createRunPath ?? `/api/simulations/${simulationId}/runs`);
        activeRunId = created.run.id;
        currentStatus = created.run.status;
        activeTick = created.run.currentTick;
      }
      if (currentStatus === "CREATED" || currentStatus === "PAUSED") {
        setMessage(currentStatus === "PAUSED" ? "Resuming Survival…" : "Starting Survival…");
        const transition = currentStatus === "PAUSED" ? "resume" : "start";
        const moved = await post(`/api/simulation-runs/${activeRunId}/${transition}`);
        currentStatus = moved.run.status;
        activeTick = moved.run.currentTick;
      }
      const maximumBatches = Math.ceil(Math.max(0, maxTicks - activeTick) / 100);
      for (let batch = 0; batch < maximumBatches && currentStatus === "RUNNING"; batch += 1) {
        setMessage(`Simulating Survival… batch ${batch + 1} of ${maximumBatches}`);
        const advanced = await post(`/api/simulation-runs/${activeRunId}/advance`, { maxTicks: 100 });
        currentStatus = advanced.run.status;
        activeTick = advanced.run.currentTick;
      }
      if (activeRunId) {
        router.push(`${runBasePath ?? `/simulations/${simulationId}/runs`}/${activeRunId}`);
        router.refresh();
      }
      if (currentStatus === "RUNNING") setMessage("Survival is still running. Open the saved run to continue.");
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Survival could not continue.";
      setRecoveryRunId(activeRunId ?? null);
      setMessage(activeRunId ? `${detail} The run was saved; open it to inspect or continue.` : detail);
      router.refresh();
    } finally {
      setBusy(false);
      busyRef.current = false;
    }
  }

  async function pause() {
    if (!runId || busy) return;
    setBusy(true);
    try {
      await post(`/api/simulation-runs/${runId}/pause`);
      setMessage("Survival paused.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Survival could not be paused.");
    } finally {
      setBusy(false);
    }
  }

  const label = !runId ? "Run Survival" : status === "CREATED" ? "Start Survival"
    : status === "PAUSED" ? "Resume Survival" : "Continue Survival";
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button onClick={() => void execute()} loading={busy} disabled={busy || Boolean(recoveryRunId && !runId)}>
        {runId ? <Play className="size-4" aria-hidden /> : <Flame className="size-4" aria-hidden />}
        {label}
      </Button>
      {runId && status === "RUNNING" ? (
        <Button variant="secondary" onClick={pause} disabled={busy}>
          <Pause className="size-4" aria-hidden />Pause
        </Button>
      ) : null}
      {message ? <p role="status" className="basis-full text-sm text-secondary">{message}</p> : null}
      {recoveryRunId && !runId ? (
        <Link href={`${runBasePath ?? `/simulations/${simulationId}/runs`}/${recoveryRunId}`}
          className="text-sm font-medium text-accent hover:underline">Open saved Survival run</Link>
      ) : null}
    </div>
  );
}
