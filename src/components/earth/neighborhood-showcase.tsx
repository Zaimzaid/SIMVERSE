"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, ArrowUp, ArrowDown, ArrowRight, Camera, Compass, Footprints, MapPin,
  Grid3X3, Info, Leaf, Move, RotateCw, Settings2, ShieldAlert,
} from "lucide-react";
import type {
  NeighborhoodCameraMode, NeighborhoodQuality, NeighborhoodRenderer,
  NeighborhoodSelection,
} from "@/lib/earth/neighborhood/renderer";

/**
 * Browser-only, additive visual proof. Uses existing Three.js dependency.
 * No login/session, land grants, GIS data or database writes in this component.
 */
export function NeighborhoodShowcase() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<NeighborhoodRenderer | null>(null);
  const [quality, setQuality] = useState<NeighborhoodQuality>("MEDIUM");
  const [cameraMode, setCameraMode] = useState<NeighborhoodCameraMode>("WALK");
  const [showPlots, setShowPlots] = useState(false);
  const [selection, setSelection] = useState<NeighborhoodSelection>(null);
  const [position, setPosition] = useState({ x: 0, z: 7 });
  const [failed, setFailed] = useState("");
  const [ready, setReady] = useState(false);
  const [retry, setRetry] = useState(0);
  const [showHelp, setShowHelp] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const canvas = canvasRef.current;
    if (!canvas) return;
    void import("@/lib/earth/neighborhood/renderer").then(({ NeighborhoodRenderer: Engine }) => {
      if (cancelled) return;
      try {
        const probe = document.createElement("canvas");
        if (!probe.getContext("webgl2") && !probe.getContext("webgl")) {
          throw new Error("WebGL is not available in this browser or device.");
        }
        const effectiveQuality = window.innerWidth < 740 ? "LOW" : "MEDIUM";
        const engine = new Engine(canvas, effectiveQuality,
          (value) => { if (!cancelled) setSelection(value); },
          (x, z) => { if (!cancelled) setPosition({ x, z }); },
        );
        engineRef.current = engine;
        engine.setCameraMode(cameraMode);
        engine.setPlotGuides(showPlots);
        setQuality(effectiveQuality);
        setReady(true);
      } catch (error) {
        setFailed(error instanceof Error ? error.message : "Could not start the 3D neighborhood.");
      }
    }).catch(() => {
      if (!cancelled) setFailed("The 3D engine could not load. Try another browser or graphics setting.");
    });
    return () => {
      cancelled = true;
      engineRef.current?.dispose();
      engineRef.current = null;
    };
    // Startup is a one-time resource effect per explicit retry. Runtime settings
    // are handled by independent effects below without rebuilding the world.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retry]);

  useEffect(() => { engineRef.current?.setQuality(quality); }, [quality]);
  useEffect(() => { engineRef.current?.setCameraMode(cameraMode); }, [cameraMode]);
  useEffect(() => { engineRef.current?.setPlotGuides(showPlots); }, [showPlots]);

  function touch(forward: number, strafe: number) {
    return {
      onPointerDown: (event: React.PointerEvent<HTMLButtonElement>) => {
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        engineRef.current?.setJoystick(forward, strafe);
      },
      onPointerUp: () => engineRef.current?.setJoystick(0, 0),
      onPointerCancel: () => engineRef.current?.setJoystick(0, 0),
      onLostPointerCapture: () => engineRef.current?.setJoystick(0, 0),
    };
  }

  return (
    <main className="relative flex min-h-dvh w-full flex-col overflow-hidden bg-[#091826] text-[#f3f8f6]" data-earth-neighborhood="v02">
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-36 bg-gradient-to-b from-[#071622]/90 via-[#071622]/45 to-transparent" />
      <canvas ref={canvasRef}
        aria-label="Interactive Marina Junction 3D neighborhood scene"
        className="absolute inset-0 h-full w-full touch-none outline-none"
        style={{ minHeight: "100dvh" }} />

      <header className="pointer-events-none relative z-30 flex flex-wrap items-start justify-between gap-3 px-4 pt-4 sm:px-6">
        <div className="pointer-events-auto flex items-center gap-3">
          <Link href="/earth/geography"
            className="rounded-xl border border-white/20 bg-[#0a1d2c]/90 p-2.5 text-[#ecf8fc] transition hover:border-cyan-300/60"
            aria-label="Return to Earth geography">
            <ArrowLeft className="size-5" />
          </Link>
          <div className="rounded-xl border border-white/15 bg-[#0a1d2c]/85 px-4 py-2 backdrop-blur-lg">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.24em] text-cyan-300">
              <Compass className="size-3.5" /> SIMVERSE EARTH — VISUAL PROOF 02
            </div>
            <h1 className="mt-0.5 text-xl font-semibold tracking-tight sm:text-2xl">Marina Junction</h1>
            <p className="text-xs text-slate-300">Fictional Lagos-inspired neighborhood · curated plaza & showcase street</p>
          </div>
        </div>
        <div className="pointer-events-auto flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => {
            engineRef.current?.focusShowcase();
            setCameraMode("WALK");
          }} className="flex items-center gap-2 rounded-xl border border-cyan-300/45 bg-[#103a4d]/95 px-3 py-2 text-xs font-semibold text-cyan-100 hover:bg-[#155369]">
            <MapPin className="size-4" /> Showcase street
          </button>
          <button type="button" onClick={() => setCameraMode(cameraMode === "WALK" ? "OVERVIEW" : "WALK")}
            className="flex items-center gap-2 rounded-xl border border-white/20 bg-[#0a1d2c]/90 px-3 py-2 text-xs font-semibold hover:bg-[#13354a]"
            aria-pressed={cameraMode === "OVERVIEW"}>
            {cameraMode === "WALK" ? <Camera className="size-4" /> : <Footprints className="size-4" />}
            {cameraMode === "WALK" ? "Overview" : "Walk"}
          </button>
          <button type="button" onClick={() => setShowPlots((value) => !value)}
            className="flex items-center gap-2 rounded-xl border border-white/20 bg-[#0a1d2c]/90 px-3 py-2 text-xs font-semibold hover:bg-[#13354a]"
            aria-pressed={showPlots}>
            <Grid3X3 className="size-4" /> Plot guides {showPlots ? "On" : "Off"}
          </button>
          <label className="flex items-center gap-2 rounded-xl border border-white/20 bg-[#0a1d2c]/90 px-3 py-2 text-xs">
            <Settings2 className="size-4" />
            <span className="sr-only">Visual quality</span>
            <select value={quality} aria-label="Visual quality"
              onChange={(event) => setQuality(event.target.value as NeighborhoodQuality)}
              className="bg-transparent text-xs font-semibold text-white outline-none">
              <option value="LOW" className="bg-[#0a1d2c]">Low quality</option>
              <option value="MEDIUM" className="bg-[#0a1d2c]">Medium quality</option>
              <option value="HIGH" className="bg-[#0a1d2c]">High quality</option>
            </select>
          </label>
        </div>
      </header>

      <div className="pointer-events-none relative z-10 flex flex-1 items-end justify-between gap-3 p-4 pb-6 sm:p-6">
        <div className="pointer-events-auto flex max-w-xs flex-col gap-2">
          {selection ? (
            <section className="rounded-2xl border border-cyan-400/40 bg-[#081d2d]/95 p-4 shadow-2xl backdrop-blur-xl" aria-live="polite">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-300">Selected building</p>
              <h2 className="mt-1 text-lg font-semibold">{selection.name}</h2>
              <p className="mt-1 text-xs capitalize text-slate-300">{selection.kind} · Visual-only building</p>
              <p className="mt-2 text-[11px] leading-relaxed text-amber-200">
                This structure is part of a fictional design proof. It is not linked to an acquired SIMVERSE plot.
              </p>
              <button type="button" onClick={() => setSelection(null)} className="mt-3 text-xs text-cyan-300 hover:underline">
                Dismiss details
              </button>
            </section>
          ) : null}
          <div className="rounded-xl border border-white/15 bg-[#081d2d]/90 px-3 py-2 text-[11px] text-slate-300 backdrop-blur-lg">
            <p className="flex items-center gap-2 font-semibold text-emerald-200">
              <Leaf className="size-3.5" /> Built with existing Three.js · No paid assets
            </p>
            <p className="mt-1">Walk the curated plaza or click Showcase street. Buildings and plot guides are fictional.</p>
            <p className="mt-1 font-mono text-[10px]">Local position {Math.round(position.x)}m E · {Math.round(-position.z)}m N</p>
          </div>
          {showHelp ? (
            <section className="hidden rounded-xl border border-white/15 bg-[#081d2d]/90 p-3 text-xs text-slate-200 backdrop-blur-lg md:block">
              <p className="mb-1 flex items-center gap-2 font-bold"><Move className="size-4" /> Controls</p>
              <p><strong>W A S D</strong> / arrows: walk · <strong>Shift</strong>: sprint</p>
              <p>Drag map: rotate camera · Tap: inspect building</p>
              <p>Overview: drag to rotate the city · Showcase street: focus detailed facades</p>
              <button type="button" className="mt-2 text-cyan-300 hover:underline" onClick={() => setShowHelp(false)}>Hide guide</button>
            </section>
          ) : (
            <button type="button" className="hidden rounded-lg bg-[#081d2d]/90 px-3 py-2 text-xs text-cyan-300 md:block" onClick={() => setShowHelp(true)}>Show controls</button>
          )}
        </div>

        <div className="pointer-events-auto flex flex-col gap-2 rounded-2xl border border-white/20 bg-[#071827]/80 p-2 backdrop-blur md:hidden"
          aria-label="Touch movement controls">
          <div className="flex justify-center">
            <button type="button" aria-label="Move forward" {...touch(1, 0)} className="rounded-lg bg-white/15 p-3 active:bg-cyan-500/50">
              <ArrowUp className="size-5" />
            </button>
          </div>
          <div className="flex gap-2">
            <button type="button" aria-label="Move left" {...touch(0, -1)} className="rounded-lg bg-white/15 p-3 active:bg-cyan-500/50">
              <ArrowLeft className="size-5" />
            </button>
            <button type="button" aria-label="Move backward" {...touch(-1, 0)} className="rounded-lg bg-white/15 p-3 active:bg-cyan-500/50">
              <ArrowDown className="size-5" />
            </button>
            <button type="button" aria-label="Move right" {...touch(0, 1)} className="rounded-lg bg-white/15 p-3 active:bg-cyan-500/50">
              <ArrowRight className="size-5" />
            </button>
          </div>
        </div>
      </div>

      {!ready && (
        <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center bg-[#0a1d2b] text-center">
          {!failed ? (
            <div className="max-w-sm px-5">
              <div className="mx-auto mb-4 size-12 animate-pulse rounded-xl border border-cyan-300/30 bg-cyan-300/10" />
              <h2 className="font-semibold">Preparing Marina Junction…</h2>
              <p className="mt-2 text-sm text-slate-300">Building the scene in your browser. No large asset download is required.</p>
            </div>
          ) : null}
        </div>
      )}
      {failed ? (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#071826]/95 p-6">
          <div className="max-w-md rounded-2xl border border-amber-400/40 bg-[#10263a] p-6 text-center">
            <ShieldAlert className="mx-auto mb-3 size-8 text-amber-300" />
            <h2 className="text-lg font-semibold">3D preview unavailable</h2>
            <p className="mt-2 text-sm text-slate-200">{failed}</p>
            <p className="mt-2 text-xs text-slate-300">Your Earth geography and virtual plot lists remain available without this preview.</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <button type="button" onClick={() => {
                setReady(false);
                setFailed("");
                setRetry((value) => value + 1);
              }}
                className="flex items-center gap-2 rounded-lg bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950">
                <RotateCw className="size-4" /> Retry 3D
              </button>
              <Link href="/earth/geography" className="rounded-lg border border-white/20 px-4 py-2 text-sm">Open Earth Map</Link>
            </div>
          </div>
        </div>
      ) : null}

      <footer className="pointer-events-none relative z-30 flex flex-wrap items-center justify-between gap-2 bg-[#061520]/90 px-4 py-2 text-[10px] text-slate-300 sm:px-6">
        <span className="flex items-center gap-1.5"><Info className="size-3.5 text-amber-300" /> Fictional scene — not a surveyed Lagos district, cadastral map, or available real-world property.</span>
        <span className="font-mono text-cyan-200">SIMVERSE · Visual-first proof · Version 0.2</span>
      </footer>
    </main>
  );
}
