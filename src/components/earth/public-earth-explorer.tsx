"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  AlertTriangle,
  Compass,
  Globe2,
  LoaderCircle,
  LockKeyhole,
  MapPin,
  Pause,
  Play,
  RotateCcw,
  Search,
  ShieldCheck,
} from "lucide-react";
import { apiFetch } from "@/lib/client/api";
import { createEarthOverviewStyle } from "@/lib/earth/map-style";
import type {
  EarthDestinationIntentResponse,
  PublicEarthCountry,
  PublicEarthOverview,
} from "@/lib/earth/public";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClasses } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";

interface PublicEarthExplorerProps {
  overview: PublicEarthOverview;
  authenticated: boolean;
  intentStatus?: "unavailable" | "expired";
}

interface SearchResponse {
  items: PublicEarthCountry[];
  limit: number;
}

const HOME_CAMERA = { center: [8, 9] as [number, number], zoom: 1.35, pitch: 0, bearing: 0 };

function publicCountryCollection(countries: PublicEarthCountry[]) {
  return {
    type: "FeatureCollection" as const,
    features: countries.map((country) => ({
      type: "Feature" as const,
      id: country.id,
      properties: { id: country.id, name: country.name },
      geometry: { type: "Point" as const, coordinates: country.center },
    })),
  };
}

export function PublicEarthExplorer({
  overview,
  authenticated,
  intentStatus,
}: PublicEarthExplorerProps) {
  const router = useRouter();
  const mapElement = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState("");
  const [renderMs, setRenderMs] = useState<number | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [rotationEnabled, setRotationEnabled] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PublicEarthCountry[]>([]);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState(
    intentStatus
      ? "That saved Earth destination is no longer available. Explore the globe and choose a supported location again."
      : "",
  );
  const [gate, setGate] = useState<EarthDestinationIntentResponse | null>(null);

  const chooseCountry = useCallback(async (country: PublicEarthCountry) => {
    setMessage("");
    if (authenticated) {
      router.push(`/earth/geography?place=${encodeURIComponent(country.id)}`);
      return;
    }
    setBusy(country.id);
    const result = await apiFetch<EarthDestinationIntentResponse>("/api/earth/public/intents", {
      method: "POST",
      body: JSON.stringify({ placeId: country.id }),
    });
    setBusy("");
    if (result.error || !result.data) {
      setMessage(result.error?.message ?? "This destination could not be prepared.");
      return;
    }
    setGate(result.data);
  }, [authenticated, router]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      setReducedMotion(media.matches);
      if (media.matches) setRotationEnabled(false);
    };
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!mapElement.current || mapRef.current) return;
    let cancelled = false;
    const startedAt = performance.now();
    void import("maplibre-gl").then(({
      AttributionControl,
      Map,
      NavigationControl,
      setWorkerUrl,
    }) => {
      if (cancelled || !mapElement.current) return;
      try {
        const probe = document.createElement("canvas");
        if (!probe.getContext("webgl2") && !probe.getContext("webgl")) {
          throw new Error("WebGL is unavailable.");
        }
        setWorkerUrl(
          new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url).toString(),
        );
        const map = new Map({
          container: mapElement.current,
          style: createEarthOverviewStyle(overview),
          ...HOME_CAMERA,
          minZoom: 0.75,
          maxZoom: 8,
          attributionControl: false,
          dragRotate: true,
        });
        map.addControl(new NavigationControl({ visualizePitch: true }), "bottom-right");
        map.addControl(new AttributionControl({ compact: true }), "bottom-right");
        map.once("load", () => {
          if (cancelled) return;
          map.setProjection({ type: "globe" });
          map.setSky({
            "sky-color": "#02050c",
            "horizon-color": "#12364a",
            "fog-color": "#06192a",
            "sky-horizon-blend": 0.52,
            "horizon-fog-blend": 0.7,
            "fog-ground-blend": 0.55,
            "atmosphere-blend": 0.88,
          });
          map.addSource("supported-countries", {
            type: "geojson",
            data: publicCountryCollection(overview.countries),
          });
          map.addLayer({
            id: "supported-country-halo",
            type: "circle",
            source: "supported-countries",
            paint: {
              "circle-radius": 15,
              "circle-color": "#22d3ee",
              "circle-opacity": 0.14,
              "circle-blur": 0.3,
            },
          });
          map.addLayer({
            id: "supported-countries",
            type: "circle",
            source: "supported-countries",
            paint: {
              "circle-radius": 6,
              "circle-color": "#67e8f9",
              "circle-stroke-color": "#ecfeff",
              "circle-stroke-width": 1.5,
            },
          });
          map.on("click", "supported-countries", (event) => {
            const id = String(event.features?.[0]?.properties?.id ?? "");
            const country = overview.countries.find((item) => item.id === id);
            if (country) void chooseCountry(country);
          });
          map.on("mouseenter", "supported-countries", () => { map.getCanvas().style.cursor = "pointer"; });
          map.on("mouseleave", "supported-countries", () => { map.getCanvas().style.cursor = ""; });
          map.on("dragstart", () => setRotationEnabled(false));
          mapRef.current = map;
          setMapReady(true);
          setRenderMs(Math.round(performance.now() - startedAt));
          if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
            setRotationEnabled(true);
          }
        });
        map.on("error", (event) => {
          if (!cancelled) setMapError(event.error?.message ?? "The globe could not render.");
        });
      } catch {
        setMapError("WebGL is unavailable in this browser.");
      }
    }).catch(() => setMapError("MapLibre could not be loaded in this browser."));
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [chooseCountry, overview]);

  useEffect(() => {
    if (!mapReady || !rotationEnabled || reducedMotion) return;
    const interval = window.setInterval(() => {
      const map = mapRef.current;
      if (!map || document.hidden) return;
      const center = map.getCenter();
      map.jumpTo({ center: [center.lng + 0.08, center.lat] });
    }, 50);
    return () => window.clearInterval(interval);
  }, [mapReady, reducedMotion, rotationEnabled]);

  function resetCamera() {
    mapRef.current?.easeTo({
      ...HOME_CAMERA,
      duration: reducedMotion ? 0 : 800,
    });
  }

  async function submitSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = query.trim();
    if (!value) {
      setResults([]);
      return;
    }
    setBusy("search");
    setMessage("");
    const result = await apiFetch<SearchResponse>(
      `/api/earth/public/search?q=${encodeURIComponent(value)}&limit=8`,
    );
    setBusy("");
    if (result.error) {
      setMessage(result.error.message);
      return;
    }
    setResults(result.data?.items ?? []);
    if (!result.data?.items.length) {
      setMessage("That location is not in the current verified catalog. The globe still shows global land context.");
    }
  }

  const countryButton = (country: PublicEarthCountry) => (
    <button
      key={country.id}
      type="button"
      disabled={Boolean(busy)}
      onClick={() => void chooseCountry(country)}
      className="group flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-background/45 px-3 py-3 text-left transition hover:border-accent/50 hover:bg-accent-soft disabled:opacity-60"
    >
      <span className="flex min-w-0 items-center gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent">
          <MapPin className="size-4" aria-hidden />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-foreground">{country.name}</span>
          <span className="block text-xs text-muted">{country.isoAlpha3} · Verified catalog coverage</span>
        </span>
      </span>
      {busy === country.id
        ? <LoaderCircle className="size-4 shrink-0 animate-spin text-accent" />
        : <LockKeyhole className="size-4 shrink-0 text-muted transition group-hover:text-accent" />}
    </button>
  );

  return (
    <>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_21rem]">
        <section className="relative min-h-[34rem] overflow-hidden rounded-3xl border border-border-strong bg-[#020711] shadow-2xl sm:min-h-[42rem]">
          <div className="absolute inset-0 opacity-70 [background-image:radial-gradient(circle_at_20%_20%,rgba(34,211,238,0.13),transparent_32%),radial-gradient(circle_at_80%_70%,rgba(139,92,246,0.12),transparent_34%)]" aria-hidden />
          <div
            ref={mapElement}
            className="absolute inset-0 h-full w-full"
            aria-label="Interactive three-dimensional Earth globe"
            data-earth-globe-status={mapReady ? "ready" : mapError ? "fallback" : "loading"}
            data-render-ms={renderMs ?? undefined}
          />

          <div className="pointer-events-none absolute inset-x-4 top-4 z-10 flex flex-wrap items-start justify-between gap-3 sm:inset-x-5 sm:top-5">
            <div className="glass max-w-sm rounded-2xl border border-white/10 p-3 shadow-xl">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-accent">
                <Globe2 className="size-4" aria-hidden />Live Earth explorer
              </p>
              <p className="mt-1 text-xs text-secondary">
                Natural Earth global context · cyan markers show verified SIMVERSE coverage
              </p>
            </div>
            <div className="pointer-events-auto flex items-center gap-2 rounded-xl border border-white/10 bg-background/75 p-1.5 backdrop-blur-xl">
              <Button
                type="button"
                variant="icon"
                size="sm"
                onClick={resetCamera}
                aria-label="Reset Earth camera"
                title="Reset camera"
                disabled={!mapReady}
              >
                <RotateCcw className="size-4" />
              </Button>
              <Button
                type="button"
                variant="icon"
                size="sm"
                onClick={() => setRotationEnabled((value) => !value)}
                aria-label={rotationEnabled ? "Pause globe rotation" : "Rotate globe"}
                title={reducedMotion ? "Automatic motion is disabled by your system preference" : "Toggle rotation"}
                disabled={!mapReady || reducedMotion}
              >
                {rotationEnabled ? <Pause className="size-4" /> : <Play className="size-4" />}
              </Button>
            </div>
          </div>

          {!mapReady && !mapError ? (
            <div className="pointer-events-none absolute inset-0 z-[5] grid place-items-center">
              <div className="flex items-center gap-2 rounded-xl border border-border bg-background/85 px-4 py-3 text-sm text-secondary backdrop-blur">
                <LoaderCircle className="size-4 animate-spin text-accent" />Loading real-world geography…
              </div>
            </div>
          ) : null}
          {mapError ? (
            <div className="absolute inset-0 z-[6] grid place-items-center p-6">
              <div className="max-w-md rounded-2xl border border-warning/35 bg-background/95 p-6 text-center shadow-2xl">
                <AlertTriangle className="mx-auto size-8 text-warning" />
                <h2 className="mt-3 font-display text-lg font-semibold">Globe view unavailable</h2>
                <p className="mt-2 text-sm text-secondary">{mapError} The supported-location list remains fully usable.</p>
              </div>
            </div>
          ) : null}

          <div className="pointer-events-none absolute bottom-5 left-5 z-10 hidden max-w-xs rounded-xl border border-white/10 bg-background/70 px-3 py-2 text-[11px] text-secondary backdrop-blur sm:block">
            Drag to rotate · scroll or pinch to zoom · use the compass to reset bearing
          </div>
        </section>

        <aside className="space-y-4">
          <section className="rounded-2xl border border-border bg-surface/80 p-4 shadow-xl">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-lg font-semibold">Choose a destination</h2>
              <Badge variant="accent">{overview.countries.length} live</Badge>
            </div>
            <p className="mt-1 text-sm text-secondary">
              Public exploration shows safe overview data. Opening a protected place requires an account.
            </p>
            {authenticated ? (
              <Link href="/earth/geography?land=1" className={buttonClasses({ className: "mt-4 w-full justify-center" })}>
                <MapPin className="size-4" /> Explore virtual land plots
              </Link>
            ) : (
              <p className="mt-3 text-xs text-muted">Sign in and select a destination to explore available virtual land plots.</p>
            )}
            <form onSubmit={submitSearch} className="mt-4">
              <label htmlFor="public-earth-search" className="sr-only">Search supported countries</label>
              <div className="flex gap-2">
                <Input
                  id="public-earth-search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search countries"
                  maxLength={80}
                />
                <Button
                  type="submit"
                  variant="icon"
                  aria-label="Search supported Earth locations"
                  disabled={busy === "search"}
                >
                  {busy === "search" ? <LoaderCircle className="size-4 animate-spin" /> : <Search className="size-4" />}
                </Button>
              </div>
            </form>
            <div className="mt-4 space-y-2">
              {(results.length ? results : overview.countries).map(countryButton)}
            </div>
            {!overview.countries.length ? (
              <p className="mt-4 rounded-xl border border-warning/30 bg-warning-soft p-3 text-sm text-warning">
                Verified catalog locations are temporarily unavailable. Global overview navigation still works.
              </p>
            ) : null}
          </section>

          <section className="rounded-2xl border border-border bg-surface/70 p-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <ShieldCheck className="size-4 text-success" />Public-safe by design
            </h2>
            <ul className="mt-3 space-y-2 text-xs text-secondary">
              <li>Global land context is delivered as bounded, versioned vector tiles.</li>
              <li>Protected boundaries, hierarchy, workspaces and ownership data stay behind login.</li>
              <li>Saved destinations expire and are validated again after authentication.</li>
            </ul>
          </section>

          <section className="rounded-2xl border border-border bg-surface/70 p-4 text-xs text-secondary">
            <p className="font-semibold text-foreground">Map data</p>
            <p className="mt-1">{overview.attribution} {overview.scale} · {overview.sourceVersion}</p>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
              <a href={overview.sourceUrl} target="_blank" rel="noreferrer" className="text-accent hover:underline">Source</a>
              <a href={overview.licenseUrl} target="_blank" rel="noreferrer" className="text-accent hover:underline">{overview.licenseName}</a>
            </div>
          </section>

          {message ? (
            <p role="status" className="rounded-xl border border-warning/30 bg-warning-soft p-3 text-sm text-warning">
              {message}
            </p>
          ) : null}
        </aside>
      </div>

      <Modal
        open={Boolean(gate)}
        onClose={() => setGate(null)}
        title={gate ? `Open ${gate.destination.name} in SIMVERSE Earth` : "Open Earth destination"}
        description="Sign in or create an account to view protected source details and continue through the verified geographic hierarchy."
        footer={gate ? (
          <>
            <Link href={gate.loginHref} className={buttonClasses({ variant: "secondary" })}>Log in</Link>
            <Link href={gate.registerHref} className={buttonClasses()}>Create account</Link>
          </>
        ) : null}
      >
        <div className="rounded-xl border border-border bg-background/60 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold"><Compass className="size-4 text-accent" />Destination preserved securely</p>
          <p className="mt-2 text-xs text-secondary">
            The signed intent expires at {gate ? new Date(gate.expiresAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}. After authentication, the server checks the destination and your active workspace again.
          </p>
        </div>
      </Modal>
    </>
  );
}
