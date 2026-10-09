"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Save, Trash2 } from "lucide-react";
import {
  AUDIO_CUES, CAMERA_CUES, EXPERIENCE_ASSET_ROLES, EXPERIENCE_EVENT_TYPES,
  EXPERIENCE_OVERRIDE_KINDS, EXPERIENCE_PROFILE_STATUSES, EXPERIENCE_PROFILE_STATUS_LABELS,
  HUD_CUES, VFX_CUES, canTransitionExperienceStatus, type ExperienceProfileStatus,
} from "@/lib/experiences/constants";
import { blankExperienceDefinition, EXPERIENCE_PRESETS } from "@/lib/experiences/presets";
import {
  createExperienceProfileSchema, type ExperienceAssetAssociation, type ExperienceDefinitionV1,
  type ExperienceEventBinding, type ExperienceWorldAssociation,
} from "@/lib/experiences/schemas";
import { ANIMATION_STATES, VISUAL_ARCHETYPES } from "@/lib/visuals/profile";
import { apiFetch, fieldErrorsFrom } from "@/lib/client/api";
import { zodFieldErrors } from "@/lib/client/form";
import { slugify } from "@/lib/utils";
import type { ExperienceProfileView } from "@/server/services/experience-profile-service";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import type { ExperienceFormInitial } from "./experience-form-model";

interface AssetChoice { id: string; name: string; type: string; currentVersion: number }
interface EntityChoice { id: string; name: string; category: string }
interface WorldChoice { worldId: string; worldName: string; version: number; zones: { identifier: string; name: string; type: string }[] }
interface Props { mode: "create" | "edit"; initial?: ExperienceFormInitial; assets: AssetChoice[]; entities: EntityChoice[]; worlds: WorldChoice[] }

const pretty = (value: string) => value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
const csv = (value: string) => value.split(",").map((part) => part.trim()).filter(Boolean);
const CONDITION_FIELDS = ["payload.amount", "payload.finalDamage", "payload.critical", "payload.dodged", "payload.guarded", "payload.health", "payload.healthAfter", "payload.eliminationRank", "payload.survivors", "payload.completionReason", "payload.winnerRunParticipantId"] as const;

function defaultBinding(index: number): ExperienceEventBinding {
  return {
    identifier: `binding_${index + 1}`, eventType: "battle.attack", priority: 0,
    animation: { actor: "ATTACK_PRIMARY" },
    camera: { mode: "TRACK_ACTION", priority: 0, durationMs: 800, blendDurationMs: 180, framingPreference: undefined, subject: "ACTOR", distanceClass: "MEDIUM", anglePreference: "AUTO", shakeIntensity: 0.2, worldCameraZonePreference: undefined },
    vfx: { cue: "NONE", assetIdentifier: undefined, surfaceResponseCategory: undefined },
    audio: { cue: "ATTACK", assetIdentifier: undefined }, hud: { cues: ["SHOW_HEALTH"], uiAssetIdentifier: undefined, messageTemplate: undefined },
    intensity: { camera: 0.5, vfx: 0.5, audio: 0.5, reaction: 0.5, slowMotion: 0 },
    timing: { preDelayMs: 0, holdMs: 200, postDelayMs: 120, transitionDurationMs: 180, playbackEmphasis: 0.5, slowMotionPreference: 0 },
  };
}

export function ExperienceForm({ mode, initial, assets, entities, worlds }: Props) {
  const router = useRouter(); const { toast } = useToast();
  const [name, setName] = useState(initial?.name ?? ""); const [description, setDescription] = useState(initial?.description ?? "");
  const [status, setStatus] = useState<Exclude<ExperienceProfileStatus, "ARCHIVED">>(initial?.status ?? "DRAFT");
  const [tags, setTags] = useState(initial?.tags.join(", ") ?? ""); const [thumbnailReference, setThumbnailReference] = useState(initial?.thumbnailReference ?? "");
  const [definition, setDefinition] = useState<ExperienceDefinitionV1>(() => structuredClone(initial?.definition ?? blankExperienceDefinition()));
  const [changeNote, setChangeNote] = useState(""); const [errors, setErrors] = useState<Record<string, string>>({}); const [submitting, setSubmitting] = useState(false);
  const editableStatuses = useMemo(() => EXPERIENCE_PROFILE_STATUSES.filter((candidate): candidate is Exclude<ExperienceProfileStatus, "ARCHIVED"> => candidate !== "ARCHIVED" && (mode === "create" || canTransitionExperienceStatus(initial?.status ?? "DRAFT", candidate))), [mode, initial]);

  function applyPreset(id: string) {
    const preset = EXPERIENCE_PRESETS.find((item) => item.id === id); if (!preset) return;
    if (!name.trim()) setName(preset.name); setDescription(preset.description); setTags(preset.tags.join(", ")); setDefinition(structuredClone(preset.definition));
  }
  function patchBinding(index: number, patch: Partial<ExperienceEventBinding>) { setDefinition((current) => ({ ...current, eventBindings: current.eventBindings.map((binding, i) => i === index ? { ...binding, ...patch } : binding) })); }
  function removeBinding(index: number) { setDefinition((current) => ({ ...current, eventBindings: current.eventBindings.filter((_, i) => i !== index) })); }
  function addBinding() { setDefinition((current) => ({ ...current, eventBindings: [...current.eventBindings, defaultBinding(current.eventBindings.length)] })); }
  function toggleHud(index: number, cue: (typeof HUD_CUES)[number]) {
    const binding = definition.eventBindings[index]!; const current = binding.hud?.cues ?? [];
    const cues = current.includes(cue) ? current.filter((item) => item !== cue) : [...current, cue];
    patchBinding(index, { hud: { cues, uiAssetIdentifier: binding.hud?.uiAssetIdentifier, messageTemplate: binding.hud?.messageTemplate } });
  }
  function toggleAsset(choice: AssetChoice) {
    const exists = definition.assetAssociations.some((item) => item.assetId === choice.id);
    if (exists) { setDefinition((current) => ({ ...current, assetAssociations: current.assetAssociations.filter((item) => item.assetId !== choice.id) })); return; }
    const role: ExperienceAssetAssociation["role"] = choice.type === "AUDIO" ? "AUDIO" : choice.type === "VFX" ? "VFX" : choice.type === "TEXTURE" ? "UI" : "GRAPHIC";
    let identifier = slugify(choice.name).replaceAll("-", "_") || "asset"; let suffix = 2;
    while (definition.assetAssociations.some((item) => item.identifier === identifier)) identifier = `${identifier}_${suffix++}`;
    setDefinition((current) => ({ ...current, assetAssociations: [...current.assetAssociations, { identifier, assetId: choice.id, assetVersion: choice.currentVersion, role }] }));
  }
  function patchAsset(identifier: string, patch: Partial<ExperienceAssetAssociation>) { setDefinition((current) => ({ ...current, assetAssociations: current.assetAssociations.map((item) => item.identifier === identifier ? { ...item, ...patch } : item) })); }
  function toggleWorld(choice: WorldChoice) {
    const exists = definition.worldAssociations.some((item) => item.worldId === choice.worldId && item.worldVersion === choice.version);
    setDefinition((current) => ({ ...current, worldAssociations: exists ? current.worldAssociations.filter((item) => item.worldId !== choice.worldId || item.worldVersion !== choice.version) : [...current.worldAssociations, { worldId: choice.worldId, worldVersion: choice.version, preferredCameraZone: undefined, resultZonePreference: undefined, vfxSurfaceResponseCategory: undefined, ambientIntensity: 0.5, lightingCue: undefined, weatherPresentationCue: undefined }] }));
  }
  function patchWorld(worldId: string, version: number, patch: Partial<ExperienceWorldAssociation>) { setDefinition((current) => ({ ...current, worldAssociations: current.worldAssociations.map((item) => item.worldId === worldId && item.worldVersion === version ? { ...item, ...patch } : item) })); }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const payload = { name, description, status, tags: csv(tags), thumbnailReference, definition, changeNote };
    const parsed = createExperienceProfileSchema.safeParse(payload); if (!parsed.success) { setErrors(zodFieldErrors(parsed.error)); return; }
    setErrors({}); setSubmitting(true); const result = await apiFetch<{ experience: ExperienceProfileView }>(mode === "create" ? "/api/experiences" : `/api/experiences/${initial?.id}`, { method: mode === "create" ? "POST" : "PATCH", body: JSON.stringify(parsed.data) }); setSubmitting(false);
    if (result.error) { setErrors(fieldErrorsFrom(result.error)); toast({ variant: "error", title: "Experience Profile could not be saved", description: result.error.message }); return; }
    toast({ variant: "success", title: mode === "create" ? "Experience Profile created" : "New Experience Profile version saved" }); router.push(`/experiences/${result.data?.experience.id}`); router.refresh();
  }

  return <form onSubmit={submit} className="space-y-6">
    <Card><CardHeader><CardTitle>1. Identity and direction</CardTitle><CardDescription>Profiles describe presentation only. Core events, ordering, state and results remain authoritative.</CardDescription></CardHeader><CardContent className="grid gap-4 md:grid-cols-2">
      <Field label="Original SIMVERSE preset"><Select defaultValue="" onChange={(event) => applyPreset(event.target.value)}><option value="">Custom / current definition</option>{EXPERIENCE_PRESETS.map((preset) => <option key={preset.id} value={preset.id}>{preset.name}</option>)}</Select></Field>
      <Field label="Name" required error={errors.name}><Input value={name} onChange={(event) => setName(event.target.value)} /></Field>
      <Field label="Status" error={errors.status}><Select value={status} onChange={(event) => setStatus(event.target.value as typeof status)}>{editableStatuses.map((item) => <option key={item} value={item}>{EXPERIENCE_PROFILE_STATUS_LABELS[item]}</option>)}</Select></Field>
      <Field label="Profile type"><Select value={definition.preset} onChange={(event) => setDefinition((current) => ({ ...current, preset: event.target.value as ExperienceDefinitionV1["preset"] }))}>{["CINEMATIC","COMPETITIVE","BROADCAST","MINIMAL","DRAMATIC","DOCUMENTARY","CUSTOM"].map((item) => <option key={item}>{pretty(item)}</option>)}</Select></Field>
      <Field label="Tags" hint="Comma-separated"><Input value={tags} onChange={(event) => setTags(event.target.value)} /></Field>
      <Field label="Thumbnail / preview reference" error={errors.thumbnailReference}><Input value={thumbnailReference} onChange={(event) => setThumbnailReference(event.target.value)} /></Field>
      <Field label="Compatible modules" hint="Lowercase keys, comma-separated"><Input value={definition.moduleCompatibility.join(", ")} onChange={(event) => setDefinition((current) => ({ ...current, moduleCompatibility: csv(event.target.value) }))} /></Field>
      <Field label="Compatible simulation modes" hint="Lowercase keys, comma-separated"><Input value={definition.simulationModeCompatibility.join(", ")} onChange={(event) => setDefinition((current) => ({ ...current, simulationModeCompatibility: csv(event.target.value) }))} /></Field>
      <Field className="md:col-span-2" label="Description"><Textarea value={description} onChange={(event) => setDescription(event.target.value)} /></Field>
      {mode === "edit" ? <Field className="md:col-span-2" label="Version note"><Input value={changeNote} onChange={(event) => setChangeNote(event.target.value)} /></Field> : null}
    </CardContent></Card>

    <Card><CardHeader><CardTitle>2. Structured event mappings</CardTitle><CardDescription>Map actual Battle v1 and Race v1 event types to semantic cues. Conditions inspect saved event payloads only.</CardDescription></CardHeader><CardContent className="space-y-4">
      {definition.eventBindings.map((binding, index) => <div key={`${binding.identifier}-${index}`} className="space-y-4 rounded-xl border border-border p-4">
        <div className="flex items-start justify-between gap-3"><div className="grid flex-1 gap-3 md:grid-cols-3"><Field label="Binding identifier"><Input value={binding.identifier} onChange={(event) => patchBinding(index, { identifier: event.target.value })} /></Field><Field label="Authoritative event"><Select value={binding.eventType} onChange={(event) => patchBinding(index, { eventType: event.target.value as ExperienceEventBinding["eventType"] })}>{EXPERIENCE_EVENT_TYPES.map((item) => <option key={item}>{item}</option>)}</Select></Field><Field label="Priority"><Input type="number" min="-1000" max="1000" value={binding.priority} onChange={(event) => patchBinding(index, { priority: Number(event.target.value) })} /></Field></div><Button type="button" variant="ghost" size="sm" aria-label="Remove binding" onClick={() => removeBinding(index)} disabled={definition.eventBindings.length === 1}><Trash2 className="size-4" /></Button></div>
        <div className="grid gap-3 md:grid-cols-4"><Field label="Actor animation"><Select value={binding.animation?.actor ?? ""} onChange={(event) => patchBinding(index, { animation: { ...binding.animation, actor: event.target.value ? event.target.value as (typeof ANIMATION_STATES)[number] : undefined } })}><option value="">None</option>{ANIMATION_STATES.map((item) => <option key={item}>{item}</option>)}</Select></Field>
          <Field label="Target animation"><Select value={binding.animation?.target ?? ""} onChange={(event) => patchBinding(index, { animation: { ...binding.animation, target: event.target.value ? event.target.value as (typeof ANIMATION_STATES)[number] : undefined } })}><option value="">None</option>{ANIMATION_STATES.map((item) => <option key={item}>{item}</option>)}</Select></Field>
          <Field label="Camera"><Select value={binding.camera?.mode ?? ""} onChange={(event) => patchBinding(index, { camera: event.target.value ? { ...(binding.camera ?? defaultBinding(0).camera!), mode: event.target.value as NonNullable<ExperienceEventBinding["camera"]>["mode"] } : undefined })}><option value="">None</option>{CAMERA_CUES.map((item) => <option key={item}>{item}</option>)}</Select></Field>
          <Field label="VFX"><Select value={binding.vfx?.cue ?? ""} onChange={(event) => patchBinding(index, { vfx: event.target.value ? { cue: event.target.value as NonNullable<ExperienceEventBinding["vfx"]>["cue"], assetIdentifier: binding.vfx?.assetIdentifier, surfaceResponseCategory: binding.vfx?.surfaceResponseCategory } : undefined })}><option value="">None</option>{VFX_CUES.map((item) => <option key={item}>{item}</option>)}</Select></Field>
          <Field label="Audio"><Select value={binding.audio?.cue ?? ""} onChange={(event) => patchBinding(index, { audio: event.target.value ? { cue: event.target.value as NonNullable<ExperienceEventBinding["audio"]>["cue"], assetIdentifier: binding.audio?.assetIdentifier } : undefined })}><option value="">None</option>{AUDIO_CUES.map((item) => <option key={item}>{item}</option>)}</Select></Field>
          <Field label="Intensity (0–1)"><Input type="number" min="0" max="1" step="0.05" value={binding.intensity.vfx} onChange={(event) => { const value = Number(event.target.value); patchBinding(index, { intensity: { camera: value, vfx: value, audio: value, reaction: value, slowMotion: binding.intensity.slowMotion } }); }} /></Field>
          <Field label="Hold (ms)"><Input type="number" min="0" max="60000" value={binding.timing.holdMs} onChange={(event) => patchBinding(index, { timing: { ...binding.timing, holdMs: Number(event.target.value) } })} /></Field>
          <Field label="Transition (ms)"><Input type="number" min="0" max="60000" value={binding.timing.transitionDurationMs} onChange={(event) => patchBinding(index, { timing: { ...binding.timing, transitionDurationMs: Number(event.target.value) } })} /></Field>
        </div>
        <div><p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">HUD cues</p><div className="flex flex-wrap gap-3">{HUD_CUES.map((cue) => <label key={cue} className="flex items-center gap-2 text-xs"><Checkbox checked={binding.hud?.cues.includes(cue) ?? false} onChange={() => toggleHud(index, cue)} />{pretty(cue)}</label>)}</div></div>
        <details><summary className="cursor-pointer text-sm font-medium">Condition, override and cue Assets</summary><div className="mt-3 grid gap-3 md:grid-cols-3">
          <Field label="Condition field"><Select value={binding.condition?.field ?? ""} onChange={(event) => patchBinding(index, { condition: event.target.value ? { field: event.target.value as typeof CONDITION_FIELDS[number], operator: "GTE", value: 0 } : undefined })}><option value="">Always</option>{CONDITION_FIELDS.map((item) => <option key={item}>{item}</option>)}</Select></Field>
          {binding.condition ? <><Field label="Operator"><Select value={binding.condition.operator} onChange={(event) => patchBinding(index, { condition: { ...binding.condition!, operator: event.target.value as NonNullable<ExperienceEventBinding["condition"]>["operator"], value: event.target.value === "PRESENT" ? undefined : binding.condition?.value ?? 0 } })}>{["EQ","NE","GT","GTE","LT","LTE","PRESENT"].map((item) => <option key={item}>{item}</option>)}</Select></Field>{binding.condition.operator !== "PRESENT" ? <Field label="Value"><Input value={String(binding.condition.value ?? "")} onChange={(event) => { const raw = event.target.value; const value = raw === "true" ? true : raw === "false" ? false : raw !== "" && Number.isFinite(Number(raw)) ? Number(raw) : raw; patchBinding(index, { condition: { ...binding.condition!, value } }); }} /></Field> : null}</> : null}
          <Field label="Override kind"><Select value={binding.override?.kind ?? ""} onChange={(event) => patchBinding(index, { override: event.target.value ? { kind: event.target.value as NonNullable<ExperienceEventBinding["override"]>["kind"], value: event.target.value === "ARCHETYPE" ? "CUSTOM" : "" } : undefined })}><option value="">All participants</option>{EXPERIENCE_OVERRIDE_KINDS.map((item) => <option key={item}>{item}</option>)}</Select></Field>
          {binding.override?.kind === "ENTITY" ? <Field label="Entity"><Select value={binding.override.value} onChange={(event) => patchBinding(index, { override: { kind: "ENTITY", value: event.target.value } })}><option value="">Choose Entity</option>{entities.map((entity) => <option key={entity.id} value={entity.id}>{entity.name} · {entity.category}</option>)}</Select></Field> : null}
          {binding.override?.kind === "ARCHETYPE" ? <Field label="Archetype"><Select value={binding.override.value} onChange={(event) => patchBinding(index, { override: { kind: "ARCHETYPE", value: event.target.value } })}>{VISUAL_ARCHETYPES.map((item) => <option key={item}>{item}</option>)}</Select></Field> : null}
          {binding.override?.kind === "CATEGORY" ? <Field label="Entity category"><Input value={binding.override.value} onChange={(event) => patchBinding(index, { override: { kind: "CATEGORY", value: event.target.value } })} /></Field> : null}
          {binding.vfx ? <Field label="VFX Asset"><Select value={binding.vfx.assetIdentifier ?? ""} onChange={(event) => patchBinding(index, { vfx: { ...binding.vfx!, assetIdentifier: event.target.value || undefined } })}><option value="">Runtime semantic only</option>{definition.assetAssociations.filter((item) => item.role === "VFX").map((item) => <option key={item.identifier}>{item.identifier}</option>)}</Select></Field> : null}
          {binding.audio ? <Field label="Audio Asset"><Select value={binding.audio.assetIdentifier ?? ""} onChange={(event) => patchBinding(index, { audio: { ...binding.audio!, assetIdentifier: event.target.value || undefined } })}><option value="">Runtime semantic only</option>{definition.assetAssociations.filter((item) => item.role === "AUDIO").map((item) => <option key={item.identifier}>{item.identifier}</option>)}</Select></Field> : null}
        </div></details>
      </div>)}
      <Button type="button" variant="secondary" onClick={addBinding}><Plus className="size-4" />Add event binding</Button>
    </CardContent></Card>

    <Card><CardHeader><CardTitle>3. Asset Library cues</CardTitle><CardDescription>References pin metadata versions. Audio and VFX binaries stay outside the database.</CardDescription></CardHeader><CardContent className="grid gap-3 md:grid-cols-2">{assets.map((asset) => { const association = definition.assetAssociations.find((item) => item.assetId === asset.id); return <div key={asset.id} className="rounded-lg border border-border p-3"><label className="flex items-center gap-2 text-sm font-medium"><Checkbox checked={Boolean(association)} onChange={() => toggleAsset(asset)} />{asset.name}<span className="text-muted">{asset.type} · v{asset.currentVersion}</span></label>{association ? <div className="mt-3 grid gap-2 sm:grid-cols-2"><Field label="Identifier"><Input value={association.identifier} onChange={(event) => patchAsset(association.identifier, { identifier: event.target.value })} /></Field><Field label="Role"><Select value={association.role} onChange={(event) => patchAsset(association.identifier, { role: event.target.value as ExperienceAssetAssociation["role"] })}>{EXPERIENCE_ASSET_ROLES.map((item) => <option key={item}>{item}</option>)}</Select></Field></div> : null}</div>; })}</CardContent></Card>

    <Card><CardHeader><CardTitle>4. World presentation interactions</CardTitle><CardDescription>Optional pinned World metadata for camera-zone, result-zone, ambience, lighting and weather preferences. The World Blueprint is never mutated.</CardDescription></CardHeader><CardContent className="space-y-3">{worlds.map((world) => { const association = definition.worldAssociations.find((item) => item.worldId === world.worldId && item.worldVersion === world.version); return <div key={`${world.worldId}:${world.version}`} className="rounded-lg border border-border p-3"><label className="flex items-center gap-2 text-sm font-medium"><Checkbox checked={Boolean(association)} onChange={() => toggleWorld(world)} />{world.worldName} · v{world.version}</label>{association ? <div className="mt-3 grid gap-3 md:grid-cols-3"><Field label="Preferred camera zone"><Select value={association.preferredCameraZone ?? ""} onChange={(event) => patchWorld(world.worldId, world.version, { preferredCameraZone: event.target.value || undefined })}><option value="">Runtime choice</option>{world.zones.map((zone) => <option key={zone.identifier} value={zone.identifier}>{zone.name} · {zone.type}</option>)}</Select></Field><Field label="Result zone"><Select value={association.resultZonePreference ?? ""} onChange={(event) => patchWorld(world.worldId, world.version, { resultZonePreference: event.target.value || undefined })}><option value="">Runtime choice</option>{world.zones.map((zone) => <option key={zone.identifier} value={zone.identifier}>{zone.name} · {zone.type}</option>)}</Select></Field><Field label="Ambient intensity"><Input type="number" min="0" max="1" step="0.05" value={association.ambientIntensity} onChange={(event) => patchWorld(world.worldId, world.version, { ambientIntensity: Number(event.target.value) })} /></Field><Field label="Surface response"><Input value={association.vfxSurfaceResponseCategory ?? ""} onChange={(event) => patchWorld(world.worldId, world.version, { vfxSurfaceResponseCategory: event.target.value || undefined })} /></Field><Field label="Lighting cue"><Input value={association.lightingCue ?? ""} onChange={(event) => patchWorld(world.worldId, world.version, { lightingCue: event.target.value || undefined })} /></Field><Field label="Weather cue"><Input value={association.weatherPresentationCue ?? ""} onChange={(event) => patchWorld(world.worldId, world.version, { weatherPresentationCue: event.target.value || undefined })} /></Field></div> : null}</div>; })}</CardContent></Card>

    {errors.definition ? <p className="text-sm text-danger">{errors.definition}</p> : null}
    <div className="flex justify-end"><Button type="submit" loading={submitting}><Save className="size-4" />{mode === "create" ? "Create Experience Profile" : "Save immutable version"}</Button></div>
  </form>;
}
