"use client";
import { useState } from "react"; import { useRouter } from "next/navigation"; import { Archive, ArchiveRestore, CirclePause, CirclePlay, Network, Play, Trash2 } from "lucide-react";
import { apiFetch } from "@/lib/client/api"; import type { TournamentStatus } from "@/lib/tournaments/constants"; import { Button } from "@/components/ui/button"; import { useToast } from "@/components/ui/toast";

export function TournamentActions({ tournamentId, status, canManage }: { tournamentId: string; status: TournamentStatus; canManage: boolean }) {
  const router = useRouter(); const { toast } = useToast(); const [pending, setPending] = useState("");
  async function act(action: string, method = "POST") { setPending(action); const result = await apiFetch(`/api/tournaments/${tournamentId}/${action}`, { method }); setPending(""); if (result.error) { toast({ variant: "error", title: "Tournament action failed", description: result.error.message }); return; } toast({ variant: "success", title: "Tournament updated" }); router.refresh(); }
  async function remove() { setPending("delete"); const result = await apiFetch(`/api/tournaments/${tournamentId}`, { method: "DELETE" }); setPending(""); if (result.error) { toast({ variant: "error", title: "Tournament could not be deleted", description: result.error.message }); return; } router.push("/tournaments"); router.refresh(); }
  if (!canManage) return null;
  return <div className="flex flex-wrap gap-2">
    {status === "DRAFT" ? <Button size="sm" onClick={() => act("generate")} loading={pending === "generate"}><Network className="size-4" />Generate structure</Button> : null}
    {status === "CONFIGURING" ? <Button size="sm" onClick={() => act("ready")} loading={pending === "ready"}><Play className="size-4" />Mark ready</Button> : null}
    {status === "READY" ? <Button size="sm" onClick={() => act("start")} loading={pending === "start"}><CirclePlay className="size-4" />Start</Button> : null}
    {status === "IN_PROGRESS" ? <Button size="sm" variant="secondary" onClick={() => act("pause")} loading={pending === "pause"}><CirclePause className="size-4" />Pause</Button> : null}
    {status === "PAUSED" ? <Button size="sm" onClick={() => act("resume")} loading={pending === "resume"}><CirclePlay className="size-4" />Resume</Button> : null}
    {["DRAFT","CONFIGURING","READY","IN_PROGRESS","PAUSED"].includes(status) ? <Button size="sm" variant="danger" onClick={() => act("cancel")} loading={pending === "cancel"}>Cancel</Button> : null}
    {status === "ARCHIVED" ? <Button size="sm" variant="secondary" onClick={() => act("restore")} loading={pending === "restore"}><ArchiveRestore className="size-4" />Restore</Button> : <Button size="sm" variant="secondary" onClick={() => act("archive")} loading={pending === "archive"}><Archive className="size-4" />Archive</Button>}
    {["DRAFT","CONFIGURING","CANCELLED"].includes(status) ? <Button size="sm" variant="danger" onClick={remove} loading={pending === "delete"}><Trash2 className="size-4" />Delete</Button> : null}
  </div>;
}

export function RunMatchButton({ tournamentId, matchId }: { tournamentId: string; matchId: string }) {
  const router = useRouter(); const { toast } = useToast(); const [pending, setPending] = useState(false);
  async function run() { setPending(true); const result = await apiFetch(`/api/tournaments/${tournamentId}/matches/${matchId}/run`, { method: "POST" }); setPending(false); if (result.error) { toast({ variant: "error", title: "Match Run failed", description: result.error.message }); return; } toast({ variant: "success", title: "Authoritative Match Run completed" }); router.refresh(); }
  return <Button size="sm" onClick={run} loading={pending}><Play className="size-4" />Run Match</Button>;
}
