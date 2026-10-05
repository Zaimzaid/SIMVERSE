"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import {
  WORLD_ASSET_ROLES, WORLD_BIOMES, WORLD_BIOME_LABELS, WORLD_STATUSES,
  WORLD_STATUS_LABELS, canTransitionWorldStatus, type WorldStatus,
} from "@/lib/worlds/constants";
import { blankWorldBlueprint, WORLD_PRESETS } from "@/lib/worlds/presets";
import { createWorldSchema, type WorldAssetAssociation, type WorldBlueprintV1, type WorldEntityAssociation } from "@/lib/worlds/schemas";
import { apiFetch, fieldErrorsFrom } from "@/lib/client/api";
import { zodFieldErrors } from "@/lib/client/form";
import { slugify } from "@/lib/utils";
import { Button } from "@/components/ui/button"; import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox"; import { Field } from "@/components/ui/field"; import { Input } from "@/components/ui/input"; import { Select } from "@/components/ui/select"; import { Textarea } from "@/components/ui/textarea"; import { useToast } from "@/components/ui/toast";
import type { WorldView } from "@/server/services/world-service";
import type { WorldFormInitial } from "./world-form-model";

interface Choice { id: string; name: string; detail: string; currentVersion?: number; type?: string }
interface Props { mode: "create" | "edit"; initial?: WorldFormInitial; assets: Choice[]; entities: Choice[] }
type JsonSection = "weather" | "ecology" | "water" | "zones" | "spawnSets" | "camera" | "audio" | "presentation";
const json = (value: unknown) => JSON.stringify(value, null, 2);
const pretty = (value: string) => value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

function defaultRole(type?: string): WorldAssetAssociation["role"] {
  if (type === "AUDIO") return "AUDIO_AMBIENT";
  if (type === "VFX") return "VFX";
  if (type === "TEXTURE") return "TEXTURE";
  if (type === "MATERIAL") return "MATERIAL";
  if (type === "ENVIRONMENT") return "ENVIRONMENT";
  return "PROP";
}

export function WorldForm({ mode, initial, assets, entities }: Props) {
  const router = useRouter(); const { toast } = useToast();
  const source = initial?.blueprint ?? blankWorldBlueprint();
  const [name, setName] = useState(initial?.name ?? ""); const [description, setDescription] = useState(initial?.description ?? "");
  const [category, setCategory] = useState(initial?.category ?? "natural-environment");
  const [status, setStatus] = useState<Exclude<WorldStatus, "ARCHIVED">>(initial?.status ?? "DRAFT");
  const [tags, setTags] = useState(initial?.tags.join(", ") ?? ""); const [biome, setBiome] = useState(initial?.biome ?? "GRASSLAND");
  const [customBiome, setCustomBiome] = useState(initial?.customBiome ?? ""); const [thumbnailReference, setThumbnailReference] = useState(initial?.thumbnailReference ?? "");
  const [visibility, setVisibility] = useState(initial?.visibility ?? "WORKSPACE"); const [blueprint, setBlueprint] = useState(source);
  const [advanced, setAdvanced] = useState<Record<JsonSection, string>>({
    weather: json(source.weather), ecology: json(source.ecology), water: json(source.water), zones: json(source.zones),
    spawnSets: json(source.spawnSets), camera: json(source.camera), audio: json(source.audio), presentation: json(source.presentation),
  });
  const [assetAssociations, setAssetAssociations] = useState<WorldAssetAssociation[]>(initial?.assetAssociations ?? []);
  const [entityAssociations, setEntityAssociations] = useState<WorldEntityAssociation[]>(initial?.entityAssociations ?? []);
  const [compatibleCategories, setCompatibleCategories] = useState(source.compatibleEntityCategories.join(", "));
  const [changeNote, setChangeNote] = useState(""); const [errors, setErrors] = useState<Record<string, string>>({}); const [submitting, setSubmitting] = useState(false);
  const editableStatuses = useMemo(() => WORLD_STATUSES.filter((candidate): candidate is Exclude<WorldStatus, "ARCHIVED"> => candidate !== "ARCHIVED" && (mode === "create" || canTransitionWorldStatus(initial?.status ?? "DRAFT", candidate))), [mode, initial]);

  function csv(value: string) { return value.split(",").map((part) => part.trim()).filter(Boolean); }
  function applyBlueprint(next: WorldBlueprintV1) {
    setBlueprint(next); setCompatibleCategories(next.compatibleEntityCategories.join(", "));
    setAdvanced({ weather: json(next.weather), ecology: json(next.ecology), water: json(next.water), zones: json(next.zones), spawnSets: json(next.spawnSets), camera: json(next.camera), audio: json(next.audio), presentation: json(next.presentation) });
  }
  function applyPreset(id: string) {
    const preset = WORLD_PRESETS.find((item) => item.id === id); if (!preset) return;
    if (!name.trim()) setName(preset.name); setDescription(preset.description); setCategory(preset.category); setBiome(preset.biome); setTags(preset.tags.join(", ")); applyBlueprint(structuredClone(preset.blueprint));
  }
  function setTerrain(patch: Partial<WorldBlueprintV1["terrain"]>) { setBlueprint((current) => ({ ...current, terrain: { ...current.terrain, ...patch } })); }
  function setClimate(patch: Partial<WorldBlueprintV1["climate"]>) { setBlueprint((current) => ({ ...current, climate: { ...current.climate, ...patch } })); }
  function setTime(patch: Partial<WorldBlueprintV1["time"]>) { setBlueprint((current) => ({ ...current, time: { ...current.time, ...patch } })); }
  function toggleAsset(choice: Choice) {
    const existing = assetAssociations.find((item) => item.assetId === choice.id);
    if (existing) { setAssetAssociations((items) => items.filter((item) => item !== existing)); return; }
    const base = slugify(choice.name).replaceAll("-", "_") || "asset"; let identifier = base; let suffix = 2;
    while (assetAssociations.some((item) => item.identifier === identifier)) identifier = `${base}_${suffix++}`;
    setAssetAssociations((items) => [...items, { identifier, assetId: choice.id, assetVersion: choice.currentVersion ?? 1,
      role: defaultRole(choice.type), placement: { position: { x: 0, y: 0, z: 0 }, rotationDegrees: { pitch: 0, yaw: 0, roll: 0 }, scale: { x: 1, y: 1, z: 1 } },
      placementGroup: undefined, category: undefined, configuration: {} }]);
  }
  function updateAsset(identifier: string, patch: Partial<WorldAssetAssociation>) { setAssetAssociations((items) => items.map((item) => item.identifier === identifier ? { ...item, ...patch } : item)); }
  function toggleEntity(choice: Choice) { const exists = entityAssociations.some((item) => item.entityId === choice.id); setEntityAssociations((items) => exists ? items.filter((item) => item.entityId !== choice.id) : [...items, { entityId: choice.id, relationship: "NATIVE_INHABITANT", configuration: {} }]); }

  async function submit(event: React.FormEvent) {
    event.preventDefault(); const parsedSections: Partial<Record<JsonSection, unknown>> = {};
    try { (Object.keys(advanced) as JsonSection[]).forEach((key) => { parsedSections[key] = JSON.parse(advanced[key]); }); }
    catch { setErrors({ advanced: "Every structured JSON section must contain valid JSON." }); return; }
    const finalBlueprint = { ...blueprint, weather: parsedSections.weather, ecology: parsedSections.ecology, water: parsedSections.water,
      zones: parsedSections.zones, spawnSets: parsedSections.spawnSets, camera: parsedSections.camera, audio: parsedSections.audio,
      presentation: parsedSections.presentation, compatibleEntityCategories: csv(compatibleCategories) };
    const payload = { name, description, category, status, tags: csv(tags), biome, customBiome, thumbnailReference, visibility,
      blueprint: finalBlueprint, assetAssociations, entityAssociations, changeNote };
    const parsed = createWorldSchema.safeParse(payload); if (!parsed.success) { setErrors(zodFieldErrors(parsed.error)); return; }
    setErrors({}); setSubmitting(true); const result = await apiFetch<{ world: WorldView }>(mode === "create" ? "/api/worlds" : `/api/worlds/${initial?.id}`, { method: mode === "create" ? "POST" : "PATCH", body: JSON.stringify(parsed.data) }); setSubmitting(false);
    if (result.error) { setErrors(fieldErrorsFrom(result.error)); toast({ variant: "error", title: "World could not be saved", description: result.error.message }); return; }
    toast({ variant: "success", title: mode === "create" ? "World created" : "New World version saved" }); router.push(`/worlds/${result.data?.world.id}`); router.refresh();
  }

  const n = (value: string) => Number(value);
  return <form onSubmit={submit} className="space-y-6">
    <Card><CardHeader><CardTitle>1. Identity and preset</CardTitle><CardDescription>Create an engine-neutral definition or start from an original SIMVERSE preset.</CardDescription></CardHeader><CardContent className="grid gap-4 md:grid-cols-2">
      <Field label="Preset" htmlFor="world-preset"><Select id="world-preset" defaultValue="" onChange={(event) => applyPreset(event.target.value)}><option value="">Blank blueprint</option>{WORLD_PRESETS.map((preset) => <option key={preset.id} value={preset.id}>{preset.name}</option>)}</Select></Field>
      <Field label="Name" required error={errors.name}><Input value={name} onChange={(event) => setName(event.target.value)} /></Field>
      <Field label="Category" required error={errors.category}><Input value={category} onChange={(event) => setCategory(event.target.value)} placeholder="natural-environment" /></Field>
      <Field label="Status" error={errors.status}><Select value={status} onChange={(event) => setStatus(event.target.value as typeof status)}>{editableStatuses.map((item) => <option key={item} value={item}>{WORLD_STATUS_LABELS[item]}</option>)}</Select></Field>
      <Field label="Visibility"><Select value={visibility} onChange={(event) => setVisibility(event.target.value as typeof visibility)}><option value="WORKSPACE">Workspace</option><option value="PRIVATE">Private</option></Select></Field>
      <Field label="Tags" hint="Comma-separated"><Input value={tags} onChange={(event) => setTags(event.target.value)} /></Field>
      <Field label="Thumbnail / preview reference" error={errors.thumbnailReference}><Input value={thumbnailReference} onChange={(event) => setThumbnailReference(event.target.value)} placeholder="/assets/… or https://…" /></Field>
      <Field className="md:col-span-2" label="Description"><Textarea value={description} onChange={(event) => setDescription(event.target.value)} /></Field>
      {mode === "edit" ? <Field className="md:col-span-2" label="Version note"><Input value={changeNote} onChange={(event) => setChangeNote(event.target.value)} /></Field> : null}
    </CardContent></Card>
    <Card><CardHeader><CardTitle>2. Biome and terrain</CardTitle><CardDescription>Coordinates are centered on the World origin. No terrain mesh is generated.</CardDescription></CardHeader><CardContent className="grid gap-4 md:grid-cols-3">
      <Field label="Biome"><Select value={biome} onChange={(event) => setBiome(event.target.value as typeof biome)}>{WORLD_BIOMES.map((item) => <option key={item} value={item}>{WORLD_BIOME_LABELS[item]}</option>)}</Select></Field>
      {biome === "CUSTOM" ? <Field label="Custom biome" error={errors.customBiome}><Input value={customBiome} onChange={(event) => setCustomBiome(event.target.value)} /></Field> : null}
      <Field label="Terrain type"><Select value={blueprint.terrain.type} onChange={(event) => setTerrain({ type: event.target.value as WorldBlueprintV1["terrain"]["type"] })}>{["FLAT","ROLLING","HILLY","MOUNTAINOUS","VALLEY","PLATEAU","DUNES","COASTAL","CUSTOM"].map((item) => <option key={item}>{pretty(item)}</option>)}</Select></Field>
      <Field label="Width"><Input type="number" min="0.01" value={blueprint.terrain.dimensions.width} onChange={(event) => setTerrain({ dimensions: { ...blueprint.terrain.dimensions, width: n(event.target.value) } })} /></Field>
      <Field label="Length"><Input type="number" min="0.01" value={blueprint.terrain.dimensions.length} onChange={(event) => setTerrain({ dimensions: { ...blueprint.terrain.dimensions, length: n(event.target.value) } })} /></Field>
      <Field label="Height"><Input type="number" min="0.01" value={blueprint.terrain.dimensions.height} onChange={(event) => setTerrain({ dimensions: { ...blueprint.terrain.dimensions, height: n(event.target.value) } })} /></Field>
      <Field label="Dimension unit"><Select value={blueprint.terrain.dimensions.unit} onChange={(event) => setTerrain({ dimensions: { ...blueprint.terrain.dimensions, unit: event.target.value as "METER" | "KILOMETER" } })}><option value="METER">Meters</option><option value="KILOMETER">Kilometers</option></Select></Field>
      <Field label="Roughness (0–1)"><Input type="number" min="0" max="1" step="0.01" value={blueprint.terrain.roughness} onChange={(event) => setTerrain({ roughness: n(event.target.value) })} /></Field>
      <Field label="Traversability"><Select value={blueprint.terrain.traversability} onChange={(event) => setTerrain({ traversability: event.target.value as WorldBlueprintV1["terrain"]["traversability"] })}>{["OPEN","MIXED","DIFFICULT","RESTRICTED","CUSTOM"].map((item) => <option key={item}>{pretty(item)}</option>)}</Select></Field>
      <Field label="Minimum elevation (m)"><Input type="number" value={blueprint.terrain.elevation.minimumMeters} onChange={(event) => setTerrain({ elevation: { ...blueprint.terrain.elevation, minimumMeters: n(event.target.value) } })} /></Field>
      <Field label="Maximum elevation (m)"><Input type="number" value={blueprint.terrain.elevation.maximumMeters} onChange={(event) => setTerrain({ elevation: { ...blueprint.terrain.elevation, maximumMeters: n(event.target.value) } })} /></Field>
      <Field label="Maximum slope (degrees)"><Input type="number" min="0" max="90" value={blueprint.terrain.slope.maximumDegrees} onChange={(event) => setTerrain({ slope: { ...blueprint.terrain.slope, maximumDegrees: n(event.target.value) } })} /></Field>
      <Field className="md:col-span-3" label="Surface definitions (JSON)"><Textarea rows={4} value={json(blueprint.terrain.surfaceTypes)} onChange={(event) => { try { setTerrain({ surfaceTypes: JSON.parse(event.target.value) }); } catch { /* retain last valid structured value */ } }} /></Field>
    </CardContent></Card>
    <Card><CardHeader><CardTitle>3–5. Climate, weather and time</CardTitle><CardDescription>All units are explicit. Weather weights are relative and do not run a meteorological simulation.</CardDescription></CardHeader><CardContent className="grid gap-4 md:grid-cols-3">
      <Field label="Climate type"><Input value={blueprint.climate.type} onChange={(event) => setClimate({ type: event.target.value })} /></Field>
      <Field label="Minimum °C"><Input type="number" value={blueprint.climate.temperatureCelsius.minimum} onChange={(event) => setClimate({ temperatureCelsius: { ...blueprint.climate.temperatureCelsius, minimum: n(event.target.value) } })} /></Field>
      <Field label="Maximum °C"><Input type="number" value={blueprint.climate.temperatureCelsius.maximum} onChange={(event) => setClimate({ temperatureCelsius: { ...blueprint.climate.temperatureCelsius, maximum: n(event.target.value) } })} /></Field>
      <Field label="Humidity min %"><Input type="number" min="0" max="100" value={blueprint.climate.humidityPercent.minimum} onChange={(event) => setClimate({ humidityPercent: { ...blueprint.climate.humidityPercent, minimum: n(event.target.value) } })} /></Field>
      <Field label="Humidity max %"><Input type="number" min="0" max="100" value={blueprint.climate.humidityPercent.maximum} onChange={(event) => setClimate({ humidityPercent: { ...blueprint.climate.humidityPercent, maximum: n(event.target.value) } })} /></Field>
      <Field label="Annual rainfall (mm)"><Input type="number" min="0" value={blueprint.climate.annualRainfallMillimeters} onChange={(event) => setClimate({ annualRainfallMillimeters: n(event.target.value) })} /></Field>
      <Field label="Time mode"><Select value={blueprint.time.mode} onChange={(event) => setTime({ mode: event.target.value as "STATIC" | "DYNAMIC" })}><option>STATIC</option><option>DYNAMIC</option></Select></Field>
      <Field label="Initial time"><Input type="time" value={blueprint.time.initialTime} onChange={(event) => setTime({ initialTime: event.target.value })} /></Field>
      <Field label="Time scale"><Input type="number" min="0.001" step="any" value={blueprint.time.timeScale} onChange={(event) => setTime({ timeScale: n(event.target.value) })} /></Field>
      <Field label="Sunrise"><Input type="time" value={blueprint.time.sunrise} onChange={(event) => setTime({ sunrise: event.target.value })} /></Field>
      <Field label="Sunset"><Input type="time" value={blueprint.time.sunset} onChange={(event) => setTime({ sunset: event.target.value })} /></Field>
      <Field label="Season"><Input value={blueprint.time.season ?? ""} onChange={(event) => setTime({ season: event.target.value || undefined })} /></Field>
      <JsonEditor className="md:col-span-3" label="Weather presets" value={advanced.weather} onChange={(value) => setAdvanced((current) => ({ ...current, weather: value }))} />
    </CardContent></Card>
    <Card><CardHeader><CardTitle>6–7. Ecology and Asset placements</CardTitle><CardDescription>Worlds reference pinned Asset versions. Binaries remain in external storage.</CardDescription></CardHeader><CardContent className="space-y-5">
      <JsonEditor label="Vegetation and ecology" value={advanced.ecology} onChange={(value) => setAdvanced((current) => ({ ...current, ecology: value }))} />
      <div className="grid gap-3 md:grid-cols-2">{assets.map((asset) => { const association = assetAssociations.find((item) => item.assetId === asset.id); return <div key={asset.id} className="rounded-lg border border-border p-3"><label className="flex items-center gap-2 text-sm font-medium"><Checkbox checked={Boolean(association)} onChange={() => toggleAsset(asset)} />{asset.name}<span className="text-muted">{asset.detail}</span></label>{association ? <div className="mt-3 grid gap-2 sm:grid-cols-2"><Field label="Identifier"><Input value={association.identifier} onChange={(event) => updateAsset(association.identifier, { identifier: event.target.value })} /></Field><Field label="Role"><Select value={association.role} onChange={(event) => updateAsset(association.identifier, { role: event.target.value as WorldAssetAssociation["role"] })}>{WORLD_ASSET_ROLES.map((role) => <option key={role}>{pretty(role)}</option>)}</Select></Field>{(["x","y","z"] as const).map((axis) => <Field key={axis} label={`Position ${axis.toUpperCase()} (m)`}><Input type="number" value={association.placement?.position[axis] ?? 0} onChange={(event) => updateAsset(association.identifier, { placement: { position: { ...(association.placement?.position ?? { x: 0, y: 0, z: 0 }), [axis]: n(event.target.value) }, rotationDegrees: association.placement?.rotationDegrees ?? { pitch: 0, yaw: 0, roll: 0 }, scale: association.placement?.scale ?? { x: 1, y: 1, z: 1 } } })} /></Field>)}</div> : null}</div>; })}</div>
    </CardContent></Card>
    <Card><CardHeader><CardTitle>8–9. Zones and spawn sets</CardTitle><CardDescription>Identifiers, bounds, participant restrictions and coordinates are validated before saving.</CardDescription></CardHeader><CardContent className="grid gap-4 lg:grid-cols-2"><JsonEditor label="Zones" value={advanced.zones} onChange={(value) => setAdvanced((current) => ({ ...current, zones: value }))} /><JsonEditor label="Spawn sets" value={advanced.spawnSets} onChange={(value) => setAdvanced((current) => ({ ...current, spawnSets: value }))} /><JsonEditor label="Water definitions" value={advanced.water} onChange={(value) => setAdvanced((current) => ({ ...current, water: value }))} /><Field label="Compatible Entity categories" hint="Comma-separated"><Input value={compatibleCategories} onChange={(event) => setCompatibleCategories(event.target.value)} /></Field></CardContent></Card>
    <Card><CardHeader><CardTitle>Entity associations</CardTitle><CardDescription>Native and default occupants are descriptive. They are never spawned automatically.</CardDescription></CardHeader><CardContent className="grid gap-3 md:grid-cols-2">{entities.map((entity) => { const association = entityAssociations.find((item) => item.entityId === entity.id); return <div key={entity.id} className="rounded-lg border border-border p-3"><label className="flex items-center gap-2 text-sm"><Checkbox checked={Boolean(association)} onChange={() => toggleEntity(entity)} />{entity.name}<span className="text-muted">{entity.detail}</span></label>{association ? <Select className="mt-2" value={association.relationship} onChange={(event) => setEntityAssociations((items) => items.map((item) => item.entityId === entity.id ? { ...item, relationship: event.target.value as WorldEntityAssociation["relationship"] } : item))}><option value="NATIVE_INHABITANT">Native inhabitant</option><option value="DEFAULT_OCCUPANT">Default occupant</option></Select> : null}</div>; })}</CardContent></Card>
    <Card><CardHeader><CardTitle>10–12. Camera, audio and presentation</CardTitle><CardDescription>These are downstream presentation hints. They do not decide simulation truth.</CardDescription></CardHeader><CardContent className="grid gap-4 lg:grid-cols-2"><JsonEditor label="Camera blueprint" value={advanced.camera} onChange={(value) => setAdvanced((current) => ({ ...current, camera: value }))} /><JsonEditor label="Audio blueprint" value={advanced.audio} onChange={(value) => setAdvanced((current) => ({ ...current, audio: value }))} /><JsonEditor label="World presentation policies" value={advanced.presentation} onChange={(value) => setAdvanced((current) => ({ ...current, presentation: value }))} /></CardContent></Card>
    {errors.advanced || errors.root ? <p role="alert" className="text-sm text-danger">{errors.advanced ?? errors.root}</p> : null}
    <Button type="submit" loading={submitting}><Save className="size-4" />{mode === "create" ? "Create World" : "Save new version"}</Button>
  </form>;
}

function JsonEditor({ label, value, onChange, className }: { label: string; value: string; onChange(value: string): void; className?: string }) {
  return <Field label={`${label} (structured JSON)`} className={className}><Textarea rows={10} value={value} onChange={(event) => onChange(event.target.value)} className="font-mono text-xs" /></Field>;
}
