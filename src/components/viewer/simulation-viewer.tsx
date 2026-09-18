"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Expand, Minimize, Pause, Play, RotateCcw, SkipForward, StepBack, StepForward, Volume2, VolumeX } from "lucide-react";
import type { EngineEvent, ParticipantSnapshotV1 } from "@/lib/engine/schemas";
import { ViewerClock } from "@/lib/viewer/clock";
import { Canvas2DViewerRenderer } from "@/lib/viewer/canvas-renderer";
import { productionViewerRegistry } from "@/lib/viewer/registry";
import type { ViewerFrame, ViewerTimeline, VisualEntityInstance } from "@/lib/viewer/types";
import { Button } from "@/components/ui/button";

interface Props {
  runId: string;
  simulationId: string;
  title: string;
  moduleId: string;
  moduleVersion: string;
  participants: ParticipantSnapshotV1[];
  result: unknown;
  eventCount: number;
}

interface Playback {
  frame: ViewerFrame;
  playing: boolean;
  speed: number;
}

interface EventPage { items: EngineEvent[]; hasMore: boolean; nextAfterSequence: number }

function formatTime(ms: number) {
  const seconds = Math.floor(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

async function fetchEvents(runId: string, expectedCount: number, signal: AbortSignal): Promise<EngineEvent[]> {
  const events: EngineEvent[] = [];
  let after = 0;
  while (true) {
    const response = await fetch(`/api/simulation-runs/${encodeURIComponent(runId)}/events?after=${after}&limit=100`, { signal });
    const body = await response.json();
    if (!response.ok || !body?.data) throw new Error(body?.error?.message || "Could not load replay events.");
    const page = body.data as EventPage;
    if (!Array.isArray(page.items) || !Number.isSafeInteger(page.nextAfterSequence) ||
        (page.hasMore && (page.items.length === 0 || page.nextAfterSequence <= after))) {
      throw new Error("This replay contains an unsupported or invalid event.");
    }
    events.push(...page.items);
    if (events.length > expectedCount) throw new Error("This replay contains an unsupported or invalid event.");
    if (!page.hasMore) break;
    after = page.nextAfterSequence;
  }
  if (events.length !== expectedCount) throw new Error("This replay contains an unsupported or invalid event.");
  return events;
}

async function preload(scene: VisualEntityInstance[], signal: AbortSignal): Promise<Map<string, HTMLImageElement>> {
  const entries = await Promise.all(scene.map(async (entity): Promise<[string, HTMLImageElement] | null> => {
    if (entity.source.kind !== "IMAGE") return null;
    const imageUrl = entity.source.url;
    return new Promise((resolve) => {
      const image = new Image();
      let settled = false;
      const finish = (value: [string, HTMLImageElement] | null) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        signal.removeEventListener("abort", onAbort);
        image.onload = null; image.onerror = null;
        resolve(value);
      };
      const onAbort = () => finish(null);
      const timer = setTimeout(() => finish(null), 3500);
      signal.addEventListener("abort", onAbort, { once: true });
      image.onload = () => finish(image.naturalWidth > 0 ? [entity.id, image] : null);
      image.onerror = () => finish(null);
      image.src = imageUrl;
      if (signal.aborted) finish(null);
    });
  }));
  return new Map(entries.filter((entry): entry is [string, HTMLImageElement] => Boolean(entry)));
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    update(); query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return reduced;
}

export function SimulationViewer(props: Props) {
  const { runId, simulationId, title, moduleId, moduleVersion, participants, result, eventCount } = props;
  const adapter = productionViewerRegistry.forRun(moduleId, moduleVersion);
  const resultsHref = `/simulations/${simulationId}/runs/${runId}`;
  const sceneRef = useRef<VisualEntityInstance[]>([]);
  const timelineRef = useRef<ViewerTimeline | null>(null);
  const clockRef = useRef<ViewerClock | null>(null);
  const rendererRef = useRef<Canvas2DViewerRenderer | null>(null);
  const imagesRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const lastAudioSequence = useRef(0);
  const reducedMotion = useReducedMotion();
  const [phase, setPhase] = useState("Preparing replay...");
  const [error, setError] = useState("");
  const [playback, setPlayback] = useState<Playback | null>(null);
  const [muted, setMuted] = useState(true);
  const [volume, setVolume] = useState(0.4);
  const [fullscreen, setFullscreen] = useState(false);

  const draw = useCallback((notify = true) => {
    const timeline = timelineRef.current;
    const clock = clockRef.current;
    if (!adapter || !timeline || !clock) return;
    const frame = adapter.deriveFrame(timeline, sceneRef.current, result, clock.position, reducedMotion);
    rendererRef.current?.draw(frame, sceneRef.current, imagesRef.current);
    if (notify) setPlayback({ frame, playing: clock.isPlaying, speed: clock.playbackSpeed });
    return frame;
  }, [adapter, result, reducedMotion]);

  useEffect(() => {
    if (!adapter) return;
    const controller = new AbortController();
    async function prepare() {
      try {
        setPhase("Loading battle events...");
        const events = await fetchEvents(runId, eventCount, controller.signal);
        if (controller.signal.aborted) return;
        const scene = adapter!.buildScene(participants);
        const timeline = adapter!.buildTimeline({ participants, events, result });
        setPhase("Loading visuals...");
        const images = await preload(scene, controller.signal);
        if (controller.signal.aborted) return;
        sceneRef.current = scene;
        timelineRef.current = timeline;
        imagesRef.current = images;
        clockRef.current = new ViewerClock(timeline.durationMs);
        if (canvasRef.current) rendererRef.current = new Canvas2DViewerRenderer(canvasRef.current);
        setPhase("");
        clockRef.current.play(performance.now());
        draw();
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Replay could not be prepared.");
      }
    }
    void prepare();
    return () => {
      controller.abort();
      clockRef.current?.pause();
      rendererRef.current?.dispose();
      rendererRef.current = null;
      imagesRef.current.clear();
      const audio = audioRef.current;
      audioRef.current = null;
      if (audio) void audio.close();
    };
    // Initialization is tied to this historical run; playback state is managed separately.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId]);

  const sound = useCallback((kind: string) => {
    const audio = audioRef.current;
    if (!audio || audio.state !== "running" || muted || volume === 0) return;
    const frequencies: Record<string, number> = { ATTACK: 210, DODGE: 430, DAMAGE: 130, CRITICAL: 650, ELIMINATE: 90, COMPLETE: 540 };
    const frequency = frequencies[kind];
    if (!frequency) return;
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = kind === "DAMAGE" || kind === "ELIMINATE" ? "triangle" : "sine";
    oscillator.frequency.setValueAtTime(frequency, audio.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(45, frequency * 0.55), audio.currentTime + 0.13);
    gain.gain.setValueAtTime(Math.max(0.001, volume * 0.08), audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.16);
    oscillator.connect(gain).connect(audio.destination);
    oscillator.start(); oscillator.stop(audio.currentTime + 0.17);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  }, [muted, volume]);

  useEffect(() => {
    if (!playback?.playing) return;
    let id = 0;
    let lastUi = 0;
    const step = (now: number) => {
      const clock = clockRef.current;
      const timeline = timelineRef.current;
      if (!clock || !timeline) return;
      const previous = clock.position;
      clock.advance(now);
      for (const cue of timeline.cues) {
        if (cue.sequence > lastAudioSequence.current && cue.startMs > previous && cue.startMs <= clock.position) {
          sound(cue.kind); lastAudioSequence.current = cue.sequence;
        }
      }
      draw(now - lastUi > 100 || !clock.isPlaying);
      if (now - lastUi > 100) lastUi = now;
      if (clock.isPlaying) id = requestAnimationFrame(step);
    };
    id = requestAnimationFrame(step);
    return () => cancelAnimationFrame(id);
  }, [playback?.playing, draw, sound]);

  const ready = Boolean(playback);
  useEffect(() => {
    if (!ready) return;
    const observer = new ResizeObserver(() => draw(false));
    if (canvasRef.current) observer.observe(canvasRef.current);
    return () => observer.disconnect();
  }, [ready, draw]);

  useEffect(() => { if (ready) draw(false); }, [ready, reducedMotion, draw]);

  useEffect(() => {
    const update = () => setFullscreen(document.fullscreenElement === stageRef.current);
    document.addEventListener("fullscreenchange", update);
    return () => document.removeEventListener("fullscreenchange", update);
  }, []);

  const playPause = useCallback(() => {
    const clock = clockRef.current;
    if (!clock) return;
    if (clock.isPlaying) clock.pause(); else clock.play(performance.now());
    draw();
  }, [draw]);
  const restart = useCallback(() => {
    const clock = clockRef.current;
    if (!clock) return;
    clock.restart(); lastAudioSequence.current = 0; draw();
  }, [draw]);
  const seek = useCallback((position: number) => {
    const clock = clockRef.current;
    const timeline = timelineRef.current;
    if (!clock || !timeline) return;
    clock.seek(position, performance.now());
    lastAudioSequence.current = timeline.cues.filter((cue) => cue.startMs <= clock.position).at(-1)?.sequence ?? 0;
    draw();
  }, [draw]);
  const stepMoment = useCallback((direction: -1 | 1) => {
    const clock = clockRef.current;
    const timeline = timelineRef.current;
    if (!clock || !timeline) return;
    clock.pause();
    const starts = [0, ...timeline.moments.map((moment) => moment.startMs), timeline.durationMs];
    const target = direction > 0 ? starts.find((start) => start > clock.position + 2)
      : [...starts].reverse().find((start) => start < clock.position - 2);
    seek(target ?? (direction > 0 ? timeline.durationMs : 0));
  }, [seek]);
  const toggleMute = useCallback(async () => {
    if (muted) {
      try {
        audioRef.current ??= new AudioContext();
        await audioRef.current.resume();
      } catch { /* Browser audio restrictions leave visual playback unaffected. */ }
    }
    setMuted((current) => !current);
  }, [muted]);

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest("input,textarea,select,[contenteditable=true],button")) return;
      if (event.code === "Space") { event.preventDefault(); playPause(); }
      else if (event.key.toLowerCase() === "r") restart();
      else if (event.key === "ArrowLeft") stepMoment(-1);
      else if (event.key === "ArrowRight") stepMoment(1);
      else if (event.key.toLowerCase() === "m") void toggleMute();
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [playPause, restart, stepMoment, toggleMute]);

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await stageRef.current?.requestFullscreen();
    } catch { /* Unsupported browser: the viewer remains usable in its normal layout. */ }
  }

  if (!adapter) return <div className="rounded-2xl border border-border bg-surface p-8 text-center text-secondary">
    <p>Visual playback is not available for this simulation type yet.</p>
    <Link href={resultsHref} className="mt-4 inline-block text-accent hover:underline">View Results</Link>
  </div>;

  const frame = playback?.frame;
  const duration = timelineRef.current?.durationMs ?? 0;
  const scene = sceneRef.current;
  const completion = frame?.completed;
  const resultLabel = completion ? frame.timeout
    ? frame.tiedIds.length > 1 ? "Time limit · Draw" : "Time limit · Final standings"
    : `Winner · ${scene.find((entity) => entity.id === frame.winnerId)?.name ?? "Battle complete"}` : null;

  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <Link href={resultsHref} className="inline-flex items-center gap-2 text-sm text-secondary hover:text-foreground"><ArrowLeft className="size-4" />View Results</Link>
      <span className="text-xs font-semibold uppercase tracking-[.22em] text-accent">SIMVERSE / Visual Replay</span>
    </div>
    <div ref={stageRef} className="overflow-hidden rounded-2xl border border-border-strong bg-[#080f1d] shadow-[0_24px_80px_-30px_rgba(0,0,0,.8)] fullscreen:flex fullscreen:flex-col fullscreen:justify-center">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-4 py-3 sm:px-6">
        <div className="min-w-0"><h1 className="truncate font-display text-lg font-bold text-white sm:text-xl">{title}</h1><p className="text-xs text-[#9eb3ca]">SIMVERSE Arena · {scene.length > 2 ? "Free for all" : "Duel"} · Historical replay</p></div>
        <span className="rounded-full border border-[#318da8]/40 bg-[#0d2b3a] px-3 py-1 text-xs font-bold text-[#9eeaf8]">{completion ? resultLabel : frame ? `TICK ${frame.tick}` : "LOADING"}</span>
      </div>
      <div className="relative aspect-[16/11] w-full sm:aspect-auto sm:h-[clamp(340px,48vh,520px)] fullscreen:min-h-0 fullscreen:h-auto fullscreen:flex-1">
        <canvas ref={canvasRef} role="img" aria-label="Animated SIMVERSE Battle arena showing saved simulation events" className="h-full w-full" />
        {phase || error ? <div role="status" className="absolute inset-0 grid place-content-center bg-[#08111f]/95 px-6 text-center text-white">
          <p className="text-lg font-semibold">{error || phase}</p>
          {error ? <Link href={resultsHref} className="mt-3 text-accent hover:underline">View Results</Link> : <p className="mt-2 text-sm text-[#9eb3ca]">Preparing the saved run. No new simulation is created.</p>}
        </div> : null}
        {frame && frame.timeMs < (timelineRef.current?.introMs ?? 0) ? <button type="button" onClick={() => seek(timelineRef.current?.introMs ?? 0)}
          className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-md bg-black/65 px-3 py-1.5 text-xs font-semibold text-white hover:bg-black/85"><SkipForward className="size-3.5" />Skip Intro</button> : null}
      </div>
      <div className="grid gap-2 border-t border-white/10 bg-[#0b1526] p-3 sm:grid-cols-2 sm:p-4" aria-label="Participant health">
        {scene.map((entity) => {
          const state = frame?.participants[entity.id];
          return <div key={entity.id} className="min-w-0 rounded-lg border border-white/10 bg-[#101d31] p-2.5">
            <div className="mb-1.5 flex items-center justify-between gap-2 text-xs"><span className="truncate font-semibold text-white">{entity.name}</span><span className="shrink-0 font-mono text-[#b5c9dc]">{state?.eliminated ? "ELIMINATED · " : ""}{state?.health ?? 100}/100</span></div>
            <div className="h-2 overflow-hidden rounded-full bg-[#283447]" role="progressbar" aria-label={`${entity.name} health`} aria-valuenow={state?.health ?? 100} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${state?.health ?? 100}%`, background: entity.primaryColor }} />
            </div>
          </div>;
        })}
      </div>
      {completion ? <p className="border-t border-white/10 bg-[#0b1526] px-4 py-2 text-xs text-[#bfd0df]">
        <span className="font-semibold text-white">Final standings: </span>
        {frame.rankingIds.map((id, index) => `${index + 1}. ${scene.find((entity) => entity.id === id)?.name ?? "Participant"}`).join(" · ")}
      </p> : null}
      <div className="border-t border-white/10 bg-[#101b2d] px-3 py-3 sm:px-5">
        <p role="status" aria-live="polite" className="mb-2 min-h-5 text-sm font-medium text-white">{frame?.caption ?? "Preparing replay..."}</p>
        <div className="flex items-center gap-3 text-xs text-[#a8bbcf]">
          <span className="w-10 font-mono">{formatTime(frame?.timeMs ?? 0)}</span>
          <input type="range" min={0} max={Math.max(1, duration)} value={frame?.timeMs ?? 0} step={1}
            onChange={(event) => seek(Number(event.target.value))} disabled={!frame} aria-label="Replay position"
            className="min-w-0 flex-1 accent-cyan-400" />
          <span className="w-10 text-right font-mono">{formatTime(duration)}</span>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="sm" onClick={playPause} disabled={!frame} aria-label={playback?.playing ? "Pause replay" : "Play replay"}>
            {playback?.playing ? <Pause className="size-4" /> : <Play className="size-4" />}{playback?.playing ? "Pause" : "Play"}</Button>
          <Button variant="ghost" size="sm" onClick={restart} disabled={!frame} aria-label="Restart replay"><RotateCcw className="size-4" />Restart</Button>
          <Button variant="icon" size="sm" onClick={() => stepMoment(-1)} disabled={!frame} aria-label="Previous moment"><StepBack className="size-4" /></Button>
          <Button variant="icon" size="sm" onClick={() => stepMoment(1)} disabled={!frame} aria-label="Next moment"><StepForward className="size-4" /></Button>
          <label className="ml-auto flex items-center gap-1.5 text-xs text-[#b7c9d9]">Speed
            <select value={playback?.speed ?? 1} onChange={(event) => { clockRef.current?.setSpeed(Number(event.target.value)); draw(); }}
              className="rounded-md border border-white/15 bg-[#17263a] px-2 py-1.5 text-white" aria-label="Playback speed">
              <option value={0.5}>0.5×</option><option value={1}>1×</option><option value={1.5}>1.5×</option><option value={2}>2×</option>
            </select>
          </label>
          <Button variant="icon" size="sm" onClick={() => void toggleMute()} aria-label={muted ? "Unmute replay" : "Mute replay"}>
            {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}</Button>
          <input type="range" min={0} max={1} step={0.05} value={volume} onChange={(event) => setVolume(Number(event.target.value))}
            aria-label="Replay volume" className="w-16 accent-cyan-400" />
          <Button variant="icon" size="sm" onClick={() => void toggleFullscreen()} aria-label={fullscreen ? "Exit fullscreen" : "Fullscreen replay"}>
            {fullscreen ? <Minimize className="size-4" /> : <Expand className="size-4" />}</Button>
        </div>
      </div>
    </div>
    <p className="text-xs text-muted">Playback uses this run’s saved events and participant snapshots. Space: play/pause · R: restart · ←/→: step · M: mute.</p>
  </div>;
}
