"use client";

import { useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { PlayerIdentityForm, type EditablePlayerIdentity } from "./player-identity-form";

type Country = { id: string; name: string; isoAlpha2: string | null };

/**
 * One stable owner-facing profile summary. The lengthy edit form is mounted
 * only for first-time setup or on an explicit "Edit Profile" action.
 * Saving updates the visible summary and closes the form; cancel discards edits.
 */
export function ProfileIdentityPanel({ initial, countries }: {
  initial: EditablePlayerIdentity; countries: Country[];
}) {
  const [profile, setProfile] = useState(initial);
  const [editing, setEditing] = useState(!initial.username);
  const hasProfile = Boolean(profile.username);

  return <section id="identity" className="space-y-4 scroll-mt-6" aria-labelledby="profile-identity-heading">
    <div className="overflow-hidden rounded-3xl border border-border bg-surface">
      <div className="relative h-36 bg-gradient-to-br from-[#13283e] via-[#087988] to-[#1a4f65] sm:h-52">
        {profile.bannerUrl && <img src={profile.bannerUrl} alt="" className="size-full object-cover"/>}
      </div>
      <div className="flex flex-wrap items-center gap-4 px-5 py-5 sm:px-8">
        <Avatar name={profile.displayName} src={profile.avatarUrl} size="lg" className="ring-4 ring-surface"/>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-widest text-accent">My SIMVERSE Profile</p>
          <h1 id="profile-identity-heading" className="truncate text-2xl font-semibold sm:text-3xl">{profile.displayName}</h1>
          <p className="text-sm text-secondary">{profile.username ? "@" + profile.username : "Choose your username to get started"}</p>
          {profile.biography && <p className="mt-1 max-w-xl whitespace-pre-wrap text-sm text-secondary">{profile.biography}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          {!editing && <button type="button" onClick={() => setEditing(true)}
            className="rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground">Edit Profile</button>}
          {editing && hasProfile && <button type="button" onClick={() => setEditing(false)}
            className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold">Cancel editing</button>}
          {profile.username && profile.profileVisibility === "PUBLIC" &&
            <a href={"/u/" + encodeURIComponent(profile.username)}
              className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium">View as visitor</a>}
        </div>
      </div>
    </div>
    {editing ? <div className="space-y-3" aria-label="Edit profile details">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">{hasProfile ? "Edit your details" : "Complete your player profile"}</h2>
          <p className="text-sm text-secondary">Your details will appear above after you save.</p>
        </div>
      </div>
      <PlayerIdentityForm initial={profile} countries={countries} onSaved={(saved) => {
        setProfile(saved);
        if (saved.username) setEditing(false);
      }}/>
    </div> : <div className="rounded-2xl border border-border bg-surface px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">Your profile details</h2>
          <p className="mt-1 text-sm text-secondary">Your saved information is displayed above. Edit it only when you need to make changes.</p>
          {profile.creatorName && <p className="mt-2 text-sm text-secondary">Creator: {profile.creatorName}</p>}
          {profile.homeCountry?.name && <p className="text-sm text-secondary">Virtual home: {profile.homeCountry.name}</p>}
          <p className="mt-1 text-xs text-secondary">Visibility: {profile.profileVisibility === "PUBLIC" ? "Public" : "Only you and accepted friends"}</p>
        </div>
        <button type="button" onClick={() => setEditing(true)}
          className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold hover:border-accent">Edit Profile</button>
      </div>
    </div>}
  </section>;
}
