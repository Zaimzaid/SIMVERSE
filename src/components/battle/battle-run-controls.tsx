"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pause, Play, Swords } from "lucide-react";
import { apiFetch } from "@/lib/client/api";
import { Button } from "@/components/ui/button";

type ActiveStatus = "CREATED" | "RUNNING" | "PAUSED";
interface RunResponse { run: { id: string; status: string; currentTick: number } }

interface Props {
  simulationId: string;
  runId?: string;
  status?: ActiveStatus;
  createRunPath?: string;
  runBasePath?: string;
}

/** Drives only existing bounded Core endpoints; every state transition remains server-authoritative. */
export function BattleRunControls({ simulationId, runId, status, createRunPath, runBasePath }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [recoveryRunId, setRecoveryRunId] = useState<string | null>(null);
  const busyRef = useRef(false);

  async function post(path: string, body?: object): Promise<RunResponse> {
    const result = await apiFetch<RunResponse>(path, { method: "POST", body: JSON.stringify(body ?? {}) });
    if (result.error) throw new Error(result.error.message);
    if (!result.data?.run) throw new Error("The server did not return a Battle run.");
    return result.data;
  }

  async function execute(watch: boolean) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setMessage("");
    setRecoveryRunId(null);
    let activeRunId = runId;
    try {
      let currentStatus: string = status ?? "CREATED";
      if (!activeRunId) {
        setMessage("Creating Battle run…");
        const created = await post(createRunPath ?? `/api/simulations/${simulationId}/runs`);
        activeRunId = created.run.id;
        currentStatus = created.run.status;
      }
      if (currentStatus === "CREATED" || currentStatus === "PAUSED") {
        setMessage(currentStatus === "PAUSED" ? "Resuming Battle…" : "Starting Battle…");
        const transition = currentStatus === "PAUSED" ? "resume" : "start";
        currentStatus = (await post(`/api/simulation-runs/${activeRunId}/${transition}`)).run.status;
      }
      // Battle v1 has an absolute 160-tick cap. Four batches of 40 cover it,
      // including a continued run, without asking the server for an unbounded job.
      for (let batch = 0; batch < 4 && currentStatus === "RUNNING"; batch += 1) {
        setMessage(`Simulating Battle… batch ${batch + 1} of up to 4`);
        const advanced = await post(`/api/simulation-runs/${activeRunId}/advance`, { maxTicks: 40 });
        currentStatus = advanced.run.status;
      }
      if (activeRunId) {
        const base = runBasePath ?? `/simulations/${simulationId}/runs`;
        router.push(`${base}/${activeRunId}${watch && currentStatus === "COMPLETED" ? "/watch" : ""}`);
        router.refresh();
      }
      if (currentStatus === "RUNNING") setMessage("Battle is still running. Open the run to continue.");
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Battle could not continue.";
      setRecoveryRunId(activeRunId ?? null);
      setMessage(activeRunId
        ? `${detail} The run was saved. Open its detail page to inspect or continue it.`
        : detail);
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
      setMessage("Battle paused.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Battle could not be paused.");
    } finally {
      setBusy(false);
    }
  }

  const label = !runId ? "Run & Watch" : status === "CREATED" ? "Start & Watch"
    : status === "PAUSED" ? "Resume & Watch" : "Continue & Watch";
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button onClick={() => void execute(true)} loading={busy} disabled={busy || Boolean(recoveryRunId && !runId)}>
        {runId ? <Play className="size-4" aria-hidden /> : <Swords className="size-4" aria-hidden />}
        {label}
      </Button>
      {!runId ? <Button variant="secondary" onClick={() => void execute(false)} disabled={busy || Boolean(recoveryRunId)}>
        Run Battle
      </Button> : null}
      {runId && status === "RUNNING" ? (
        <Button variant="secondary" onClick={pause} disabled={busy}>
          <Pause className="size-4" aria-hidden />Pause
        </Button>
      ) : null}
      {message ? <p role="status" className="basis-full text-sm text-secondary">{message}</p> : null}
      {recoveryRunId && !runId ? (
        <Link href={`${runBasePath ?? `/simulations/${simulationId}/runs`}/${recoveryRunId}`}
          className="text-sm font-medium text-accent hover:underline">Open saved Battle run</Link>
      ) : null}
    </div>
  );
}
