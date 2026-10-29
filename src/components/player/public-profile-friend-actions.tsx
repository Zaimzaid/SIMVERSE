"use client";

import { useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/client/api";

type Relationship = { kind: "NONE" | "INCOMING" | "OUTGOING" | "FRIENDS" | "BLOCKED"; requestId: string | null };
export function PublicProfileFriendActions({ playerId, username, initial }: {
  playerId: string; username: string; initial: Relationship;
}) {
  const [relationship, setRelationship] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function act(method: "POST" | "PATCH", payload: Record<string, string>) {
    setError(""); setBusy(true);
    const result = await apiFetch("/api/social/friends", { method, body: JSON.stringify(payload) });
    setBusy(false);
    if (result.error) { setError(result.error.message); return; }
    if (method === "POST") setRelationship({ kind: "OUTGOING", requestId: null });
    if (payload.action === "ACCEPT") setRelationship({ kind: "FRIENDS", requestId: null });
    if (payload.action === "REMOVE") setRelationship({ kind: "NONE", requestId: null });
  }
  if (relationship.kind === "BLOCKED") return <p className="text-sm text-secondary">This connection is unavailable.</p>;
  return <div className="space-y-2">
    <div className="flex flex-wrap gap-2">
      {relationship.kind === "NONE" && <button type="button" disabled={busy} onClick={() => void act("POST", { userId: playerId })}
        className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Add friend</button>}
      {relationship.kind === "INCOMING" && relationship.requestId && <button type="button" disabled={busy} onClick={() => void act("PATCH", { id: relationship.requestId!, action: "ACCEPT" })}
        className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Accept invitation</button>}
      {relationship.kind === "OUTGOING" && <span className="rounded-xl border border-border px-4 py-2 text-sm text-secondary">Invitation pending</span>}
      {relationship.kind === "FRIENDS" && <Link href={"/social?peer=" + encodeURIComponent(playerId)}
        className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white">Message</Link>}
      {relationship.requestId && <button type="button" disabled={busy}
        onClick={() => void act("PATCH", { id: relationship.requestId!, action: "REMOVE" })}
        className="rounded-xl border border-border px-4 py-2 text-sm disabled:opacity-50">
        {relationship.kind === "FRIENDS" ? "Remove friend" : "Cancel / decline"}
      </button>}
      <Link href="/social" className="rounded-xl border border-border px-4 py-2 text-sm">Friends &amp; Messages</Link>
    </div>
    {error && <p role="alert" className="text-sm text-red-500">{error}</p>}
    <p className="text-xs text-secondary">Messages are available only after both players accept the connection.</p>
  </div>;
}
