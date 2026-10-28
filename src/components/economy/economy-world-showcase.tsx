"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, ArrowDown, ArrowRight, ArrowUp, Camera, Coins,
  Footprints, RefreshCw, RotateCw, ShieldAlert, Truck, Users, Wheat,
} from "lucide-react";
import {
  type NeighborhoodCameraMode, type NeighborhoodQuality, type NeighborhoodSelection,
} from "@/lib/earth/neighborhood/renderer";
import { type EconomyLabState } from "@/lib/economy/economy-lab";
import { visualSnapshot } from "@/lib/economy/visual-town";
import type { EconomyTownRenderer } from "@/lib/economy/town-renderer";

interface Town {
  id: string;
  name: string;
  revision: number;
  owner: boolean;
  state: EconomyLabState;
  totalSupply: number;
}
async function loadLab(id: string, action?: { kind: "ADVANCE"; revision: number }): Promise<Town> {
  const response = await fetch("/api/economy-labs/" + encodeURIComponent(id), {
    method: action ? "POST" : "GET", cache: "no-store", credentials: "same-origin",
    headers: action ? { "Content-Type": "application/json" } : undefined,
    body: action ? JSON.stringify(action) : undefined,
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error?.message ?? "Could not load this town");
  return data.data as Town;
}

const btn = "rounded-xl border border-white/20 bg-slate-950/80 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50";
const facilityIds = ["marina-b-001", "marina-b-006", "marina-b-012", "marina-b-018", "marina-b-027"];
const facilityTypes = ["farm", "mill", "market", "truck", "build"];

export function EconomyWorldShowcase({ initial }: { initial: Town }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<EconomyTownRenderer | null>(null);
  const [town, setTown] = useState(initial);
  const [ready, setReady] = useState(false);
  const [failure, setFailure] = useState("");
  const [retry, setRetry] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [cameraMode, setCameraMode] = useState<NeighborhoodCameraMode>("OVERVIEW");
  const [quality, setQuality] = useState<NeighborhoodQuality>("MEDIUM");
  const [selected, setSelected] = useState<NeighborhoodSelection>(null);
  const [position, setPosition] = useState({ x: 0, z: 0 });
  const snapshot = useMemo(() => visualSnapshot(town.state), [town.state]);

  useEffect(() => {
    let cancelled = false;
    const canvas = canvasRef.current;
    if (!canvas) return;
    void import("@/lib/economy/town-renderer").then(({ EconomyTownRenderer: Renderer }) => {
      if (cancelled) return;
      try {
        const probe = document.createElement("canvas");
        if (!probe.getContext("webgl2") && !probe.getContext("webgl")) {
          throw new Error("3D rendering is not available in this browser or device.");
        }
        const setting: NeighborhoodQuality = window.innerWidth < 740 ? "LOW" : "MEDIUM";
        const instance = new Renderer(
          canvas, setting, value => { if (!cancelled) setSelected(value); },
          (x, z) => { if (!cancelled) setPosition({ x, z }); },
          visualSnapshot(initial.state),
        );
        if (cancelled) { instance.dispose(); return; }
        engineRef.current = instance;
        instance.setCameraMode("OVERVIEW");
        setQuality(setting);
        setCameraMode("OVERVIEW");
        setFailure("");
        setReady(true);
      } catch (e) {
        setFailure(e instanceof Error ? e.message : "3D could not start");
      }
    }).catch(() => {
      if (!cancelled) setFailure("3D graphics could not load. You can still use the Economy Lab.");
    });
    return () => {
      cancelled = true;
      engineRef.current?.dispose();
      engineRef.current = null;
    };
    // Scene is rebuilt only after explicit retry; subsequent economy updates change its snapshot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retry]);

  useEffect(() => { engineRef.current?.setSnapshot(snapshot); }, [snapshot]);
  useEffect(() => { engineRef.current?.setCameraMode(cameraMode); }, [cameraMode]);
  useEffect(() => { engineRef.current?.setQuality(quality); }, [quality]);

  async function refresh(advance = false) {
    if (busy) return;
    setBusy(true); setMessage("");
    try {
      let next: Town;
      if (advance) {
        if (!town.owner) throw new Error("Only the town creator can advance economic time.");
        await loadLab(town.id, { kind: "ADVANCE", revision: town.revision });
      }
      next = await loadLab(town.id);
      setTown(next);
      setMessage(advance ? "A simulated day completed. The scene now reflects the latest economy." : "Latest town figures loaded.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Refresh failed");
    } finally {
      setBusy(false);
    }
  }
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
  const chosenFacility = selected ? facilityIds.indexOf(selected.id) : -1;
  const selectedBusiness = chosenFacility < 0 ? undefined :
    snapshot.businesses.find(b => b.id === facilityTypes[chosenFacility]);
  return <div className="mx-auto max-w-[1500px] space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <Link href="/economy/lab" className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline">
          <ArrowLeft className="size-4" /> Back to Economy Lab
        </Link>
        <h1 className="mt-1 font-display text-2xl font-semibold">{town.name} — Living Town Preview</h1>
        <p className="text-sm text-secondary">
          Day {snapshot.day} · Real simulated transactions, visualized in a small fictional 3D neighborhood
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button className="rounded-xl border border-border bg-surface px-4 py-2 text-sm font-semibold disabled:opacity-50"
          disabled={busy} onClick={() => void refresh(false)}>
          <RefreshCw className="mr-2 inline size-4"/> Refresh town
        </button>
        {town.owner ? <button className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          disabled={busy || snapshot.day >= 3650} onClick={() => void refresh(true)}>
          <RotateCw className="mr-2 inline size-4"/> Advance one day
        </button> : null}
      </div>
    </div>
    {message ? <p role="status" className="rounded-xl border border-border p-3 text-sm">{message}</p> : null}
    <div className="relative isolate overflow-hidden rounded-2xl border border-border bg-[#172a3a] shadow-xl">
      <canvas ref={canvasRef} aria-label="Interactive 3D visualization of the Greenfield Economy Lab"
        className="block h-[65vh] min-h-[420px] w-full touch-none sm:min-h-[540px]"
        style={{ display: failure ? "none" : "block" }}/>
      {failure ? <div className="flex min-h-[420px] flex-col items-center justify-center gap-4 p-8 text-center text-white">
        <ShieldAlert className="size-10 text-amber-300"/>
        <h2 className="text-xl font-semibold">3D mode unavailable</h2>
        <p className="max-w-lg text-sm text-slate-200">{failure}</p>
        <div className="flex flex-wrap gap-3">
          <button className={btn} onClick={() => { setFailure(""); setReady(false); setRetry(x => x + 1); }}>Retry graphics</button>
          <Link href="/economy/lab" className={btn}>Use 2D Economy Lab</Link>
        </div>
      </div> : <>
        {!ready ? <div className="pointer-events-none absolute inset-0 grid place-items-center bg-slate-950/75 text-sm font-semibold text-white">
          Preparing the 3D town…
        </div> : null}
        <div className="pointer-events-none absolute left-3 top-3 flex max-w-[calc(100%-1.5rem)] flex-wrap items-center gap-2">
          <span className="rounded-lg bg-slate-950/80 px-3 py-2 text-xs font-semibold text-white">
            <Users className="mr-1 inline size-3.5 text-teal-300"/>{snapshot.population} AI citizens
          </span>
          <span className="rounded-lg bg-slate-950/80 px-3 py-2 text-xs font-semibold text-white">
            <Wheat className="mr-1 inline size-3.5 text-teal-300"/>{snapshot.farmHarvest} harvested last day
          </span>
          <span className="rounded-lg bg-slate-950/80 px-3 py-2 text-xs font-semibold text-white">
            <Truck className="mr-1 inline size-3.5 text-teal-300"/>{snapshot.freightFees} GFC freight
          </span>
        </div>
        <div className="absolute right-3 top-[70px] flex flex-col items-end gap-2 sm:top-3">
          <div className="flex flex-wrap justify-end gap-2">
            <button className={btn} aria-pressed={cameraMode === "WALK"}
              onClick={() => setCameraMode("WALK")}><Footprints className="mr-1 inline size-4"/> Walk</button>
            <button className={btn} aria-pressed={cameraMode === "OVERVIEW"}
              onClick={() => setCameraMode("OVERVIEW")}><Camera className="mr-1 inline size-4"/> Aerial</button>
          </div>
          <select aria-label="Graphics quality" className={btn} value={quality}
            onChange={event => setQuality(event.target.value as NeighborhoodQuality)}>
            <option value="LOW">Low graphics</option>
            <option value="MEDIUM">Medium graphics</option>
            <option value="HIGH">High graphics</option>
          </select>
        </div>
        {selected ? <div className="absolute bottom-3 left-3 max-w-xs rounded-xl bg-slate-950/85 p-3 text-sm text-white">
          <p className="text-xs uppercase tracking-wide text-teal-200">Selected building</p>
          <h3 className="mt-1 font-semibold">{selectedBusiness?.label ?? selected.name}</h3>
          {selectedBusiness ? <p className="mt-1 text-xs text-slate-300">
            Business balance: {selectedBusiness.balance.toLocaleString("en-NG")} GFC
          </p> : <p className="mt-1 text-xs text-slate-300">Illustrative building · no ownership or property sale</p>}
          <button onClick={() => setSelected(null)} className="mt-2 text-xs text-teal-300 underline">Close</button>
        </div> : null}
        <div className="absolute bottom-3 right-3 flex flex-col items-center gap-1 sm:hidden">
          <button className={btn} aria-label="Walk forward" {...touch(1, 0)}><ArrowUp className="size-5"/></button>
          <div className="flex gap-1">
            <button className={btn} aria-label="Walk left" {...touch(0, -1)}><ArrowLeft className="size-5"/></button>
            <button className={btn} aria-label="Walk backward" {...touch(-1, 0)}><ArrowDown className="size-5"/></button>
            <button className={btn} aria-label="Walk right" {...touch(0, 1)}><ArrowRight className="size-5"/></button>
          </div>
        </div>
        <div className="pointer-events-none absolute bottom-3 left-3 hidden max-w-md rounded-xl bg-slate-950/70 px-3 py-2 text-xs text-white/90 sm:block">
          WASD / arrows to walk · Drag to look · Click buildings · Walk coordinates ({Math.round(position.x)}, {Math.round(position.z)})
        </div>
      </>}
    </div>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {[
        { label: "Simulated wages, last day", value: snapshot.wages.toLocaleString("en-NG") + " GFC", icon: Coins },
        { label: "Food bought, last day", value: String(snapshot.retailSales), icon: Wheat },
        { label: "Player shop sales, last day", value: String(snapshot.humanSales), icon: Users },
        { label: "Funded road projects", value: String(snapshot.roadsBuilt), icon: Truck },
      ].map(item => <div key={item.label} className="rounded-xl border border-border bg-surface p-4">
        <item.icon className="mb-2 size-5 text-accent"/>
        <p className="text-xs text-secondary">{item.label}</p>
        <p className="text-lg font-semibold">{item.value}</p>
      </div>)}
    </div>
    <p className="rounded-xl border border-border bg-surface px-4 py-3 text-xs text-secondary">
      Visual proof only. This is not sourced Lagos land or a photorealistic city.
      Small animated people represent the AI population; only advancing a day changes the saved economy.
      Ambient cars are decorative. The freight truck, crop condition, player-shop markers and construction
      indicators reflect the latest saved day and resources, not live physical deliveries or legal ownership.
    </p>
  </div>;
}
