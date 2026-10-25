"use client";

import { useEffect, useRef, useState } from "react";
import type { GeoJSONSource, Map as MapLibreMap, StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { AlertTriangle, Database, Globe2, LoaderCircle, MapPin, Search } from "lucide-react";
import { apiFetch } from "@/lib/client/api";
import type { EarthBoundaryView, EarthPlaceSummary } from "@/lib/earth/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface GeographyExplorerProps {
  initialCountries: EarthPlaceSummary[];
  initialPlaceCount: number;
  datasetLabels: string[];
}

interface PlaceListResponse {
  items: EarthPlaceSummary[];
  total: number;
  limit: number;
}

interface BoundaryResponse {
  feature: EarthBoundaryView;
  bytes: number;
  maxBytes: number;
}

const emptyGlobeStyle: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [
    { id: "earth-background", type: "background", paint: { "background-color": "#071323" } },
  ],
};

function qualityLabel(value: string) {
  return value.toLowerCase().replaceAll("_", " ");
}

export function GeographyExplorer({ initialCountries, initialPlaceCount, datasetLabels }: GeographyExplorerProps) {
  const mapElement = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState("");
  const [selected, setSelected] = useState<EarthPlaceSummary | null>(null);
  const [selectedFeature, setSelectedFeature] = useState<EarthBoundaryView | null>(null);
  const [subdivisions, setSubdivisions] = useState<EarthPlaceSummary[]>([]);
  const [localities, setLocalities] = useState<EarthPlaceSummary[]>([]);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<EarthPlaceSummary[]>([]);
  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!mapElement.current || mapRef.current) return;
    let cancelled = false;
    void import("maplibre-gl").then(({ Map, NavigationControl, setWorkerUrl }) => {
      if (cancelled || !mapElement.current) return;
      // MapLibre v6 ships its worker separately. This static URL lets Next's
      // Turbopack emit the matching worker as a hashed same-origin asset.
      setWorkerUrl(
        new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url).toString(),
      );
      const map = new Map({
        container: mapElement.current,
        style: emptyGlobeStyle,
        center: [8, 9],
        zoom: 1.6,
        attributionControl: false,
      });
      map.addControl(new NavigationControl({ visualizePitch: true }), "top-right");
      map.once("load", () => {
        map.setProjection({ type: "globe" });
        map.addSource("selected-geography", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
        map.addLayer({
          id: "selected-fill",
          type: "fill",
          source: "selected-geography",
          filter: ["==", ["geometry-type"], "Polygon"],
          paint: { "fill-color": "#22d3ee", "fill-opacity": 0.32 },
        });
        map.addLayer({
          id: "selected-outline",
          type: "line",
          source: "selected-geography",
          filter: ["==", ["geometry-type"], "Polygon"],
          paint: { "line-color": "#67e8f9", "line-width": 2.5 },
        });
        map.addLayer({
          id: "selected-point",
          type: "circle",
          source: "selected-geography",
          filter: ["==", ["geometry-type"], "Point"],
          paint: {
            "circle-radius": 8,
            "circle-color": "#fbbf24",
            "circle-stroke-color": "#fff7d6",
            "circle-stroke-width": 2,
          },
        });
        mapRef.current = map;
        setMapReady(true);
      });
      map.on("error", (event) => {
        if (!cancelled) setMapError(event.error?.message ?? "The globe could not render.");
      });
    }).catch(() => setMapError("WebGL or MapLibre is unavailable in this browser."));
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map || !selected || !selectedFeature) return;
    const source = map.getSource("selected-geography") as GeoJSONSource | undefined;
    source?.setData(selectedFeature as Parameters<GeoJSONSource["setData"]>[0]);
    if (selected.bbox) {
      map.fitBounds([
        [selected.bbox[0], selected.bbox[1]],
        [selected.bbox[2], selected.bbox[3]],
      ], {
        padding: 70,
        duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 700,
        maxZoom: selected.kind === "COUNTRY" ? 5 : 8,
      });
    } else if (selected.label) {
      map.easeTo({ center: selected.label, zoom: 9, duration: 0 });
    }
  }, [mapReady, selected, selectedFeature]);

  async function showPlace(place: EarthPlaceSummary) {
    setBusyId(place.id);
    setMessage("");
    const boundary = await apiFetch<BoundaryResponse>(`/api/earth/geography/places/${place.id}/boundary`);
    if (boundary.error || !boundary.data) {
      setMessage(boundary.error?.message ?? "Boundary could not be loaded.");
      setBusyId("");
      return;
    }
    setSelected(place);
    setSelectedFeature(boundary.data.feature);
    const children = await apiFetch<PlaceListResponse>(`/api/earth/geography/places?parentId=${encodeURIComponent(place.id)}&limit=100`);
    const items = children.data?.items ?? [];
    if (place.kind === "COUNTRY") {
      setSubdivisions(items.filter((item) => item.kind === "ADMIN1"));
      setLocalities([]);
    } else {
      setLocalities(items.filter((item) => ["CITY", "TOWN", "LOCALITY"].includes(item.kind)));
    }
    setBusyId("");
  }

  async function submitSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = search.trim();
    if (!query) {
      setSearchResults([]);
      return;
    }
    setBusyId("search");
    const result = await apiFetch<PlaceListResponse>(`/api/earth/geography/places?q=${encodeURIComponent(query)}&limit=20`);
    setBusyId("");
    if (result.error) {
      setMessage(result.error.message);
      return;
    }
    setSearchResults(result.data?.items ?? []);
    setMessage(result.data?.items.length ? "" : "No supported place matched that name.");
  }

  const placeButton = (place: EarthPlaceSummary) => (
    <button
      key={place.id}
      type="button"
      onClick={() => void showPlace(place)}
      disabled={Boolean(busyId)}
      className="flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-surface px-3 py-2.5 text-left transition hover:border-accent/50 hover:bg-surface-hover disabled:opacity-60"
    >
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium text-foreground">{place.name}</span>
        <span className="block text-xs capitalize text-muted">{qualityLabel(place.boundaryQuality)}</span>
      </span>
      {busyId === place.id ? <LoaderCircle className="size-4 animate-spin text-accent" /> : <MapPin className="size-4 shrink-0 text-secondary" />}
    </button>
  );

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <section className="overflow-hidden rounded-2xl border border-border bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-foreground">MapLibre globe proof</p>
            <p className="text-xs text-muted">Actual pinned WGS84 source geometry · internal authenticated tool</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="accent">{initialPlaceCount} places</Badge>
            <Badge variant={mapReady ? "success" : "warning"}>{mapReady ? "Globe ready" : "Loading WebGL"}</Badge>
          </div>
        </div>
        <div className="relative h-[34rem] min-h-[28rem] w-full bg-[#071323]">
          <div ref={mapElement} className="h-full w-full" aria-label="Interactive geography globe" />
          {!mapReady && !mapError ? (
            <div className="pointer-events-none absolute inset-0 grid place-items-center text-sm text-secondary">
              <span className="flex items-center gap-2"><LoaderCircle className="size-4 animate-spin" />Preparing globe…</span>
            </div>
          ) : null}
          {mapError ? (
            <div className="absolute inset-x-4 bottom-4 rounded-xl border border-warning/30 bg-background/90 p-3 text-sm text-warning">
              {mapError} Use the place lists to inspect the same sourced hierarchy.
            </div>
          ) : null}
        </div>
        <div className="border-t border-border px-4 py-3 text-xs text-muted">
          {datasetLabels.join(" · ") || "No active dataset. Run the Nigeria import command."}
        </div>
      </section>

      <aside className="space-y-4">
        <form onSubmit={submitSearch} className="rounded-2xl border border-border bg-surface p-4">
          <label htmlFor="earth-search" className="mb-2 block text-sm font-medium text-foreground">Search supported places</label>
          <div className="flex gap-2">
            <Input id="earth-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nigeria or Lagos" maxLength={100} />
            <Button type="submit" variant="icon" aria-label="Search geography" disabled={busyId === "search"}>
              {busyId === "search" ? <LoaderCircle className="size-4 animate-spin" /> : <Search className="size-4" />}
            </Button>
          </div>
          {searchResults.length ? <div className="mt-3 space-y-2">{searchResults.map(placeButton)}</div> : null}
        </form>

        {initialCountries.length ? (
          <section className="rounded-2xl border border-border bg-surface p-4">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold"><Globe2 className="size-4 text-accent" />Countries</h2>
            <div className="space-y-2">{initialCountries.map(placeButton)}</div>
          </section>
        ) : (
          <section className="rounded-2xl border border-warning/30 bg-warning-soft p-4">
            <h2 className="flex items-center gap-2 font-semibold text-warning"><Database className="size-4" />Import required</h2>
            <p className="mt-2 text-sm text-secondary">Run <code>npm run earth:import:nigeria</code> after applying the Prisma schema.</p>
          </section>
        )}

        {subdivisions.length ? (
          <section className="rounded-2xl border border-border bg-surface p-4">
            <h2 className="mb-3 text-sm font-semibold">States and first-level regions</h2>
            <div className="max-h-72 space-y-2 overflow-y-auto pr-1">{subdivisions.map(placeButton)}</div>
          </section>
        ) : null}

        {localities.length ? (
          <section className="rounded-2xl border border-border bg-surface p-4">
            <h2 className="mb-3 text-sm font-semibold">Supported localities</h2>
            <div className="space-y-2">{localities.map(placeButton)}</div>
          </section>
        ) : null}

        {selected ? (
          <section className="rounded-2xl border border-accent/30 bg-accent-soft p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-accent">Selected</p>
                <h2 className="mt-1 text-lg font-semibold">{selected.name}</h2>
              </div>
              <Badge variant={selected.boundaryQuality === "POINT_ONLY" ? "warning" : "success"}>{qualityLabel(selected.boundaryQuality)}</Badge>
            </div>
            <dl className="mt-3 space-y-2 text-xs text-secondary">
              <div className="flex justify-between gap-3"><dt>Type</dt><dd>{selected.kind}</dd></div>
              <div className="flex justify-between gap-3"><dt>CRS</dt><dd>{selected.coordinateReferenceSystem}</dd></div>
              <div className="flex justify-between gap-3"><dt>Version</dt><dd className="max-w-48 truncate" title={selected.dataset.version}>{selected.dataset.version}</dd></div>
            </dl>
            {selected.boundaryQuality === "POINT_ONLY" ? (
              <p className="mt-3 flex gap-2 rounded-lg bg-warning-soft p-2 text-xs text-warning">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />No validated locality boundary is present. The map shows the sourced point only.
              </p>
            ) : null}
            <p className="mt-3 text-xs text-muted">{selected.dataset.attribution} · {selected.dataset.licenseName}</p>
          </section>
        ) : null}

        {message ? <p role="status" className="rounded-xl border border-warning/30 bg-warning-soft p-3 text-sm text-warning">{message}</p> : null}
      </aside>
    </div>
  );
}
