"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { apiFetch } from "@/lib/client/api";

type DirectoryResult = {
  district: { id: string; name: string };
  mine: { visible: boolean; intro: string };
  neighbors: {
    displayName: string; intro: string;
    publicUsername: string | null; friendTargetUserId: string | null;
  }[];
  cappedAt: number;
  notice: string;
};

export function DistrictClubDirectoryClient() {
  const [directory, setDirectory] = useState<DirectoryResult | null>(null);
  const [visible, setVisible] = useState(false);
  const [intro, setIntro] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [connection, setConnection] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const result = await apiFetch<DirectoryResult>("/api/civilization/club/directory");
    if (result.data) {
      setDirectory(result.data);
      setVisible(result.data.mine.visible);
      setIntro(result.data.mine.intro);
      setError("");
    } else {
      setDirectory(null);
      setError(result.error?.message ?? "The neighbor directory could not be loaded.");
    }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    const result = await apiFetch<{ visible: boolean; intro: string }>(
      "/api/civilization/club/directory", {
        method: "PATCH", body: JSON.stringify({ visible, intro }),
      },
    );
    setBusy(false);
    if (!result.data) {
      setError(result.error?.message ?? "Could not save your discoverability choice.");
      return;
    }
    setNotice(result.data.visible
      ? "Your introduction is now visible to eligible residents of this district only."
      : "You are hidden from the resident directory and your introduction was cleared.");
    await load();
  }

  async function sendFriendRequest(userId: string) {
    setConnection(current => ({ ...current, [userId]: "Sending…" }));
    const result = await apiFetch<{ id: string }>("/api/social/friends", {
      method: "POST", body: JSON.stringify({ userId }),
    });
    setConnection(current => ({
      ...current,
      [userId]: result.data
        ? "Friend request sent. You can chat after the neighbor accepts."
        : result.error?.message ?? "Friend request unavailable.",
    }));
  }

  return <section className="rounded-2xl border border-border bg-surface p-5 sm:p-7"
    aria-labelledby="club-directory-heading">
    <h2 id="club-directory-heading" className="font-display text-xl font-semibold text-foreground">
      Meet your neighbors
    </h2>
    <p className="mt-2 text-sm leading-7 text-secondary">
      A private, optional resident directory. It is not a public player search,
      and simply joining a district never lists your profile.
    </p>
    {loading ? <p className="mt-4 text-sm text-secondary">Loading directory…</p> :
      !directory ? <p role="alert" className="mt-4 text-sm text-rose-600">{error}</p> :
      <div className="mt-5 space-y-6">
        <form onSubmit={save} className="space-y-4 rounded-xl border border-border bg-background p-4">
          <label htmlFor="club-directory-optin" className="flex cursor-pointer items-start gap-3">
            <input id="club-directory-optin" type="checkbox" checked={visible}
              onChange={event => setVisible(event.target.checked)}
              className="mt-1 size-4 shrink-0 accent-cyan-600" />
            <span className="text-sm font-semibold text-foreground">
              Let other approved residents of my current district find me
              <span className="mt-1 block font-normal leading-6 text-secondary">
                Off by default. If you change districts, you must opt in again.
                You can hide yourself at any time.
              </span>
            </span>
          </label>
          {visible && <div>
            <label htmlFor="club-directory-intro" className="block text-sm font-semibold text-foreground">
              Short introduction (optional)
            </label>
            <textarea id="club-directory-intro" rows={2} maxLength={180}
              value={intro} onChange={event => setIntro(event.target.value)}
              placeholder="Share a hobby or something you'd like to talk about…"
              className="mt-2 w-full rounded-xl border border-border bg-surface p-3 text-sm text-foreground" />
            <p className="mt-1 text-xs text-secondary">{intro.length}/180 characters</p>
          </div>}
          <button type="submit" disabled={busy}
            className="rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-accent-foreground disabled:opacity-50">
            {busy ? "Saving…" : "Save directory privacy"}
          </button>
        </form>

        <div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-lg font-semibold text-foreground">Opted-in neighbors</h3>
            <button type="button" onClick={() => { setLoading(true); void load(); }}
              className="rounded-lg border border-border px-3 py-2 text-xs font-semibold text-accent">
              Refresh
            </button>
          </div>
          <p className="mt-2 text-xs leading-6 text-secondary">
            {directory.notice} Only public player profiles support friend requests;
            private profiles can still choose to be listed inside the club.
          </p>
          {directory.neighbors.length === 0 ?
            <p className="mt-4 rounded-xl bg-background p-4 text-sm text-secondary">
              No neighbors have opted into the directory yet.
            </p> :
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {directory.neighbors.map((neighbor, index) =>
                <li key={(neighbor.friendTargetUserId ?? neighbor.displayName) + "-" + index}
                  className="rounded-xl border border-border bg-background p-4">
                  <p className="font-semibold text-foreground">{neighbor.displayName}</p>
                  {neighbor.publicUsername && <p className="mt-1 text-xs text-accent">
                    @{neighbor.publicUsername}
                  </p>}
                  {neighbor.intro && <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-secondary">
                    {neighbor.intro}
                  </p>}
                  {neighbor.friendTargetUserId && <div className="mt-3">
                    <button type="button" disabled={Boolean(connection[neighbor.friendTargetUserId])}
                      onClick={() => void sendFriendRequest(neighbor.friendTargetUserId!)}
                      className="rounded-lg border border-border px-3 py-2 text-xs font-semibold text-accent disabled:opacity-60">
                      {connection[neighbor.friendTargetUserId] ? "Friend request attempted" : "Send friend request"}
                    </button>
                    {connection[neighbor.friendTargetUserId] && <p role="status"
                      className="mt-2 text-xs text-secondary">
                      {connection[neighbor.friendTargetUserId]}
                    </p>}
                  </div>}
                </li>)}
            </ul>}
        </div>
      </div>}
    {error && directory && <p role="alert" className="mt-4 text-sm text-rose-600">{error}</p>}
    {notice && <p role="status" className="mt-4 text-sm text-secondary">{notice}</p>}
  </section>;
}
