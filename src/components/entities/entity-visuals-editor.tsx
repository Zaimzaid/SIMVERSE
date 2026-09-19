"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Cuboid, Play, Save, Sparkles, TriangleAlert } from "lucide-react";
import { apiFetch, fieldErrorsFrom } from "@/lib/client/api";
import { zodFieldErrors } from "@/lib/client/form";
import {
  ANIMATION_STATES,
  DEFAULT_VISUAL_PROFILE,
  PRODUCTION_ANIMATION_STATES,
  VISUAL_ARCHETYPES,
  suggestAnimationMappings,
  visualProfileInputSchema,
  visualValidationStatus,
  type AnimationProfile,
  type AnimationState,
  type ModelInspection,
  type VisualProfileInput,
} from "@/lib/visuals/profile";
import type { EntityVisualProfileView } from "@/server/services/entity-service";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { VisualPreview } from "./visual-preview";

interface Props {
  entityId: string;
  entityName: string;
  entityPortraitUrl: string | null;
  initialProfile: VisualProfileInput | null;
  initialRevision: number | null;
  canEdit: boolean;
}

const label = (value: string) => value.toLowerCase().replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase());
const numberValue = (value: string, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export function EntityVisualsEditor({ entityId, entityName, entityPortraitUrl, initialProfile, initialRevision, canEdit }: Props) {
  const { toast } = useToast();
  const [profile, setProfile] = useState<VisualProfileInput>(initialProfile ?? {
    ...DEFAULT_VISUAL_PROFILE,
    portraitUrl: entityPortraitUrl ?? undefined,
  });
  const [revision, setRevision] = useState(initialRevision);
  const [inspection, setInspection] = useState<ModelInspection | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [previewState, setPreviewState] = useState<AnimationState>("IDLE");
  const [previewToken, setPreviewToken] = useState(0);
  const status = visualValidationStatus(profile, inspection);
  const available = inspection?.animationNames ?? [];
  const availableSet = useMemo(() => new Set(available), [available]);
  const badMappings = Object.entries(profile.animationProfile).filter(([, clip]) => clip && !availableSet.has(clip));

  function setNumber(key: keyof VisualProfileInput, value: string, fallback: number) {
    setProfile((current) => ({ ...current, [key]: numberValue(value, fallback) }));
  }

  function setMapping(state: AnimationState, clip: string) {
    setProfile((current) => {
      const animationProfile: AnimationProfile = { ...current.animationProfile };
      if (clip) animationProfile[state] = clip; else delete animationProfile[state];
      return { ...current, animationProfile };
    });
  }

  function suggest() {
    const suggestions = suggestAnimationMappings(available);
    setProfile((current) => ({
      ...current,
      animationProfile: { ...suggestions, ...current.animationProfile },
    }));
    toast({ variant: "success", title: "Suggestions applied", description: "Review the mappings, then save the Visual Profile." });
  }

  async function save() {
    const parsed = visualProfileInputSchema.safeParse(profile);
    if (!parsed.success) {
      setErrors(zodFieldErrors(parsed.error));
      toast({ variant: "error", title: "Check the Visual Profile", description: "Some fields need attention." });
      return;
    }
    setErrors({}); setSaving(true);
    const result = await apiFetch<{ visualProfile: EntityVisualProfileView }>(`/api/entities/${entityId}/visual-profile`, {
      method: "PUT", body: JSON.stringify(parsed.data),
    });
    setSaving(false);
    if (result.error) {
      if (result.error.details) setErrors(fieldErrorsFrom(result.error));
      toast({ variant: "error", title: "Couldn’t save Visual Profile", description: result.error.message });
      return;
    }
    if (result.data?.visualProfile) setRevision(result.data.visualProfile.revision);
    toast({ variant: "success", title: "Visual Profile saved", description: `${entityName} will use this identity in new Simulation Runs.` });
  }

  const transformFields: Array<{ key: "scale" | "rotationX" | "rotationY" | "rotationZ" | "offsetX" | "offsetY" | "offsetZ"; title: string; step: string }> = [
    { key: "scale", title: "Scale", step: "0.05" },
    { key: "rotationX", title: "Tilt (X°)", step: "1" },
    { key: "rotationY", title: "Forward rotation (Y°)", step: "1" },
    { key: "rotationZ", title: "Roll (Z°)", step: "1" },
    { key: "offsetX", title: "Side offset", step: "0.05" },
    { key: "offsetY", title: "Height offset", step: "0.05" },
    { key: "offsetZ", title: "Depth offset", step: "0.05" },
  ];

  return <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(420px,.9fr)]">
    <div className="space-y-6">
      <Card as="section">
        <CardHeader><CardTitle>Visual source</CardTitle><CardDescription>Choose how this Entity appears. Missing or broken assets safely use a SIMVERSE fallback.</CardDescription></CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <Field label="Source" htmlFor="visual-source" error={errors.sourceType}>
            <Select id="visual-source" value={profile.sourceType} disabled={!canEdit}
              onChange={(event) => setProfile((current) => ({ ...current, sourceType: event.target.value as VisualProfileInput["sourceType"] }))}>
              <option value="PROCEDURAL">Procedural 3D fallback</option><option value="MODEL_3D">3D model</option><option value="IMAGE">Image / portrait</option>
            </Select>
          </Field>
          <Field label="Visual archetype" htmlFor="visual-archetype" hint="Creator assigned; Entity category does not force an archetype." error={errors.archetype}>
            <Select id="visual-archetype" value={profile.archetype} disabled={!canEdit}
              onChange={(event) => setProfile((current) => ({ ...current, archetype: event.target.value as VisualProfileInput["archetype"] }))}>
              {VISUAL_ARCHETYPES.map((value) => <option key={value} value={value}>{label(value)}</option>)}
            </Select>
          </Field>
          <Field label="Portrait URL" htmlFor="portrait-url" hint="Used in the Viewer HUD and intro when available." error={errors.portraitUrl} className="sm:col-span-2">
            <Input id="portrait-url" value={profile.portraitUrl ?? ""} disabled={!canEdit} placeholder="https://…/portrait.webp"
              onChange={(event) => setProfile((current) => ({ ...current, portraitUrl: event.target.value || undefined }))} />
          </Field>
          {profile.sourceType === "MODEL_3D" ? <Field label="GLTF / GLB model" htmlFor="model-url" required
            hint="Use a project path such as /models/model.glb or an HTTPS model URL. Remote servers must allow browser CORS."
            error={errors.modelUrl} className="sm:col-span-2">
            <Input id="model-url" value={profile.modelUrl ?? ""} disabled={!canEdit} placeholder="/models/simverse-sentinel.gltf"
              onChange={(event) => { setInspection(null); setProfile((current) => ({ ...current, modelUrl: event.target.value || undefined })); }} />
          </Field> : null}
          <label className="flex items-center gap-3 text-sm text-foreground sm:col-span-2">
            <input type="checkbox" checked={profile.enabled} disabled={!canEdit} className="size-4 accent-cyan-400"
              onChange={(event) => setProfile((current) => ({ ...current, enabled: event.target.checked }))} />
            Enable this Visual Profile for new runs
          </label>
        </CardContent>
      </Card>

      <Card as="section">
        <CardHeader><CardTitle>Transform</CardTitle><CardDescription>Fit the imported asset without changing simulation movement or mechanics.</CardDescription></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {transformFields.map((field) => <Field key={field.key} label={field.title} htmlFor={`visual-${field.key}`} error={errors[field.key]}>
            <Input id={`visual-${field.key}`} type="number" step={field.step} value={profile[field.key]} disabled={!canEdit}
              onChange={(event) => setNumber(field.key, event.target.value, field.key === "scale" ? 1 : 0)} />
          </Field>)}
        </CardContent>
      </Card>

      <Card as="section">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3"><div><CardTitle>Animation mapping</CardTitle><CardDescription>Map any imported clip name to the shared SIMVERSE vocabulary.</CardDescription></div>
            <Button variant="secondary" size="sm" onClick={suggest} disabled={!canEdit || available.length === 0}><Sparkles className="size-4" />Suggest mappings</Button></div>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {PRODUCTION_ANIMATION_STATES.map((state) => {
            const mapped = profile.animationProfile[state] ?? "";
            const invalid = Boolean(mapped && inspection?.loaded && !availableSet.has(mapped));
            return <Field key={state} label={label(state)} htmlFor={`animation-${state}`} error={invalid ? "Mapped clip was not found in this model." : undefined}>
              <Select id={`animation-${state}`} value={mapped} disabled={!canEdit || available.length === 0}
                onChange={(event) => setMapping(state, event.target.value)} invalid={invalid}>
                <option value="">No clip mapped</option>
                {invalid ? <option value={mapped}>{mapped} (missing)</option> : null}
                {available.map((clip) => <option key={clip} value={clip}>{clip}</option>)}
              </Select>
            </Field>;
          })}
          {profile.sourceType === "MODEL_3D" && inspection?.loaded && available.length === 0 ? <p className="text-sm text-warning sm:col-span-2">This model has no embedded animation clips. The Viewer will use procedural movement.</p> : null}
        </CardContent>
      </Card>

      {canEdit ? <div className="sticky bottom-4 z-10 flex items-center justify-between gap-3 rounded-xl border border-border-strong bg-surface-elevated/95 p-4 shadow-2xl backdrop-blur">
        <p className="text-sm text-secondary">{revision ? `Saved profile revision ${revision}` : "New Visual Profile"}</p>
        <Button onClick={() => void save()} loading={saving}>{!saving ? <Save className="size-4" /> : null}Save Visual Profile</Button>
      </div> : null}
    </div>

    <div className="space-y-6 xl:sticky xl:top-6 xl:self-start">
      <Card as="section">
        <CardHeader><CardTitle className="flex items-center gap-2"><Cuboid className="size-5 text-accent" />3D preview</CardTitle>
          <CardDescription>Drag to orbit. Scroll or pinch to zoom. Preview uses the current unsaved transform.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <VisualPreview profile={profile} animationState={previewState} previewToken={previewToken} onInspection={setInspection} />
          <div className="flex flex-col gap-2 sm:flex-row">
            <Select value={previewState} onChange={(event) => setPreviewState(event.target.value as AnimationState)} aria-label="Animation to preview">
              {ANIMATION_STATES.map((state) => <option key={state} value={state}>{label(state)}</option>)}
            </Select>
            <Button variant="secondary" onClick={() => setPreviewToken((value) => value + 1)} disabled={!profile.animationProfile[previewState]}>
              <Play className="size-4" />Preview
            </Button>
          </div>
          {!profile.animationProfile[previewState] ? <p role="status" className="text-xs text-muted">No clip mapped for this state.</p> : null}
          <p className="text-xs text-muted">Scale {profile.scale} · Rotation {profile.rotationX}°, {profile.rotationY}°, {profile.rotationZ}°</p>
        </CardContent>
      </Card>

      <Card as="section">
        <CardHeader><div className="flex items-center justify-between gap-3"><CardTitle>Asset validation</CardTitle>
          <Badge variant={status === "READY" ? "success" : status === "INVALID" ? "danger" : status === "PARTIAL" ? "warning" : "neutral"}>{status}</Badge></div></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <ValidationRow label="Model loaded" ok={Boolean(inspection?.loaded)} neutral={profile.sourceType !== "MODEL_3D"} />
          <ValidationRow label="Animations found" value={inspection?.animationNames.length ?? 0} neutral={!inspection?.loaded} />
          <ValidationRow label="Skeleton detected" ok={Boolean(inspection?.skeletonDetected)} neutral={!inspection?.loaded} />
          <ValidationRow label="Meshes" value={inspection?.meshCount ?? 0} neutral={!inspection?.loaded} />
          {inspection?.dimensions ? <ValidationRow label="Approx. dimensions" value={`${inspection.dimensions.x.toFixed(2)} × ${inspection.dimensions.y.toFixed(2)} × ${inspection.dimensions.z.toFixed(2)}`} /> : null}
          {inspection?.byteSize != null ? <ValidationRow label="File size" value={formatBytes(inspection.byteSize)} /> : null}
          {inspection?.byteSize != null && inspection.byteSize > 25_000_000 ? <p className="rounded-lg bg-warning-soft p-2 text-xs text-warning">This model is large and may load slowly. Future asset optimization can add LOD and compression.</p> : null}
          {inspection?.error ? <p role="alert" className="rounded-lg bg-danger-soft p-3 text-danger">{inspection.error} The Viewer will use a procedural fallback.</p> : null}
          {badMappings.length ? <p className="rounded-lg bg-warning-soft p-3 text-warning">{badMappings.length} mapping{badMappings.length === 1 ? "" : "s"} reference missing clips.</p> : null}
          <div className="border-t border-border pt-3">
            {(["IDLE", "RUN", "ATTACK_PRIMARY", "DODGE", "HIT_LIGHT", "DEFEATED", "VICTORY"] as const).map((state) =>
              <ValidationRow key={state} label={label(state)} ok={Boolean(profile.animationProfile[state] && availableSet.has(profile.animationProfile[state]!))} neutral={!inspection?.loaded} />)}
          </div>
        </CardContent>
      </Card>
    </div>
  </div>;
}

function ValidationRow({ label: text, ok, value, neutral }: { label: string; ok?: boolean; value?: string | number; neutral?: boolean }) {
  return <div className="flex items-center justify-between gap-3 py-1">
    <span className="text-secondary">{text}</span>
    {value != null ? <span className="font-mono text-xs text-foreground">{value}</span>
      : neutral ? <span className="text-xs text-muted">—</span>
        : ok ? <CheckCircle2 className="size-4 text-success" aria-label="Available" />
          : <TriangleAlert className="size-4 text-warning" aria-label="Missing" />}
  </div>;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
