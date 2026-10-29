"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as PointerEventReact } from "react";
import { ArrowLeft, Check, Compass, Eye, Globe2, Loader2, PenTool, Plus, RotateCcw, Save, ShieldCheck, Trash2, Undo2 } from "lucide-react";
import { createStarterTerritory, countryOutline, drawTerritory, type CreatorMode } from "@/lib/planet/creator-geometry";
import { validatePlanetGeometry, type PlanetGeometry, type PlanetPoint } from "@/lib/planet/geometry";
import type { SignaturePlanetRenderer } from "@/lib/planet/signature-planet-renderer";

type Revision = { id: string; revision: number; areaKm2: number; geometry: PlanetGeometry; label: PlanetPoint };
type Country = {
  id: string; name: string; slug: string; description: string | null;
  color: string; status: string; draft: Revision | null; published: Revision | null;
};
type JsonEnvelope<T> = { data?: T; error?: { message?: string } };

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { credentials: "same-origin", cache: "no-store", ...options });
  const body = await response.json().catch(() => null) as JsonEnvelope<T> | null;
  if (!response.ok || !body || !("data" in body)) {
    throw new Error(body?.error?.message ?? "The request could not be completed.");
  }
  return body.data as T;
}

function textError(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}

function formatArea(area: number): string {
  return new Intl.NumberFormat("en", { maximumFractionDigits: 1 }).format(area) + " km²";
}

const PRESET_COLOR = "#38DCE4";
const START_CENTER: PlanetPoint = [10, 7];

export function CountryCreator({ canPublish }: { canPublish: boolean }) {
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const planet = useRef<SignaturePlanetRenderer | null>(null);
  const pointers = useRef(new Map<number, { startX: number; startY: number; x: number; y: number }>());
  const [ready, setReady] = useState(false);
  const [renderError, setRenderError] = useState("");
  const [mode, setMode] = useState<CreatorMode>("PLACE");
  const [center, setCenter] = useState<PlanetPoint>(START_CENTER);
  const [radius, setRadius] = useState(650);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(PRESET_COLOR);
  const [shape, setShape] = useState<PlanetGeometry | null>(() => createStarterTerritory(START_CENTER, 650));
  const [drawn, setDrawn] = useState<PlanetPoint[]>([]);
  const [items, setItems] = useState<Country[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draftRevision, setDraftRevision] = useState<number | null>(null);
  const [publishedRevision, setPublishedRevision] = useState<number | null>(null);
  const [dirty, setDirty] = useState(true);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const geometry = mode === "DRAW" ? drawTerritory(drawn) : shape;
  const check = useMemo(() => {
    if (!geometry) return { area: null as number | null, message: "Add at least 3 points to close a country boundary." };
    try {
      return { area: validatePlanetGeometry(geometry).areaKm2, message: "" };
    } catch (issue: unknown) {
      return { area: null as number | null, message: textError(issue) };
    }
  }, [geometry]);

  const reload = useCallback(async () => {
    const listing = await api<{ countries: Country[] }>("/api/planet/admin/countries");
    setItems(listing.countries.filter(item => item.status !== "ARCHIVED"));
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload().catch(issue => { setLoading(false); setError(textError(issue)); });
  }, [reload]);

  useEffect(() => {
    const target = canvas.current;
    if (!target) return;
    let mounted = true;
    let engine: SignaturePlanetRenderer | null = null;
    let resizeObserver: ResizeObserver | null = null;
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      planet.current?.zoom(event.deltaY * 0.004);
    };
    target.addEventListener("wheel", handleWheel, { passive: false });
    void import("@/lib/planet/signature-planet-renderer").then(({ SignaturePlanetRenderer, checkPlanetWebGL }) => {
      if (!mounted) return;
      if (!checkPlanetWebGL()) throw new Error("3D graphics are not supported in this browser.");
      engine = new SignaturePlanetRenderer(target, true);
      planet.current = engine;
      resizeObserver = new ResizeObserver(entries => {
        const rect = entries[0]?.contentRect;
        if (rect) engine?.resize(rect.width, rect.height);
      });
      resizeObserver.observe(target);
      setReady(true);
    }).catch((issue: unknown) => {
      if (mounted) setRenderError(textError(issue));
    });
    return () => {
      mounted = false;
      target.removeEventListener("wheel", handleWheel);
      resizeObserver?.disconnect();
      engine?.dispose();
      planet.current = null;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    const points = mode === "DRAW" ? drawn : shape ? countryOutline(shape) : [];
    planet.current?.showTerritory(points, mode !== "DRAW", color);
  }, [ready, mode, drawn, shape, color]);

  function onPick(point: PlanetPoint) {
    if (mode === "ORBIT") return;
    setNotice("");
    setError("");
    if (mode === "DRAW") {
      if (drawn.length >= 48) { setError("The drawing limit is 48 points. Close the shape to continue."); return; }
      setDrawn(current => [...current, point]);
      setDirty(true);
      return;
    }
    const latitude = Math.max(-70, Math.min(70, point[1]));
    const next: PlanetPoint = [point[0], latitude];
    setCenter(next);
    setShape(createStarterTerritory(next, radius));
    setDirty(true);
  }

  function onPointerDown(event: PointerEventReact<HTMLCanvasElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { startX: event.clientX, startY: event.clientY, x: event.clientX, y: event.clientY });
  }
  function onPointerMove(event: PointerEventReact<HTMLCanvasElement>) {
    const previous = pointers.current.get(event.pointerId);
    if (!previous) return;
    const other = [...pointers.current].find(([id]) => id !== event.pointerId)?.[1];
    if (other) {
      const oldDistance = Math.hypot(previous.x - other.x, previous.y - other.y);
      const newDistance = Math.hypot(event.clientX - other.x, event.clientY - other.y);
      planet.current?.zoom((oldDistance - newDistance) * 0.012);
    } else {
      planet.current?.rotate(event.clientX - previous.x, event.clientY - previous.y);
    }
    pointers.current.set(event.pointerId, { ...previous, x: event.clientX, y: event.clientY });
  }
  function onPointerUp(event: PointerEventReact<HTMLCanvasElement>) {
    const current = pointers.current.get(event.pointerId);
    const isSinglePointer = pointers.current.size === 1;
    pointers.current.delete(event.pointerId);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (current && isSinglePointer && Math.hypot(event.clientX - current.startX, event.clientY - current.startY) < 6) {
      const hit = planet.current?.pick(event.clientX, event.clientY);
      if (hit) onPick(hit);
    }
  }
  function newCountry() {
    setActiveId(null);
    setDraftRevision(null);
    setPublishedRevision(null);
    setName("");
    setDescription("");
    setColor(PRESET_COLOR);
    setRadius(650);
    setCenter(START_CENTER);
    setShape(createStarterTerritory(START_CENTER, 650));
    setDrawn([]);
    setMode("PLACE");
    setDirty(true);
    setNotice("");
    setError("");
    planet.current?.reset();
  }
  function loadCountry(country: Country) {
    if (!country.draft) return;
    setActiveId(country.id);
    setName(country.name);
    setDescription(country.description ?? "");
    setColor(country.color);
    setShape(country.draft.geometry);
    setDraftRevision(country.draft.revision);
    setPublishedRevision(country.published?.revision ?? null);
    setMode("ORBIT");
    setDrawn([]);
    setDirty(false);
    setNotice("Draft loaded. Change the details or draw a new boundary.");
    setError("");
  }

  function startDrawing() {
    setMode("DRAW");
    setDrawn([]);
    setShape(null);
    setDirty(true);
    setError("");
    setNotice("Click the planet to add border points. Drag to rotate before placing more.");
  }
  function finishDrawing() {
    const candidate = drawTerritory(drawn);
    if (!candidate) { setError("Choose at least three points."); return; }
    try {
      validatePlanetGeometry(candidate);
      setShape(candidate);
      setMode("ORBIT");
      setDirty(true);
      setNotice("Border is ready to save. You can preview it before publishing.");
      setError("");
    } catch (issue: unknown) { setError(textError(issue)); }
  }

  async function saveDraft() {
    if (!geometry || check.area === null) { setError(check.message); return; }
    if (name.trim().length < 2) { setError("Enter a country name of at least two characters."); return; }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const payload = { name: name.trim(), description: description.trim(), color, geometry };
      const result = await api<Country>(activeId
        ? `/api/planet/admin/countries/${activeId}`
        : "/api/planet/admin/countries", {
        method: activeId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setActiveId(result.id);
      setDraftRevision(result.draft?.revision ?? null);
      setPublishedRevision(result.published?.revision ?? null);
      setShape(result.draft?.geometry ?? geometry);
      setMode("ORBIT");
      setDrawn([]);
      setDirty(false);
      setNotice("Draft saved in SIMVERSE. It is not public until you publish it.");
      await reload();
    } catch (issue: unknown) { setError(textError(issue)); }
    finally { setBusy(false); }
  }

  async function publish() {
    if (!activeId || dirty || !canPublish) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api<unknown>(`/api/planet/admin/countries/${activeId}/publish`, { method: "POST" });
      setPublishedRevision(draftRevision);
      setNotice("Country published successfully. Public planet overlays will be connected in Phase 4.");
      await reload();
    } catch (issue: unknown) { setError(textError(issue)); }
    finally { setBusy(false); }
  }
  function resetStarter() {
    setShape(createStarterTerritory(center, radius));
    setMode("PLACE");
    setDrawn([]);
    setDirty(true);
    setError("");
    setNotice("");
  }

  return (
    <div className="min-h-dvh bg-[#030b17] text-slate-100">
      <header className="border-b border-white/10 bg-[#071528] px-4 py-4 sm:px-8">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/planet" className="grid size-10 place-items-center rounded-xl border border-white/20 hover:bg-white/10" aria-label="Back to planet"><ArrowLeft size={18} /></Link>
            <div><p className="text-xs uppercase tracking-[0.16em] text-cyan-300">SIMVERSE · World Building</p><h1 className="font-display text-xl font-semibold sm:text-2xl">Country Creator</h1></div>
          </div>
          <span className="rounded-full border border-cyan-200/20 bg-cyan-300/10 px-3 py-2 text-xs text-cyan-100"><ShieldCheck size={14} className="mr-2 inline" />Private administrative workspace</span>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1600px] gap-5 px-3 py-5 lg:grid-cols-[minmax(330px,410px)_minmax(0,1fr)] lg:px-6">
        <section className="order-2 flex flex-col gap-4 lg:order-1" aria-label="Create your country">
          <div className="rounded-2xl border border-white/10 bg-[#0c1a2e] p-5">
            <div className="flex items-center justify-between gap-2"><h2 className="text-lg font-semibold">1. Name your country</h2><button type="button" className="rounded-lg border border-white/20 px-3 py-2 text-xs hover:bg-white/10" onClick={newCountry}><Plus size={13} className="mr-1 inline" /> New</button></div>
            <label className="mt-4 block text-sm text-slate-300" htmlFor="country-name">Country name</label>
            <input id="country-name" value={name} maxLength={80} onChange={e=>{setName(e.target.value);setDirty(true);}} placeholder="e.g. Galex" className="mt-2 w-full rounded-xl border border-white/15 bg-[#071225] px-3 py-3 text-base text-white outline-none focus:border-cyan-400" />
            <label className="mt-4 block text-sm text-slate-300" htmlFor="country-description">Short description (optional)</label>
            <textarea id="country-description" value={description} maxLength={1200} onChange={e=>{setDescription(e.target.value);setDirty(true);}} rows={2} placeholder="What makes this country special?" className="mt-2 w-full resize-y rounded-xl border border-white/15 bg-[#071225] px-3 py-3 text-sm text-white outline-none focus:border-cyan-400" />
            <label className="mt-4 flex items-center justify-between text-sm text-slate-300" htmlFor="country-color">Territory color <span className="font-mono text-xs text-slate-400">{color}</span></label>
            <input id="country-color" aria-label="Choose territory color" type="color" value={color} onChange={e=>{setColor(e.target.value);setDirty(true);}} className="mt-2 h-11 w-24 cursor-pointer rounded-lg border border-white/10 bg-transparent" />
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#0c1a2e] p-5">
            <h2 className="text-lg font-semibold">2. Shape the territory</h2>
            <p className="mt-1 text-sm leading-relaxed text-slate-300">Choose an easy starter shape, or draw a custom border by tapping the planet.</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button type="button" onClick={resetStarter} aria-pressed={mode==="PLACE"} className={`rounded-xl border px-3 py-3 text-sm font-medium ${mode==="PLACE"?"border-cyan-300 bg-cyan-300/15 text-cyan-100":"border-white/20 hover:bg-white/10"}`}><Compass size={16} className="mr-1 inline" /> Place & size</button>
              <button type="button" onClick={startDrawing} aria-pressed={mode==="DRAW"} className={`rounded-xl border px-3 py-3 text-sm font-medium ${mode==="DRAW"?"border-cyan-300 bg-cyan-300/15 text-cyan-100":"border-white/20 hover:bg-white/10"}`}><PenTool size={16} className="mr-1 inline" /> Draw border</button>
            </div>
            {mode==="PLACE" && (
              <div className="mt-4">
                <label className="flex justify-between text-sm text-slate-300" htmlFor="country-size">Approx. radius <strong className="text-cyan-200">{radius.toLocaleString()} km</strong></label>
                <input id="country-size" type="range" min={80} max={1800} step={20} value={radius} onChange={e=>{const next=Number(e.target.value);setRadius(next);setShape(createStarterTerritory(center,next));setDirty(true);}} className="mt-3 w-full accent-cyan-300" />
                <p className="mt-2 text-xs text-slate-400">Tap the sphere to reposition. Drag it to rotate.</p>
              </div>
            )}
            {mode==="DRAW" && (
              <div className="mt-4 rounded-xl border border-cyan-200/15 bg-cyan-200/5 p-3">
                <p className="text-sm text-cyan-100">{drawn.length} boundary points placed</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" onClick={()=>{setDrawn(v=>v.slice(0,-1));setDirty(true);}} disabled={!drawn.length} className="rounded-lg border border-white/20 px-3 py-2 text-sm disabled:opacity-40"><Undo2 size={14} className="mr-1 inline" /> Undo point</button>
                  <button type="button" onClick={finishDrawing} disabled={drawn.length<3} className="rounded-lg bg-cyan-300 px-3 py-2 text-sm font-semibold text-slate-950 disabled:opacity-40"><Check size={14} className="mr-1 inline" /> Finish border</button>
                </div>
              </div>
            )}
            {mode==="ORBIT" && <p className="mt-3 text-sm text-slate-300">Preview mode: rotate and inspect your country. Choose <strong>Place & size</strong> or <strong>Draw border</strong> to replace its shape.</p>}
            <div className="mt-4 rounded-xl border border-white/10 bg-[#071225] p-3">
              <div className="flex items-center justify-between gap-2"><span className="text-sm text-slate-300">Approximate surface area</span><strong className="text-sm text-white">{check.area===null?"Not ready":formatArea(check.area)}</strong></div>
              {check.message && <p className="mt-2 text-xs text-amber-200">{check.message}</p>}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#0c1a2e] p-5">
            <h2 className="text-lg font-semibold">3. Save and publish</h2>
            <p className="mt-2 text-sm text-slate-300">Save a private draft first. Publishing makes this country available through the fictional geography catalog.</p>
            <div className="mt-4 flex flex-col gap-2">
              <button type="button" disabled={busy||mode==="DRAW"||check.area===null||name.trim().length<2||!dirty} onClick={()=>void saveDraft()} className="flex items-center justify-center gap-2 rounded-xl bg-cyan-300 px-4 py-3 text-sm font-bold text-[#021321] disabled:cursor-not-allowed disabled:opacity-45">{busy?<Loader2 className="animate-spin" size={17}/>:<Save size={17}/>} {activeId?"Save new draft revision":"Save private draft"}</button>
              <button type="button" disabled={busy||!canPublish||!activeId||dirty||draftRevision===publishedRevision||!draftRevision} onClick={()=>void publish()} className="flex items-center justify-center gap-2 rounded-xl border border-emerald-300/40 bg-emerald-300/10 px-4 py-3 text-sm font-semibold text-emerald-100 disabled:cursor-not-allowed disabled:opacity-40"><Eye size={17}/> Publish country</button>
            </div>
            {!canPublish && <p className="mt-3 text-xs text-amber-200">Your account can save drafts but has not been granted publishing rights.</p>}
            {activeId && <p className="mt-3 text-xs text-slate-400">Saved country ID: <code className="break-all">{activeId}</code> · Draft v{draftRevision??"?"}{publishedRevision? ` · Published v${publishedRevision}`:""}</p>}
            {error && <p role="alert" className="mt-3 rounded-xl border border-rose-400/30 bg-rose-400/10 p-3 text-sm text-rose-200">{error}</p>}
            {notice && <p role="status" className="mt-3 rounded-xl border border-cyan-300/25 bg-cyan-300/10 p-3 text-sm text-cyan-100">{notice}</p>}
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#0c1a2e] p-5">
            <h2 className="text-lg font-semibold">Your saved countries</h2>
            <p className="mt-1 text-sm text-slate-400">Open a saved country to continue editing it.</p>
            {loading?<p className="mt-3 text-sm text-slate-400">Loading drafts…</p>:items.length===0?<p className="mt-3 text-sm text-slate-400">No saved countries yet.</p>:(
              <ul className="mt-3 space-y-2">
                {items.map(item=><li key={item.id}><button type="button" onClick={()=>loadCountry(item)} className="flex w-full items-center justify-between gap-3 rounded-xl border border-white/10 px-3 py-3 text-left hover:border-cyan-300/50"><span className="truncate text-sm font-medium">{item.name}</span><span className="text-xs text-slate-400">{item.status==="PUBLISHED"?"Published":"Draft"} · v{item.draft?.revision??"?"}</span></button></li>)}
              </ul>
            )}
          </div>
        </section>

        <section className="order-1 lg:order-2" aria-label="Interactive country boundary map">
          <div className="relative min-h-[470px] overflow-hidden rounded-3xl border border-cyan-200/15 bg-[#020812] lg:sticky lg:top-5 lg:min-h-[min(840px,calc(100dvh-3rem))]">
            <canvas ref={canvas} className="absolute inset-0 h-full w-full cursor-crosshair touch-none outline-none focus-visible:ring-2 focus-visible:ring-cyan-200" role="img" tabIndex={0} aria-label="Interactive planet. Tap to place the country or draw a border. Drag to rotate and pinch to zoom." onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={e=>{pointers.current.delete(e.pointerId);}} onLostPointerCapture={e=>{pointers.current.delete(e.pointerId);}} onKeyDown={e=>{if(e.key==="ArrowLeft"||e.key==="ArrowRight"||e.key==="ArrowUp"||e.key==="ArrowDown"){e.preventDefault();planet.current?.rotate(e.key==="ArrowLeft"?-24:e.key==="ArrowRight"?24:0,e.key==="ArrowUp"?-24:e.key==="ArrowDown"?24:0);}else if(e.key==="+"||e.key==="="||e.key==="-"){e.preventDefault();planet.current?.zoom(e.key==="-"?0.5:-0.5);}}}/>
            <div className="pointer-events-none absolute left-4 right-4 top-4 flex justify-between gap-3">
              <div className="rounded-xl border border-white/10 bg-[#06182c]/90 p-3 backdrop-blur"><div className="flex items-center gap-2 text-xs font-semibold text-cyan-200"><Globe2 size={16}/> Planet territory editor</div><p className="mt-1 max-w-xs text-xs text-slate-300">{mode==="DRAW"?"Tap to add border points":mode==="PLACE"?"Tap a position to move the country":"Drag to inspect your boundary"}</p></div>
              <button type="button" onClick={()=>planet.current?.reset()} className="pointer-events-auto grid size-10 place-items-center rounded-xl border border-white/20 bg-[#06182c]/90 hover:bg-white/10" aria-label="Reset globe view" title="Reset view"><RotateCcw size={18}/></button>
            </div>
            {!ready&&<div className="absolute inset-0 grid place-items-center bg-[#020812]/80 p-6 text-center text-sm text-slate-200">{renderError? `3D preview unavailable: ${renderError}. Use the form and the saved country list to continue.`:"Preparing the planet editor…"}</div>}
            <div className="pointer-events-none absolute bottom-4 left-4 right-4 flex flex-wrap justify-between gap-3 text-xs text-slate-300">
              <span className="rounded-xl bg-[#06182c]/90 px-3 py-2">Drag to rotate · Scroll or pinch to zoom</span>
              <span className="rounded-xl bg-[#06182c]/90 px-3 py-2">Preview only · No Earth geography</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
