"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Copy, Eye, EyeOff, Globe2, Save, ShieldCheck, UserRound } from "lucide-react";
import { playerIdentityUpdateSchema } from "@/lib/player-identity/schema";
import { apiFetch, fieldErrorsFrom } from "@/lib/client/api";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { ImageUpload } from "@/components/platform/settings/image-upload";

export interface EditablePlayerIdentity {
  simverseId: string;
  username: string | null;
  displayName: string;
  email: string;
  avatarUrl: string | null;
  bannerUrl: string | null;
  creatorName: string | null;
  biography: string;
  profileVisibility: string;
  experienceMode: string;
  homeCountryId: string | null;
  homeCountry: { name: string } | null;
  citizenships: Array<{ id: string; status: string; category: string; country: { name: string } }>;
}

interface Props {
  initial: EditablePlayerIdentity;
  countries: Array<{ id: string; name: string; isoAlpha2: string | null }>;
}

const inputClass = "w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-accent";
const labelClass = "mb-1.5 block text-xs font-semibold uppercase tracking-wider text-secondary";

export function PlayerIdentityForm({ initial, countries }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [identity, setIdentity] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  function setField(key: keyof EditablePlayerIdentity, value: string) {
    setIdentity((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: "" }));
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const payload = {
      username: identity.username ?? "",
      displayName: identity.displayName,
      avatarUrl: identity.avatarUrl ?? "",
      bannerUrl: identity.bannerUrl ?? "",
      creatorName: identity.creatorName ?? "",
      biography: identity.biography,
      profileVisibility: identity.profileVisibility,
      experienceMode: identity.experienceMode,
      homeCountryId: identity.homeCountryId ?? "",
    };
    const parsed = playerIdentityUpdateSchema.safeParse(payload);
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((issue) => [String(issue.path[0]), issue.message])));
      return;
    }
    setSaving(true);
    const { data, error } = await apiFetch<{ identity: EditablePlayerIdentity }>("/api/player-identity", {
      method: "PATCH", body: JSON.stringify(payload),
    });
    setSaving(false);
    if (error) {
      setErrors(fieldErrorsFrom(error));
      toast({ variant: "error", title: "Profile not updated", description: error.message });
      return;
    }
    if (data?.identity) setIdentity(data.identity);
    setErrors({});
    router.refresh();
    toast({ variant: "success", title: "Player profile saved", description: "Identity and visibility settings updated." });
  }

  return (
    <div className="space-y-5">
      <div className="overflow-hidden rounded-2xl border border-border bg-surface">
        <div className="relative h-36 bg-gradient-to-r from-[#122d52] via-[#0c747f] to-[#166d81] sm:h-44">
          {identity.bannerUrl ? (
            // External display URLs are owner supplied; no server uploads yet.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={identity.bannerUrl} alt="" className="h-full w-full object-cover" />
          ) : null}
          <div className="absolute bottom-3 right-4 rounded-lg bg-black/45 px-2.5 py-1 text-xs text-white">
            SIMVERSE PLAYER IDENTITY
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-4 p-5">
          <Avatar name={identity.displayName} src={identity.avatarUrl} size="lg" className="ring-4 ring-surface" />
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-xl font-semibold text-foreground">{identity.displayName}</h2>
            <p className="text-sm text-secondary">{identity.username ? `@${identity.username}` : "Choose your SIMVERSE username"}</p>
            <p className="mt-1 text-xs text-muted">{identity.experienceMode.toLowerCase()} · {identity.profileVisibility.toLowerCase()} profile</p>
          </div>
          {identity.username && identity.profileVisibility === "PUBLIC" ? (
            <Link href={`/u/${identity.username}`}
              className="rounded-lg border border-accent/40 px-3 py-2 text-sm text-accent hover:bg-accent-soft">
              View public profile
            </Link>
          ) : null}
        </div>
      </div>

      <section className="rounded-2xl border border-border bg-surface p-5" aria-label="SIMVERSE identity credentials">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-5 text-accent" aria-hidden />
          <h2 className="font-semibold">SIMVERSE Identity Number</h2>
        </div>
        <p className="mt-1 text-sm text-secondary">Permanent in-world identifier. This is not a national identification number or real government document.</p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <code className="rounded-lg border border-border bg-background px-3 py-2 text-sm font-semibold tracking-wider text-accent">{identity.simverseId}</code>
          <Button type="button" variant="secondary" size="sm" onClick={() => {
            void navigator.clipboard.writeText(identity.simverseId).then(() => setCopied(true)).catch(() => {
              toast({ variant: "error", title: "Unable to copy", description: "Please select and copy the ID manually." });
            });
          }}><Copy className="size-3.5" /> {copied ? "Copied" : "Copy"}</Button>
        </div>
        {identity.username ? (
          <Link href="/profile/documents#credential-wallet-heading"
            className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-accent hover:underline">
            <ShieldCheck className="size-4" aria-hidden /> View my virtual ID card and passports →
          </Link>
        ) : (
          <p className="mt-3 text-xs text-muted">
            Once you save a SIMVERSE username, your player number will also appear on a virtual ID card in My Documents.
          </p>
        )}
      </section>

      <form onSubmit={save} className="space-y-5">
        <section className="rounded-2xl border border-border bg-surface p-5">
          <h2 className="flex items-center gap-2 text-base font-semibold"><UserRound className="size-4 text-accent" /> Public identity and customization</h2>
          <p className="mt-1 text-sm text-secondary">Choose how your player and creator identity appears across SIMVERSE.</p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="identity-username" className={labelClass}>Unique username</label>
              <input id="identity-username" value={identity.username ?? ""} onChange={(e) => setField("username", e.target.value)}
                placeholder="simcreator" autoComplete="username" maxLength={24} className={inputClass} aria-invalid={Boolean(errors.username)}/>
              {errors.username ? <p className="mt-1 text-xs text-warning">{errors.username}</p> : <p className="mt-1 text-xs text-muted">3–24 letters, numbers or underscores; starts with a letter.</p>}
            </div>
            <div>
              <label htmlFor="identity-name" className={labelClass}>Display name</label>
              <input id="identity-name" value={identity.displayName} onChange={(e) => setField("displayName", e.target.value)} maxLength={60} className={inputClass}/>
              {errors.displayName ? <p className="mt-1 text-xs text-warning">{errors.displayName}</p> : null}
            </div>
            <div>
              <label htmlFor="identity-creator" className={labelClass}>Creator name (optional)</label>
              <input id="identity-creator" value={identity.creatorName ?? ""} onChange={(e) => setField("creatorName", e.target.value)} maxLength={60} className={inputClass} placeholder="Studio or creator alias"/>
              {errors.creatorName ? <p className="mt-1 text-xs text-warning">{errors.creatorName}</p> : null}
            </div>
            <div>
              <label htmlFor="identity-mode" className={labelClass}>SIMVERSE participation</label>
              <select id="identity-mode" value={identity.experienceMode} onChange={(e) => setField("experienceMode", e.target.value)} className={inputClass}>
                <option value="PLAYER">Player</option><option value="CREATOR">Creator</option><option value="BOTH">Player and Creator</option>
              </select>
              <p className="mt-1 text-xs text-muted">An identity preference, not an administrator permission.</p>
            </div>
            <div>
              <label htmlFor="identity-avatar" className={labelClass}>Avatar image URL (HTTPS)</label>
              <input id="identity-avatar" type="url" value={identity.avatarUrl ?? ""} onChange={(e) => setField("avatarUrl", e.target.value)}
                className={inputClass} placeholder="https://…"/>
              {errors.avatarUrl ? <p className="mt-1 text-xs text-warning">{errors.avatarUrl}</p> : null}
            </div>
            <div>
              <label htmlFor="identity-banner" className={labelClass}>Profile banner URL (HTTPS)</label>
              <input id="identity-banner" type="url" value={identity.bannerUrl ?? ""} onChange={(e) => setField("bannerUrl", e.target.value)}
                className={inputClass} placeholder="https://…"/>
              {errors.bannerUrl ? <p className="mt-1 text-xs text-warning">{errors.bannerUrl}</p> : null}
            </div>
          </div>
          <div className="grid gap-4 rounded-xl border border-border bg-background p-4 sm:grid-cols-2">
            <ImageUpload endpoint="/api/account/avatar" label="Upload profile photo"
              onUploaded={(url) => setField("avatarUrl", url)}/>
            <ImageUpload endpoint="/api/account/banner" label="Upload cover banner"
              onUploaded={(url) => setField("bannerUrl", url)}/>
          </div>
          <div className="mt-4">
            <label htmlFor="identity-biography" className={labelClass}>Biography</label>
            <textarea id="identity-biography" value={identity.biography} onChange={(e) => setField("biography", e.target.value)}
              rows={4} maxLength={500} className={inputClass} placeholder="Tell people who you are in the SIMVERSE world…"/>
            <p className="mt-1 text-right text-xs text-muted">{identity.biography.length}/500</p>
          </div>
          <div className="mt-4">
            <label htmlFor="identity-visibility" className={labelClass}>Profile visibility</label>
            <select id="identity-visibility" value={identity.profileVisibility} onChange={(e) => setField("profileVisibility", e.target.value)} className={inputClass}>
              <option value="PRIVATE">Private — only you can view your profile</option>
              <option value="PUBLIC">Public — visible through /u/username</option>
            </select>
            <p className="mt-2 flex items-center gap-2 text-xs text-secondary">
              {identity.profileVisibility === "PUBLIC" ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
              Your email, SIMVERSE ID and citizenship records are never shown publicly.
            </p>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-surface p-5">
          <h2 className="flex items-center gap-2 text-base font-semibold"><Globe2 className="size-4 text-accent" /> Virtual home country</h2>
          <p className="mt-1 text-sm text-secondary">Choose where you want your SIMVERSE character to begin. This is a personal world preference, not verified nationality or citizenship.</p>
          <div className="mt-4">
            <label htmlFor="identity-country" className={labelClass}>Country</label>
            <select id="identity-country" value={identity.homeCountryId ?? ""} onChange={(e) => setField("homeCountryId", e.target.value)}
              className={inputClass} disabled={!countries.length}>
              <option value="">Not selected</option>
              {countries.map((country) => <option value={country.id} key={country.id}>{country.name}</option>)}
            </select>
            {errors.homeCountryId ? <p className="mt-1 text-xs text-warning">{errors.homeCountryId}</p> : null}
            {!countries.length ? <p className="mt-2 text-xs text-muted">Virtual home countries will appear once verified locations are added. Save your profile now and choose one later.</p> : null}
          </div>
          <div className="mt-4 rounded-xl border border-border bg-background p-4">
            <p className="text-sm font-semibold">Citizenship & document status</p>
            {identity.citizenships.length ? (
              <ul className="mt-2 space-y-2">
                {identity.citizenships.map((entry) => <li key={entry.id} className="text-sm text-secondary">
                  {entry.country.name} — {entry.status.replaceAll("_", " ").toLowerCase()}
                </li>)}
              </ul>
            ) : <p className="mt-2 text-sm text-secondary">No citizenship application or grant exists. Passport and residency applications will come in Phase 2.</p>}
            <p className="mt-2 text-xs text-warning">Virtual SIMVERSE documents only. Nothing here grants travel, property or real-world government rights.</p>
          </div>
        </section>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted">Account email (private): {identity.email}</p>
          <Button type="submit" loading={saving} disabled={saving}><Save className="size-4" /> Save player profile</Button>
        </div>
      </form>
    </div>
  );
}
