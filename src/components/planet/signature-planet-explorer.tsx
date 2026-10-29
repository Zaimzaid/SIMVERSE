"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Compass,
  Globe2,
  Info,
  Minus,
  Pause,
  Play,
  Plus,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import type { SignaturePlanetRenderer } from "@/lib/planet/signature-planet-renderer";

type Position = { x: number; y: number };

export function SignaturePlanetExplorer() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<SignaturePlanetRenderer | null>(null);
  const pointersRef = useRef(new Map<number, Position>());
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [autoOrbit, setAutoOrbit] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncPreference = () => {
      setReducedMotion(preference.matches);
      engineRef.current?.setReducedMotion(preference.matches);
      if (preference.matches) {
        engineRef.current?.setPlaying(false);
        setAutoOrbit(false);
      }
    };
    syncPreference();
    preference.addEventListener("change", syncPreference);
    return () => preference.removeEventListener("change", syncPreference);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let alive = true;
    let instance: SignaturePlanetRenderer | null = null;
    let observer: ResizeObserver | null = null;
    // Attach a non-passive native wheel handler for actual canvas zoom.
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      engineRef.current?.zoom(event.deltaY * 0.004);
    };
    canvas.addEventListener("wheel", handleWheel, { passive: false });

    void import("@/lib/planet/signature-planet-renderer")
      .then(({ SignaturePlanetRenderer, checkPlanetWebGL }) => {
        if (!alive) return;
        if (!checkPlanetWebGL()) throw new Error("3D graphics are unavailable in this browser.");
        instance = new SignaturePlanetRenderer(canvas, window.matchMedia("(prefers-reduced-motion: reduce)").matches);
        engineRef.current = instance;
        observer = new ResizeObserver((entries) => {
          const rect = entries[0]?.contentRect;
          if (rect) instance?.resize(rect.width, rect.height);
        });
        observer.observe(canvas);
        setReady(true);
        setError("");
      })
      .catch((cause: unknown) => {
        if (!alive) return;
        setReady(false);
        setError(cause instanceof Error ? cause.message : "The 3D planet could not start.");
      });

    return () => {
      alive = false;
      observer?.disconnect();
      canvas.removeEventListener("wheel", handleWheel);
      instance?.dispose();
      engineRef.current = null;
      pointersRef.current.clear();
    };
  }, [retry]);

  const toggleOrbit = useCallback(() => {
    if (reducedMotion) return;
    setAutoOrbit((previous) => {
      engineRef.current?.setPlaying(!previous);
      return !previous;
    });
  }, [reducedMotion]);

  const onPointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!ready) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const pointers = pointersRef.current;
    const previous = pointers.get(event.pointerId);
    if (!previous || !engineRef.current) return;
    const other = [...pointers.entries()].find(([id]) => id !== event.pointerId)?.[1];
    const next = { x: event.clientX, y: event.clientY };
    if (other) {
      const oldDistance = Math.hypot(previous.x - other.x, previous.y - other.y);
      const newDistance = Math.hypot(next.x - other.x, next.y - other.y);
      engineRef.current.zoom((oldDistance - newDistance) * 0.012);
    } else {
      engineRef.current.rotate(next.x - previous.x, next.y - previous.y);
    }
    pointers.set(event.pointerId, next);
  };

  const onPointerEnd = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    pointersRef.current.delete(event.pointerId);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLCanvasElement>) => {
    const controls: Record<string, () => void> = {
      ArrowLeft: () => engineRef.current?.rotate(-25, 0),
      ArrowRight: () => engineRef.current?.rotate(25, 0),
      ArrowUp: () => engineRef.current?.rotate(0, -25),
      ArrowDown: () => engineRef.current?.rotate(0, 25),
      "+": () => engineRef.current?.zoom(-0.4),
      "=": () => engineRef.current?.zoom(-0.4),
      "-": () => engineRef.current?.zoom(0.4),
    };
    const control = controls[event.key];
    if (control) {
      event.preventDefault();
      control();
    }
  };

  return (
    <div className="relative isolate flex min-h-[min(900px,calc(100dvh-3rem))] w-full flex-col overflow-hidden bg-[#020812] text-white sm:rounded-[28px] sm:border sm:border-cyan-200/10">
      <div className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(ellipse_at_50%_47%,rgba(21,68,105,0.24),transparent_65%),radial-gradient(ellipse_at_83%_10%,rgba(115,73,182,0.1),transparent_49%)]" aria-hidden />
      <canvas
        ref={canvasRef}
        className="absolute inset-0 z-0 h-full w-full cursor-grab touch-none outline-none active:cursor-grabbing focus-visible:ring-2 focus-visible:ring-cyan-200"
        aria-label="Interactive empty SIMVERSE planet. Use arrow keys to rotate and plus or minus keys to zoom."
        role="img"
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onLostPointerCapture={(event) => pointersRef.current.delete(event.pointerId)}
        onKeyDown={onKeyDown}
      />

      <header className="pointer-events-none relative z-10 flex flex-wrap items-center justify-between gap-3 px-4 pt-5 sm:px-8 sm:pt-7">
        <div className="pointer-events-auto flex items-center gap-3">
          <Link href="/" aria-label="Return to SIMVERSE home" className="grid size-10 place-items-center rounded-2xl border border-white/15 bg-[#07182c]/85 text-cyan-100 backdrop-blur transition hover:border-cyan-200/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300">
            <ArrowLeft size={17} aria-hidden />
          </Link>
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.23em] text-cyan-100/90"><Sparkles size={13} aria-hidden /> SIMVERSE</div>
            <p className="text-sm font-medium tracking-wide text-white/75">Planet Explorer</p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-cyan-300/25 bg-[#061b32]/85 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-cyan-100 backdrop-blur">
          <span className="size-1.5 rounded-full bg-cyan-300" aria-hidden />
          Orbital planet · Visual proof
        </div>
      </header>

      <main className="pointer-events-none relative z-10 flex flex-1 flex-col justify-between gap-6 px-4 pb-6 pt-8 sm:px-8 sm:pb-8">
        <div className="max-w-md">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.17em] text-cyan-200/85 sm:text-sm">A universe waiting to be created</p>
          <h1 className="font-display text-4xl font-bold leading-[1.08] tracking-tight text-white sm:text-6xl">Your world.<br /><span className="bg-gradient-to-r from-cyan-200 to-[#9d81e8] bg-clip-text text-transparent">No borders yet.</span></h1>
          <p className="mt-4 max-w-[19rem] text-sm leading-relaxed text-slate-200 sm:max-w-sm sm:text-base">An original planet, ready for the countries and stories we create.</p>
        </div>

        {!ready && (
          <div className="pointer-events-auto mx-auto max-w-sm rounded-2xl border border-white/15 bg-[#08182b]/90 p-5 text-center shadow-2xl backdrop-blur" role="status">
            <Globe2 size={28} className="mx-auto mb-2 text-cyan-300" aria-hidden />
            {error ? (
              <>
                <p className="font-semibold text-white">3D preview unavailable</p>
                <p className="mt-2 text-sm text-slate-300">{error}</p>
                <button type="button" className="mt-4 rounded-xl border border-cyan-200/40 px-4 py-2 text-sm font-semibold text-cyan-100 hover:bg-white/10" onClick={() => { setError(""); setRetry((v) => v + 1); }}>Retry 3D view</button>
                <p className="mt-3 text-xs text-slate-400">The fictional planet is currently empty. No countries have been published.</p>
              </>
            ) : <p className="text-sm text-slate-200">Preparing your orbital planet…</p>}
          </div>
        )}

        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
          <div className="pointer-events-auto max-w-[20rem] rounded-[22px] border border-white/15 bg-[#06162a]/90 p-4 shadow-xl backdrop-blur-md sm:p-5">
            <div className="mb-3 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-cyan-200"><Globe2 size={15} aria-hidden /> World status</div>
              <span className="rounded-full bg-amber-200/10 px-2 py-1 text-[10px] font-medium text-amber-100">Unallocated</span>
            </div>
            <div className="flex items-baseline gap-2"><strong className="font-display text-4xl font-semibold tabular-nums">0</strong><span className="text-sm text-slate-300">countries</span></div>
            <p className="mt-2 text-xs leading-relaxed text-slate-400">No countries have been published. The Country Creator will let us build our own territories.</p>
            <div className="mt-4 flex items-center gap-2 border-t border-white/10 pt-3 text-sm text-slate-300"><ShieldCheck size={15} className="text-cyan-300" aria-hidden /> No real-world geography</div>
            <Link href="/planet/create" className="mt-3 inline-flex w-full items-center justify-center rounded-xl border border-cyan-300/30 bg-cyan-300/10 px-3 py-2.5 text-sm font-semibold text-cyan-100 hover:border-cyan-200/60 hover:bg-cyan-300/15">
              <Plus size={15} className="mr-2" aria-hidden /> Country Creator (admin)
            </Link>
          </div>
          <div className="pointer-events-auto flex items-center gap-2 self-end rounded-2xl border border-white/15 bg-[#06162a]/90 p-2 backdrop-blur-md" aria-label="Planet controls">
            <button type="button" onClick={() => engineRef.current?.zoom(-0.55)} disabled={!ready} aria-label="Zoom in" title="Zoom in" className="grid size-10 place-items-center rounded-xl text-slate-100 transition hover:bg-white/10 disabled:opacity-40"><Plus size={18} aria-hidden /></button>
            <button type="button" onClick={() => engineRef.current?.zoom(0.55)} disabled={!ready} aria-label="Zoom out" title="Zoom out" className="grid size-10 place-items-center rounded-xl text-slate-100 transition hover:bg-white/10 disabled:opacity-40"><Minus size={18} aria-hidden /></button>
            <div className="h-6 w-px bg-white/15" />
            <button type="button" onClick={() => engineRef.current?.reset()} disabled={!ready} aria-label="Reset planet view" title="Reset view" className="grid size-10 place-items-center rounded-xl text-slate-100 transition hover:bg-white/10 disabled:opacity-40"><RotateCcw size={17} aria-hidden /></button>
            <button type="button" onClick={toggleOrbit} disabled={!ready || reducedMotion} aria-label={autoOrbit ? "Pause automatic rotation" : "Start automatic rotation"} title={reducedMotion ? "Disabled by reduced motion setting" : "Toggle auto-rotation"} className="grid size-10 place-items-center rounded-xl bg-cyan-300/15 text-cyan-100 transition hover:bg-cyan-300/25 disabled:opacity-40">{autoOrbit ? <Pause size={17} aria-hidden /> : <Play size={17} aria-hidden />}</button>
          </div>
        </div>
      </main>

      <div className="pointer-events-none relative z-10 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 bg-[#041020]/80 px-4 py-3 text-sm text-slate-300 backdrop-blur sm:px-8">
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-1.5"><Compass size={13} aria-hidden /> Drag to orbit</span>
          <span className="flex items-center gap-1.5"><ChevronDown size={13} aria-hidden /> Pinch or scroll to zoom</span>
        </div>
        <button type="button" onClick={() => setShowHelp((v) => !v)} aria-expanded={showHelp} className="pointer-events-auto flex items-center gap-1.5 rounded-md px-2 py-1 text-cyan-100 hover:bg-white/10">{showHelp ? <X size={14} aria-hidden /> : <Info size={14} aria-hidden />} {showHelp ? "Hide help" : "Controls & status"}</button>
      </div>
      {showHelp && (
        <aside className="pointer-events-auto absolute bottom-16 right-4 z-20 max-w-[min(21rem,calc(100%-2rem))] rounded-2xl border border-cyan-200/20 bg-[#06182c]/95 p-5 text-sm text-slate-200 shadow-2xl backdrop-blur">
          <div className="mb-2 flex items-center gap-2 font-semibold text-white"><Check size={16} className="text-cyan-300" aria-hidden /> How to explore</div>
          <p className="leading-relaxed">Drag a finger or mouse to rotate. Pinch, scroll or use the + and − controls to zoom. Focus the globe and use arrow keys to rotate. Reset anytime.</p>
          <p className="mt-3 text-xs leading-relaxed text-slate-400">This is Stage 1: a visual proof, not yet a country editor or living-world simulator. No countries are seeded.</p>
          <Link href="/earth" className="mt-3 inline-block text-xs text-cyan-200 underline underline-offset-4 hover:text-white">Open existing legacy Earth explorer</Link>
        </aside>
      )}
    </div>
  );
}
