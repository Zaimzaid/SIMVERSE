"use client";
import { useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/client/api";
import { avatarSchema, type PlayerAvatarAppearance } from "@/lib/player-avatar/appearance";
import { PlayerAvatarPreview } from "./player-avatar-preview";

export function PlayerAvatarEditor({ initial }: { initial: PlayerAvatarAppearance }) {
  const [appearance, setAppearance] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const dirty = JSON.stringify(appearance) !== JSON.stringify(saved);
  function change<K extends keyof PlayerAvatarAppearance>(key: K, value: PlayerAvatarAppearance[K]) {
    setAppearance((current) => ({ ...current, [key]: value })); setNotice("");
  }
  async function save() {
    const parsed = avatarSchema.safeParse(appearance);
    if (!parsed.success) { setNotice("Check your avatar settings."); return; }
    setSaving(true);
    const r = await apiFetch<{ appearance: PlayerAvatarAppearance }>("/api/player-avatar", {
      method: "PATCH", body: JSON.stringify(parsed.data),
    });
    setSaving(false);
    if (r.error) setNotice(r.error.message);
    else if (r.data) { setSaved(r.data.appearance); setNotice("Saved to your SIMVERSE account."); }
  }
  return <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(18rem,1fr)]">
    <PlayerAvatarPreview appearance={appearance}/>
    <section className="space-y-4 rounded-2xl border border-border bg-surface p-5">
      <h2 className="text-lg font-semibold">Customize your character</h2>
      <p className="text-sm text-secondary">This appearance belongs to your player identity, not a single animation.</p>
      {(["skin", "outfit", "hair"] as const).map((key) => <label key={key} className="flex items-center justify-between gap-3 text-sm capitalize">
        {key} color <input aria-label={key + " color"} type="color" value={appearance[key]}
          onChange={(e) => change(key, e.target.value)}/></label>)}
      <label className="block text-sm">Height: {appearance.height.toFixed(2)}×
        <input aria-label="Character height" className="mt-2 w-full" type="range" min={0.7} max={1.3} step={0.05}
          value={appearance.height} onChange={(e) => change("height", Number(e.target.value))}/>
      </label>
      <label className="block text-sm">Hairstyle
        <select className="mt-2 block w-full rounded-xl border border-border bg-background p-3"
          value={appearance.hairstyle} onChange={(e) => change("hairstyle", e.target.value as PlayerAvatarAppearance["hairstyle"])}>
          <option value="SHORT">Short</option><option value="CURLY">Curly</option><option value="NONE">No hair</option>
        </select></label>
      <button type="button" disabled={!dirty || saving} onClick={() => void save()}
        className="w-full rounded-xl bg-accent px-4 py-3 font-semibold text-white disabled:opacity-50">
        {saving ? "Saving…" : "Save my character"}</button>
      {notice && <p role="status" className="text-sm text-secondary">{notice}</p>}
      <Link href="/profile/avatar/world" className="block rounded-xl border border-border p-3 text-center text-sm font-semibold">
        Enter 3D test scene →</Link>
      {dirty && <p className="text-xs text-amber-600">Save your changes before entering the scene.</p>}
    </section>
  </div>;
}
