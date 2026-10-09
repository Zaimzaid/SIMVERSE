"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { apiFetch, fieldErrorsFrom } from "@/lib/client/api";
import { zodFieldErrors } from "@/lib/client/form";
import { generateSeed } from "@/lib/simulations/seed";
import { TOURNAMENT_PRESETS } from "@/lib/tournaments/presets";
import { createTournamentSchema } from "@/lib/tournaments/schemas";
import type { TournamentView } from "@/server/services/tournament-service";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";

interface Options {
  entities: Array<{ id: string; name: string; category: string }>;
  projects: Array<{ id: string; name: string }>;
  simulations: Array<{ id: string; name: string; mode: string; projectId: string; worldId: string | null; worldVersion: number | null; experienceProfileId: string | null; experienceProfileVersion: number | null }>;
  worlds: Array<{ worldId: string; worldName: string; version: number }>;
  experiences: Array<{ experienceProfileId: string; experienceProfileName: string; version: number }>;
}

export function TournamentForm({ mode, options, initial }: { mode: "create" | "edit"; options: Options; initial?: TournamentView }) {
  const router = useRouter(); const { toast } = useToast();
  const [name, setName] = useState(initial?.name ?? ""); const [description, setDescription] = useState(initial?.description ?? "");
  const [format, setFormat] = useState(initial?.format ?? "SINGLE_ELIMINATION");
  const [projectId, setProjectId] = useState(initial?.projectId ?? "");
  const [simulationTemplateId, setSimulationTemplateId] = useState(initial?.simulationTemplateId ?? "");
  const [participantIds, setParticipantIds] = useState(initial?.participants.map((participant) => participant.entityId) ?? []);
  const [seedingMethod, setSeedingMethod] = useState(initial?.seedingMethod ?? "MANUAL");
  const [randomSeed, setRandomSeed] = useState(initial?.randomSeed ?? generateSeed());
  const [tiePolicy, setTiePolicy] = useState(initial?.tiePolicy ?? "REPLAY_MATCH");
  const [winPoints, setWinPoints] = useState(initial?.winPoints ?? 3); const [tiePoints, setTiePoints] = useState(initial?.tiePoints ?? 1); const [lossPoints, setLossPoints] = useState(initial?.lossPoints ?? 0);
  const [tiebreakers, setTiebreakers] = useState(initial?.tiebreakers ?? ["POINTS", "WINS", "HEAD_TO_HEAD"]);
  const [worldBinding, setWorldBinding] = useState(initial?.worldId ? `${initial.worldId}:${initial.worldVersion}` : "");
  const [experienceBinding, setExperienceBinding] = useState(initial?.experienceProfileId ? `${initial.experienceProfileId}:${initial.experienceProfileVersion}` : "");
  const [scheduledStartAt, setScheduledStartAt] = useState(initial?.scheduledStartAt ? new Date(initial.scheduledStartAt).toISOString().slice(0, 16) : "");
  const [errors, setErrors] = useState<Record<string, string>>({}); const [submitting, setSubmitting] = useState(false);
  const selectedTemplate = options.simulations.find((simulation) => simulation.id === simulationTemplateId);
  const participantNames = useMemo(() => participantIds.map((id) => options.entities.find((entity) => entity.id === id)?.name).filter(Boolean), [participantIds, options.entities]);

  function applyPreset(id: string) { const preset = TOURNAMENT_PRESETS.find((item) => item.id === id); if (!preset) return; setFormat(preset.configuration.format); setSeedingMethod(preset.configuration.seedingMethod); setTiePolicy(preset.configuration.tiePolicy); setWinPoints(preset.configuration.winPoints); setTiePoints(preset.configuration.tiePoints); setLossPoints(preset.configuration.lossPoints); setTiebreakers([...preset.configuration.tiebreakers]); }
  function toggleParticipant(id: string) { setParticipantIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]); }
  function moveParticipant(index: number, direction: -1 | 1) { setParticipantIds((current) => { const target = index + direction; if (target < 0 || target >= current.length) return current; const next = [...current]; [next[index], next[target]] = [next[target]!, next[index]!]; return next; }); }
  function binding(value: string) { const [id, version] = value.split(":"); return id && version ? { id, version: Number(version) } : null; }

  async function submit(event: React.FormEvent) {
    event.preventDefault(); const world = binding(worldBinding); const experience = binding(experienceBinding);
    const payload = { name, description, projectId: projectId || undefined, simulationTemplateId, format,
      participants: participantIds.map((entityId, index) => ({ entityId, seed: index + 1 })), seedingMethod,
      randomSeed, tiePolicy, winPoints, tiePoints, lossPoints, tiebreakers,
      scheduledStartAt: scheduledStartAt ? new Date(scheduledStartAt) : undefined,
      worldId: world?.id, worldVersion: world?.version, experienceProfileId: experience?.id, experienceProfileVersion: experience?.version };
    const parsed = createTournamentSchema.safeParse(payload); if (!parsed.success) { setErrors(zodFieldErrors(parsed.error)); return; }
    setErrors({}); setSubmitting(true);
    const result = await apiFetch<{ tournament: TournamentView }>(mode === "create" ? "/api/tournaments" : `/api/tournaments/${initial?.id}`, { method: mode === "create" ? "POST" : "PATCH", body: JSON.stringify(parsed.data) });
    setSubmitting(false); if (result.error) { setErrors(fieldErrorsFrom(result.error)); toast({ variant: "error", title: "Tournament could not be saved", description: result.error.message }); return; }
    toast({ variant: "success", title: mode === "create" ? "Tournament created" : "Tournament updated" }); router.push(`/tournaments/${result.data?.tournament.id}`); router.refresh();
  }

  return <form onSubmit={submit} className="space-y-6">
    <Card><CardHeader><CardTitle>1. Identity</CardTitle><CardDescription>Name this reusable competition structure.</CardDescription></CardHeader><CardContent className="grid gap-4 md:grid-cols-2">
      <Field label="Name" required error={errors.name}><Input value={name} onChange={(event) => setName(event.target.value)} /></Field>
      <Field label="Project (optional)"><Select value={projectId} onChange={(event) => setProjectId(event.target.value)}><option value="">Inherit template project</option>{options.projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</Select></Field>
      <Field className="md:col-span-2" label="Description"><Textarea value={description} onChange={(event) => setDescription(event.target.value)} /></Field>
    </CardContent></Card>
    <Card><CardHeader><CardTitle>2. Format</CardTitle><CardDescription>Single elimination supports BYEs. Round robin schedules every pairing once.</CardDescription></CardHeader><CardContent className="grid gap-4 md:grid-cols-2">
      <Field label="Preset"><Select defaultValue="" onChange={(event) => applyPreset(event.target.value)}><option value="">Custom configuration</option>{TOURNAMENT_PRESETS.map((preset) => <option key={preset.id} value={preset.id}>{preset.name}</option>)}</Select></Field>
      <Field label="Format"><Select value={format} onChange={(event) => setFormat(event.target.value as typeof format)}><option value="SINGLE_ELIMINATION">Single elimination</option><option value="ROUND_ROBIN">Round robin</option></Select></Field>
    </CardContent></Card>
    <Card><CardHeader><CardTitle>3. Participants</CardTitle><CardDescription>Active workspace Entities become frozen Tournament participant identities when saved.</CardDescription></CardHeader><CardContent className="space-y-4">
      <div className="grid gap-2 md:grid-cols-2">{options.entities.map((entity) => <label key={entity.id} className="flex items-center gap-3 rounded-lg border border-border p-3 text-sm"><Checkbox checked={participantIds.includes(entity.id)} onChange={() => toggleParticipant(entity.id)} /><span><strong>{entity.name}</strong><span className="ml-2 text-muted">{entity.category}</span></span></label>)}</div>
      {errors.participants ? <p className="text-sm text-danger">{errors.participants}</p> : null}
    </CardContent></Card>
    <Card><CardHeader><CardTitle>4. Seeding</CardTitle><CardDescription>Manual order is explicit. Random order is reproducible from its SIMVERSE seed.</CardDescription></CardHeader><CardContent className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2"><Field label="Method"><Select value={seedingMethod} onChange={(event) => setSeedingMethod(event.target.value as typeof seedingMethod)}><option value="MANUAL">Manual</option><option value="RANDOM">Deterministic random</option></Select></Field><Field label="Random seed"><Input value={randomSeed} onChange={(event) => setRandomSeed(event.target.value.toUpperCase())} /></Field></div>
      {seedingMethod === "MANUAL" ? <ol className="space-y-2">{participantNames.map((participant, index) => <li key={participant} className="flex items-center gap-2 rounded border border-border px-3 py-2 text-sm"><strong>#{index + 1}</strong><span className="flex-1">{participant}</span><Button type="button" size="sm" variant="ghost" onClick={() => moveParticipant(index, -1)} disabled={index === 0}>Up</Button><Button type="button" size="sm" variant="ghost" onClick={() => moveParticipant(index, 1)} disabled={index === participantNames.length - 1}>Down</Button></li>)}</ol> : <p className="text-sm text-muted">The saved seed produces the same order every time the participant set is unchanged.</p>}
    </CardContent></Card>
    <Card><CardHeader><CardTitle>5. Simulation</CardTitle><CardDescription>Each head-to-head Match derives a normal supported Simulation and executes its authoritative Run.</CardDescription></CardHeader><CardContent><Field label="READY Battle duel or Race template" required error={errors.simulationTemplateId}><Select value={simulationTemplateId} onChange={(event) => setSimulationTemplateId(event.target.value)}><option value="">Choose a template</option>{options.simulations.map((simulation) => <option key={simulation.id} value={simulation.id}>{simulation.name} · {simulation.mode}</option>)}</Select></Field>{selectedTemplate ? <p className="mt-2 text-xs text-muted">Template project, mode and immutable configuration are frozen when structure is generated. Tournament v1 still runs exactly two participants per Match.</p> : null}</CardContent></Card>
    <Card><CardHeader><CardTitle>6–7. World and Experience Profile</CardTitle><CardDescription>Optional pinned defaults override the template. Presentation never affects competition truth.</CardDescription></CardHeader><CardContent className="grid gap-4 md:grid-cols-2"><Field label="World version"><Select value={worldBinding} onChange={(event) => setWorldBinding(event.target.value)}><option value="">Inherit from template</option>{options.worlds.map((world) => <option key={`${world.worldId}:${world.version}`} value={`${world.worldId}:${world.version}`}>{world.worldName} · v{world.version}</option>)}</Select></Field><Field label="Experience Profile version"><Select value={experienceBinding} onChange={(event) => setExperienceBinding(event.target.value)}><option value="">Inherit from template</option>{options.experiences.map((experience) => <option key={`${experience.experienceProfileId}:${experience.version}`} value={`${experience.experienceProfileId}:${experience.version}`}>{experience.experienceProfileName} · v{experience.version}</option>)}</Select></Field></CardContent></Card>
    <Card><CardHeader><CardTitle>8. Rules and scoring</CardTitle><CardDescription>Elimination ties require an explicit policy. Round robin standings use the ordered rules shown.</CardDescription></CardHeader><CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-4"><Field label="Elimination tie policy"><Select value={tiePolicy} onChange={(event) => setTiePolicy(event.target.value as typeof tiePolicy)}><option value="NO_TIES_ALLOWED">Pause for resolution</option><option value="REPLAY_MATCH">Create replay Match</option></Select></Field><Field label="Win points"><Input type="number" value={winPoints} onChange={(event) => setWinPoints(Number(event.target.value))} /></Field><Field label="Tie points"><Input type="number" value={tiePoints} onChange={(event) => setTiePoints(Number(event.target.value))} /></Field><Field label="Loss points"><Input type="number" value={lossPoints} onChange={(event) => setLossPoints(Number(event.target.value))} /></Field><Field className="md:col-span-2" label="Ordered tiebreakers"><Select value={tiebreakers.join(",")} onChange={(event) => setTiebreakers(event.target.value.split(",") as typeof tiebreakers)}><option value="POINTS,WINS,HEAD_TO_HEAD">Points → wins → head to head</option><option value="POINTS,HEAD_TO_HEAD">Points → head to head</option><option value="WINS,POINTS,HEAD_TO_HEAD">Wins → points → head to head</option></Select></Field></CardContent></Card>
    <Card><CardHeader><CardTitle>9. Schedule</CardTitle><CardDescription>Scheduling is metadata only; v1 does not launch background jobs.</CardDescription></CardHeader><CardContent><Field label="Planned start"><Input type="datetime-local" value={scheduledStartAt} onChange={(event) => setScheduledStartAt(event.target.value)} /></Field></CardContent></Card>
    <Card><CardHeader><CardTitle>10. Review</CardTitle><CardDescription>{participantIds.length} participants · {format.replaceAll("_", " ").toLowerCase()} · {selectedTemplate?.name ?? "choose a Simulation template"}</CardDescription></CardHeader><CardContent><p className="text-sm text-muted">Saving creates a Draft. Generate its structure, mark it ready, and start it from the detail page.</p></CardContent></Card>
    {errors.root ? <p role="alert" className="text-sm text-danger">{errors.root}</p> : null}
    <Button type="submit" loading={submitting}><Save className="size-4" />{mode === "create" ? "Create Tournament" : "Save Tournament"}</Button>
  </form>;
}
