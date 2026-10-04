"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { ANIMATION_STATES } from "@/lib/visuals/profile";
import { ASSET_STATUSES, ASSET_STATUS_LABELS, ASSET_TYPES, ASSET_TYPE_LABELS,
  PRODUCTION_CHECKLIST_KEYS, canTransitionAssetStatus, type AssetStatus, type AssetType } from "@/lib/assets/constants";
import { createAssetSchema } from "@/lib/assets/schemas";
import { apiFetch, fieldErrorsFrom } from "@/lib/client/api";
import { zodFieldErrors } from "@/lib/client/form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/toast";
import type { AssetFormInitial } from "./asset-form-model";

interface Choice { id: string; name: string; detail?: string }
interface Props { mode: "create" | "edit"; initial?: AssetFormInitial; entities: Choice[]; assets: Choice[] }
const pretty = (key: string) => key.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
const editableStatuses = ASSET_STATUSES.filter((status): status is Exclude<AssetStatus, "ARCHIVED"> => status !== "ARCHIVED");

export function AssetForm({ mode, initial, entities, assets }: Props) {
  const router = useRouter(); const { toast } = useToast();
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [type, setType] = useState<AssetType>(initial?.type ?? "OTHER");
  const [status, setStatus] = useState<Exclude<AssetStatus, "ARCHIVED">>(initial?.status ?? "DRAFT");
  const [tags, setTags] = useState(initial?.tags.join(", ") ?? "");
  const [provenanceKind, setProvenanceKind] = useState(initial?.provenance.kind ?? "ORIGINAL");
  const [sourceName, setSourceName] = useState(initial?.provenance.sourceName ?? "");
  const [sourceUrl, setSourceUrl] = useState(initial?.provenance.sourceUrl ?? "");
  const [sourceNotes, setSourceNotes] = useState(initial?.provenance.notes ?? "");
  const [licenseType, setLicenseType] = useState(initial?.licenseInfo?.type ?? "");
  const [licenseName, setLicenseName] = useState(initial?.licenseInfo?.name ?? "");
  const [licenseUrl, setLicenseUrl] = useState(initial?.licenseInfo?.url ?? "");
  const [attribution, setAttribution] = useState(initial?.licenseInfo?.attribution ?? "");
  const [restrictions, setRestrictions] = useState(initial?.licenseInfo?.usageRestrictions ?? "");
  const [authorName, setAuthorName] = useState(initial?.authorInfo?.name ?? "");
  const [authorOrg, setAuthorOrg] = useState(initial?.authorInfo?.organization ?? "");
  const [authorContact, setAuthorContact] = useState(initial?.authorInfo?.contact ?? "");
  const [externalReference, setExternalReference] = useState(initial?.externalReference ?? "");
  const [thumbnailReference, setThumbnailReference] = useState(initial?.thumbnailReference ?? "");
  const [technicalMetadata, setTechnicalMetadata] = useState(initial?.technicalMetadata ?? "{}");
  const [modelFormat, setModelFormat] = useState(initial?.modelSpecification?.format ?? "");
  const [triangleCount, setTriangleCount] = useState(initial?.modelSpecification?.triangleCount?.toString() ?? "");
  const [modelScale, setModelScale] = useState(initial?.modelSpecification?.scale?.toString() ?? "1");
  const [skeletonReference, setSkeletonReference] = useState(initial?.modelSpecification?.skeletonReference ?? "");
  const [materialSlots, setMaterialSlots] = useState(initial?.modelSpecification?.materialSlots.join(", ") ?? "");
  const [textureReferences, setTextureReferences] = useState(initial?.modelSpecification?.textureReferences.join("\n") ?? "");
  const [rigArchetype, setRigArchetype] = useState(initial?.rigSpecification?.archetype ?? "");
  const [skeletonName, setSkeletonName] = useState(initial?.rigSpecification?.skeletonName ?? "");
  const [skeletonVersion, setSkeletonVersion] = useState(initial?.rigSpecification?.skeletonVersion ?? "");
  const [boneCount, setBoneCount] = useState(initial?.rigSpecification?.boneCount?.toString() ?? "");
  const [rigCompatibility, setRigCompatibility] = useState(initial?.rigSpecification?.compatibility.join(", ") ?? "");
  const [semanticState, setSemanticState] = useState(initial?.animationSpecification?.semanticState ?? "IDLE");
  const [clipName, setClipName] = useState(initial?.animationSpecification?.clipName ?? "");
  const [duration, setDuration] = useState(initial?.animationSpecification?.durationSeconds?.toString() ?? "");
  const [looping, setLooping] = useState(initial?.animationSpecification?.looping ?? false);
  const [animationCompatibility, setAnimationCompatibility] = useState(initial?.animationSpecification?.skeletonCompatibility.join(", ") ?? "");
  const [checklist, setChecklist] = useState<Record<string, boolean>>(Object.fromEntries(PRODUCTION_CHECKLIST_KEYS.map((key) =>
    [key, initial?.productionChecklist.find((item) => item.key === key)?.completed ?? false])));
  const [entityIds, setEntityIds] = useState(initial?.entityIds ?? []);
  const [parentAssetIds, setParentAssetIds] = useState(initial?.parentAssetIds ?? []);
  const [changeNote, setChangeNote] = useState(""); const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const modelCapable = ["MODEL_3D", "ENVIRONMENT", "PROP", "CHARACTER", "CREATURE", "VEHICLE"].includes(type);
  const rigCapable = ["RIG", "MODEL_3D", "CHARACTER", "CREATURE", "VEHICLE"].includes(type);
  const statuses = useMemo(() => editableStatuses.filter((candidate) => mode === "create" || canTransitionAssetStatus(initial?.status ?? "DRAFT", candidate)), [mode, initial]);

  function csv(value: string) { return value.split(",").map((part) => part.trim()).filter(Boolean); }
  function toggle(list: string[], value: string, setter: (value: string[]) => void) {
    setter(list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setErrors({});
    let metadata: unknown;
    try { metadata = JSON.parse(technicalMetadata || "{}"); } catch { setErrors({ technicalMetadata: "Enter valid JSON." }); return; }
    const payload = {
      name, description, type, status, tags: csv(tags),
      provenance: { kind: provenanceKind, sourceName, sourceUrl, notes: sourceNotes },
      licenseInfo: licenseType ? { type: licenseType, name: licenseName, url: licenseUrl, attribution, usageRestrictions: restrictions } : undefined,
      authorInfo: authorName ? { name: authorName, organization: authorOrg, contact: authorContact } : undefined,
      externalReference, thumbnailReference, technicalMetadata: metadata,
      modelSpecification: modelCapable && modelFormat ? { format: modelFormat,
        triangleCount: triangleCount ? Number(triangleCount) : undefined, lods: [], scale: Number(modelScale || 1),
        skeletonReference, materialSlots: csv(materialSlots), textureReferences: textureReferences.split("\n").map((item) => item.trim()).filter(Boolean) } : undefined,
      rigSpecification: rigCapable && rigArchetype ? { archetype: rigArchetype, skeletonName, skeletonVersion,
        boneCount: Number(boneCount), compatibility: csv(rigCompatibility), metadata: {} } : undefined,
      animationSpecification: type === "ANIMATION" && clipName ? { semanticState, clipName,
        durationSeconds: Number(duration), looping, skeletonCompatibility: csv(animationCompatibility) } : undefined,
      productionChecklist: PRODUCTION_CHECKLIST_KEYS.map((key) => ({ key, completed: checklist[key] ?? false })),
      entityAssociations: entityIds.map((entityId) => ({ entityId, purpose: "PRIMARY" })),
      derivedFromAssetIds: parentAssetIds, changeNote,
    };
    const parsed = createAssetSchema.safeParse(payload);
    if (!parsed.success) { setErrors(zodFieldErrors(parsed.error)); return; }
    setSubmitting(true);
    const result = await apiFetch<{ asset: { id: string } }>(mode === "create" ? "/api/assets" : `/api/assets/${initial?.id}`,
      { method: mode === "create" ? "POST" : "PATCH", body: JSON.stringify(parsed.data) });
    setSubmitting(false);
    if (result.error) { setErrors(fieldErrorsFrom(result.error)); toast({ variant: "error", title: "Asset could not be saved", description: result.error.message }); return; }
    toast({ variant: "success", title: mode === "create" ? "Asset created" : "New Asset version saved" });
    router.push(`/assets/${result.data?.asset.id}`); router.refresh();
  }
  return <form onSubmit={submit} className="space-y-6">
    <Card><CardHeader><CardTitle>Asset identity</CardTitle><CardDescription>The stable library record and its production state.</CardDescription></CardHeader><CardContent className="grid gap-4 md:grid-cols-2">
      <Field label="Name" htmlFor="asset-name" required error={errors.name}><Input id="asset-name" value={name} onChange={(e) => setName(e.target.value)} /></Field>
      <Field label="Type" htmlFor="asset-type" required error={errors.type}><Select id="asset-type" value={type} onChange={(e) => setType(e.target.value as AssetType)}>{ASSET_TYPES.map((item) => <option key={item} value={item}>{ASSET_TYPE_LABELS[item]}</option>)}</Select></Field>
      <Field label="Production status" htmlFor="asset-status" required error={errors.status}><Select id="asset-status" value={status} onChange={(e) => setStatus(e.target.value as Exclude<AssetStatus, "ARCHIVED">)}>{statuses.map((item) => <option key={item} value={item}>{ASSET_STATUS_LABELS[item]}</option>)}</Select></Field>
      <Field label="Tags" htmlFor="asset-tags" hint="Comma-separated"><Input id="asset-tags" value={tags} onChange={(e) => setTags(e.target.value)} /></Field>
      <Field className="md:col-span-2" label="Description" htmlFor="asset-description" error={errors.description}><Textarea id="asset-description" value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
      {mode === "edit" ? <Field className="md:col-span-2" label="Version note" htmlFor="change-note"><Input id="change-note" value={changeNote} onChange={(e) => setChangeNote(e.target.value)} placeholder="What changed in this version?" /></Field> : null}
    </CardContent></Card>
    <Card><CardHeader><CardTitle>Provenance and license</CardTitle><CardDescription>Record where this work came from and how SIMVERSE may use it.</CardDescription></CardHeader><CardContent className="grid gap-4 md:grid-cols-2">
      <Field label="Source kind"><Select value={provenanceKind} onChange={(e) => setProvenanceKind(e.target.value as typeof provenanceKind)}>{["ORIGINAL","IMPORTED","GENERATED","LICENSED","DERIVED"].map((item) => <option key={item}>{item}</option>)}</Select></Field>
      <Field label="Source name" error={errors["provenance.sourceName"]}><Input value={sourceName} onChange={(e) => setSourceName(e.target.value)} /></Field>
      <Field label="Source URL" error={errors["provenance.sourceUrl"]}><Input value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="https://…" /></Field>
      <Field label="Author or creator"><Input value={authorName} onChange={(e) => setAuthorName(e.target.value)} /></Field>
      <Field label="Organization"><Input value={authorOrg} onChange={(e) => setAuthorOrg(e.target.value)} /></Field>
      <Field label="Creator contact"><Input value={authorContact} onChange={(e) => setAuthorContact(e.target.value)} /></Field>
      <Field className="md:col-span-2" label="Source notes"><Textarea value={sourceNotes} onChange={(e) => setSourceNotes(e.target.value)} /></Field>
      <Field label="License"><Select value={licenseType} onChange={(e) => setLicenseType(e.target.value)}><option value="">No license record</option>{["PROPRIETARY","CC0","CC_BY","CC_BY_SA","PURCHASED","CUSTOM","UNKNOWN"].map((item) => <option key={item}>{item}</option>)}</Select></Field>
      <Field label="License name" error={errors["licenseInfo.name"]}><Input value={licenseName} onChange={(e) => setLicenseName(e.target.value)} /></Field>
      <Field label="License URL"><Input value={licenseUrl} onChange={(e) => setLicenseUrl(e.target.value)} /></Field>
      <Field label="Attribution" error={errors["licenseInfo.attribution"]}><Input value={attribution} onChange={(e) => setAttribution(e.target.value)} /></Field>
      <Field className="md:col-span-2" label="Usage restrictions"><Textarea value={restrictions} onChange={(e) => setRestrictions(e.target.value)} /></Field>
    </CardContent></Card>
    <Card><CardHeader><CardTitle>Storage and technical specification</CardTitle><CardDescription>References identify externally stored binaries. SIMVERSE stores metadata only.</CardDescription></CardHeader><CardContent className="grid gap-4 md:grid-cols-2">
      <Field label="External storage reference" error={errors.externalReference}><Input value={externalReference} onChange={(e) => setExternalReference(e.target.value)} placeholder="/assets/… or https://…" /></Field>
      <Field label="Thumbnail or preview reference" error={errors.thumbnailReference}><Input value={thumbnailReference} onChange={(e) => setThumbnailReference(e.target.value)} /></Field>
      <Field className="md:col-span-2" label="Technical metadata (JSON)" error={errors.technicalMetadata}><Textarea rows={5} value={technicalMetadata} onChange={(e) => setTechnicalMetadata(e.target.value)} /></Field>
      {modelCapable ? <><Field label="Model format"><Input value={modelFormat} onChange={(e) => setModelFormat(e.target.value)} placeholder="GLB, GLTF, FBX…" /></Field><Field label="Triangle count"><Input type="number" min="0" value={triangleCount} onChange={(e) => setTriangleCount(e.target.value)} /></Field>
        <Field label="Scale"><Input type="number" min="0.0001" step="any" value={modelScale} onChange={(e) => setModelScale(e.target.value)} /></Field><Field label="Skeleton reference"><Input value={skeletonReference} onChange={(e) => setSkeletonReference(e.target.value)} /></Field>
        <Field label="Material slots"><Input value={materialSlots} onChange={(e) => setMaterialSlots(e.target.value)} placeholder="Body, Eyes, Fur" /></Field><Field label="Texture references" hint="One safe reference per line"><Textarea value={textureReferences} onChange={(e) => setTextureReferences(e.target.value)} /></Field></> : null}
      {rigCapable ? <><Field label="Rig archetype"><Input value={rigArchetype} onChange={(e) => setRigArchetype(e.target.value)} /></Field><Field label="Skeleton name"><Input value={skeletonName} onChange={(e) => setSkeletonName(e.target.value)} /></Field>
        <Field label="Skeleton version"><Input value={skeletonVersion} onChange={(e) => setSkeletonVersion(e.target.value)} /></Field><Field label="Bone count"><Input type="number" min="1" value={boneCount} onChange={(e) => setBoneCount(e.target.value)} /></Field><Field className="md:col-span-2" label="Skeleton compatibility"><Input value={rigCompatibility} onChange={(e) => setRigCompatibility(e.target.value)} placeholder="Comma-separated skeleton names" /></Field></> : null}
      {type === "ANIMATION" ? <><Field label="Semantic state"><Select value={semanticState} onChange={(e) => setSemanticState(e.target.value as typeof semanticState)}>{ANIMATION_STATES.map((item) => <option key={item}>{item}</option>)}</Select></Field><Field label="Clip name"><Input value={clipName} onChange={(e) => setClipName(e.target.value)} /></Field>
        <Field label="Duration (seconds)"><Input type="number" min="0.001" step="any" value={duration} onChange={(e) => setDuration(e.target.value)} /></Field><Field label="Skeleton compatibility"><Input value={animationCompatibility} onChange={(e) => setAnimationCompatibility(e.target.value)} /></Field><label className="flex items-center gap-2 text-sm"><Checkbox checked={looping} onChange={(e) => setLooping(e.target.checked)} />Looping clip</label></> : null}
    </CardContent></Card>
    <Card><CardHeader><CardTitle>Production checklist</CardTitle><CardDescription>Track content readiness independently from simulation truth.</CardDescription></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{PRODUCTION_CHECKLIST_KEYS.map((key) => <label key={key} className="flex items-center gap-2 rounded-lg border border-border p-3 text-sm"><Checkbox checked={checklist[key] ?? false} onChange={(e) => setChecklist((current) => ({ ...current, [key]: e.target.checked }))} />{pretty(key)}</label>)}</CardContent></Card>
    <Card><CardHeader><CardTitle>Relationships</CardTitle><CardDescription>Associate this version with workspace Entities and its parent assets.</CardDescription></CardHeader><CardContent className="grid gap-6 md:grid-cols-2"><div><p className="mb-2 text-sm font-medium">Entities</p><div className="max-h-56 space-y-2 overflow-y-auto">{entities.length ? entities.map((entity) => <label key={entity.id} className="flex items-center gap-2 text-sm"><Checkbox checked={entityIds.includes(entity.id)} onChange={() => toggle(entityIds, entity.id, setEntityIds)} />{entity.name}<span className="text-muted">{entity.detail}</span></label>) : <p className="text-sm text-muted">No Entities available.</p>}</div></div>
      <div><p className="mb-2 text-sm font-medium">Derived from</p><div className="max-h-56 space-y-2 overflow-y-auto">{assets.length ? assets.filter((asset) => asset.id !== initial?.id).map((asset) => <label key={asset.id} className="flex items-center gap-2 text-sm"><Checkbox checked={parentAssetIds.includes(asset.id)} onChange={() => toggle(parentAssetIds, asset.id, setParentAssetIds)} />{asset.name}<span className="text-muted">{asset.detail}</span></label>) : <p className="text-sm text-muted">No parent assets available.</p>}</div></div></CardContent></Card>
    {errors.root ? <p role="alert" className="text-sm text-danger">{errors.root}</p> : null}
    <Button type="submit" loading={submitting}><Save className="size-4" />{mode === "create" ? "Create Asset" : "Save new version"}</Button>
  </form>;
}
