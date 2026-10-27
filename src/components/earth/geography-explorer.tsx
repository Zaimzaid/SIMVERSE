"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  AlertTriangle,
  ChevronRight,
  Database,
  Globe2,
  Grid3X3,
  List,
  LoaderCircle,
  Map as MapIcon,
  MapPin,
  RotateCcw,
  Search,
} from "lucide-react";
import { apiFetch } from "@/lib/client/api";
import type { EarthParcelView, EarthZoneDetail, EarthZoneSummary } from "@/lib/earth/land";
import { EMPTY_FEATURE_COLLECTION, createEarthOverviewStyle } from "@/lib/earth/map-style";
import { EARTH_OVERVIEW_V1 } from "@/lib/earth/public";
import type { EarthBoundaryView, EarthPlaceDetail, EarthPlaceSummary } from "@/lib/earth/types";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClasses } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface GeographyExplorerProps {
  initialCountries: EarthPlaceSummary[];
  initialPlaceCount: number;
  datasetLabels: string[];
  initialSelection?: EarthPlaceSummary | null;
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

interface PlaceDetailResponse {
  place: EarthPlaceDetail;
}

interface ZoneListResponse {
  items: EarthZoneSummary[];
  limit: number;
}

interface ZoneDetailResponse {
  zone: EarthZoneDetail;
}

interface ParcelListResponse {
  items: EarthParcelView[];
  nextCursor: string | null;
  limit: number;
  scannedCandidates: number;
}

type LandView = "map" | "list";
type GeoJsonData = Parameters<GeoJSONSource["setData"]>[0];

function featureCollection(features: Array<Record<string, unknown>>): GeoJsonData {
  return { type: "FeatureCollection", features } as GeoJsonData;
}

function updateMapSource(map: MapLibreMap | null, id: string, data: GeoJsonData) {
  (map?.getSource(id) as GeoJSONSource | undefined)?.setData(data);
}

function qualityLabel(value: string) {
  return value.toLowerCase().replaceAll("_", " ");
}

export function GeographyExplorer({
  initialCountries,
  initialPlaceCount,
  datasetLabels,
  initialSelection = null,
}: GeographyExplorerProps) {
  const mapElement = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState("");
  const [selected, setSelected] = useState<EarthPlaceSummary | null>(null);
  const [selectedFeature, setSelectedFeature] = useState<EarthBoundaryView | null>(null);
  const [subdivisions, setSubdivisions] = useState<EarthPlaceSummary[]>([]);
  const [localities, setLocalities] = useState<EarthPlaceSummary[]>([]);
  const [hierarchy, setHierarchy] = useState<EarthPlaceSummary[]>([]);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<EarthPlaceSummary[]>([]);
  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState("");
  const [zones, setZones] = useState<EarthZoneSummary[]>([]);
  const [zoneCatalogLoaded, setZoneCatalogLoaded] = useState(false);
  const [activeZone, setActiveZone] = useState<EarthZoneDetail | null>(null);
  const [parcels, setParcels] = useState<EarthParcelView[]>([]);
  const [selectedParcel, setSelectedParcel] = useState<EarthParcelView | null>(null);
  const [landView, setLandView] = useState<LandView>("map");
  const [landBusy, setLandBusy] = useState(false);
  const [landMessage, setLandMessage] = useState("");
  const [nextParcelCursor, setNextParcelCursor] = useState<string | null>(null);
  const [mapZoom, setMapZoom] = useState(1.6);
  const parcelQueryRef = useRef<{ bbox: string; zoom: number } | null>(null);
  const parcelsRef = useRef<EarthParcelView[]>([]);
  const selectParcelRef = useRef<(id: string) => void>(() => undefined);

  parcelsRef.current = parcels;
  selectParcelRef.current = (id) => {
    setSelectedParcel(parcelsRef.current.find((item) => item.id === id) ?? null);
  };

  useEffect(() => {
    if (!mapElement.current || mapRef.current) return;
    let cancelled = false;
    void import("maplibre-gl").then(({ AttributionControl, Map, NavigationControl, setWorkerUrl }) => {
      if (cancelled || !mapElement.current) return;
      try {
        const probe = document.createElement("canvas");
        if (!probe.getContext("webgl2") && !probe.getContext("webgl")) {
          throw new Error("WebGL is unavailable.");
        }
        // MapLibre v6 ships its worker separately. This static URL lets Next's
        // Turbopack emit the matching worker as a hashed same-origin asset.
        setWorkerUrl(
          new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url).toString(),
        );
        const map = new Map({
          container: mapElement.current,
          style: createEarthOverviewStyle(EARTH_OVERVIEW_V1),
          center: [8, 9],
          zoom: 1.6,
          attributionControl: false,
        });
        map.addControl(new NavigationControl({ visualizePitch: true }), "top-right");
        map.addControl(new AttributionControl({ compact: true }), "bottom-right");
        map.once("load", () => {
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
          map.addSource("selected-geography", {
            type: "geojson",
            data: EMPTY_FEATURE_COLLECTION,
          });
          map.addLayer({
            id: "selected-fill",
            type: "fill",
            source: "selected-geography",
            filter: ["==", ["geometry-type"], "Polygon"],
            paint: { "fill-color": "#22d3ee", "fill-opacity": 0.34 },
          });
          map.addLayer({
            id: "selected-outline",
            type: "line",
            source: "selected-geography",
            filter: ["==", ["geometry-type"], "Polygon"],
            paint: { "line-color": "#a5f3fc", "line-width": 2.5 },
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
          map.addSource("development-zone", { type: "geojson", data: EMPTY_FEATURE_COLLECTION });
          map.addLayer({
            id: "development-zone-fill",
            type: "fill",
            source: "development-zone",
            paint: { "fill-color": "#f59e0b", "fill-opacity": 0.16 },
          });
          map.addLayer({
            id: "development-zone-outline",
            type: "line",
            source: "development-zone",
            paint: { "line-color": "#fbbf24", "line-width": 3 },
          });
          map.addSource("development-zone-exclusions", { type: "geojson", data: EMPTY_FEATURE_COLLECTION });
          map.addLayer({
            id: "development-zone-exclusions-fill",
            type: "fill",
            source: "development-zone-exclusions",
            paint: { "fill-color": "#ef4444", "fill-opacity": 0.32 },
          });
          map.addLayer({
            id: "development-zone-exclusions-outline",
            type: "line",
            source: "development-zone-exclusions",
            paint: { "line-color": "#fca5a5", "line-width": 2, "line-dasharray": [2, 1] },
          });
          map.addSource("virtual-parcels", { type: "geojson", data: EMPTY_FEATURE_COLLECTION });
          map.addLayer({
            id: "virtual-parcels-fill",
            type: "fill",
            source: "virtual-parcels",
            paint: { "fill-color": "#22d3ee", "fill-opacity": 0.16 },
          });
          map.addLayer({
            id: "virtual-parcels-outline",
            type: "line",
            source: "virtual-parcels",
            paint: { "line-color": "#67e8f9", "line-width": 1.25 },
          });
          map.addSource("selected-virtual-parcel", { type: "geojson", data: EMPTY_FEATURE_COLLECTION });
          map.addLayer({
            id: "selected-virtual-parcel-fill",
            type: "fill",
            source: "selected-virtual-parcel",
            paint: { "fill-color": "#a3e635", "fill-opacity": 0.5 },
          });
          map.addLayer({
            id: "selected-virtual-parcel-outline",
            type: "line",
            source: "selected-virtual-parcel",
            paint: { "line-color": "#ecfccb", "line-width": 3 },
          });
          map.on("click", "virtual-parcels-fill", (event) => {
            const parcelId = event.features?.[0]?.properties?.id;
            if (typeof parcelId === "string") selectParcelRef.current(parcelId);
          });
          map.on("mouseenter", "virtual-parcels-fill", () => { map.getCanvas().style.cursor = "pointer"; });
          map.on("mouseleave", "virtual-parcels-fill", () => { map.getCanvas().style.cursor = ""; });
          map.on("moveend", () => setMapZoom(map.getZoom()));
          mapRef.current = map;
          setMapZoom(map.getZoom());
          setMapReady(true);
        });
        map.on("error", (event) => {
          if (!cancelled) setMapError(event.error?.message ?? "The globe could not render.");
        });
      } catch {
        setMapError("WebGL is unavailable in this browser.");
      }
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

  useEffect(() => {
    updateMapSource(mapRef.current, "development-zone", activeZone
      ? featureCollection([{
        type: "Feature",
        id: activeZone.id,
        properties: { id: activeZone.id, name: activeZone.name },
        geometry: activeZone.geometry,
      }])
      : EMPTY_FEATURE_COLLECTION);
    updateMapSource(mapRef.current, "development-zone-exclusions", activeZone
      ? featureCollection(activeZone.exclusions.map((exclusion) => ({
        type: "Feature",
        id: exclusion.id,
        properties: { id: exclusion.id, name: exclusion.name, reason: exclusion.reason },
        geometry: exclusion.geometry,
      })))
      : EMPTY_FEATURE_COLLECTION);
  }, [activeZone, mapReady]);

  useEffect(() => {
    updateMapSource(mapRef.current, "virtual-parcels", parcels.length
      ? featureCollection(parcels.map((parcel) => ({
        type: "Feature",
        id: parcel.id,
        properties: {
          id: parcel.id,
          row: parcel.grid.row,
          column: parcel.grid.column,
          areaSquareMeters: parcel.areaSquareMeters,
        },
        geometry: parcel.geometry,
      })))
      : EMPTY_FEATURE_COLLECTION);
  }, [mapReady, parcels]);

  useEffect(() => {
    updateMapSource(mapRef.current, "selected-virtual-parcel", selectedParcel
      ? featureCollection([{
        type: "Feature",
        id: selectedParcel.id,
        properties: { id: selectedParcel.id },
        geometry: selectedParcel.geometry,
      }])
      : EMPTY_FEATURE_COLLECTION);
  }, [mapReady, selectedParcel]);

  const showPlace = useCallback(async (place: EarthPlaceSummary) => {
    setBusyId(place.id);
    setMessage("");
    setZones([]);
    setZoneCatalogLoaded(false);
    setActiveZone(null);
    setParcels([]);
    setSelectedParcel(null);
    setNextParcelCursor(null);
    setLandMessage("");
    parcelQueryRef.current = null;
    const [boundary, detail, children, landZones] = await Promise.all([
      apiFetch<BoundaryResponse>(`/api/earth/geography/places/${place.id}/boundary`),
      apiFetch<PlaceDetailResponse>(`/api/earth/geography/places/${place.id}`),
      apiFetch<PlaceListResponse>(`/api/earth/geography/places?parentId=${encodeURIComponent(place.id)}&limit=100`),
      apiFetch<ZoneListResponse>(`/api/earth/zones?placeId=${encodeURIComponent(place.id)}&includeDemonstration=true&limit=100`),
    ]);
    if (boundary.error || !boundary.data || detail.error || !detail.data) {
      setMessage(boundary.error?.message ?? detail.error?.message ?? "Location could not be loaded.");
      setBusyId("");
      return;
    }
    const selectedPlace = detail.data.place;
    setSelected(selectedPlace);
    setSelectedFeature(boundary.data.feature);
    const items = children.data?.items ?? [];
    setHierarchy(selectedPlace.hierarchy);
    if (selectedPlace.kind === "COUNTRY") {
      setSubdivisions(items.filter((item) => item.kind === "ADMIN1"));
      setLocalities([]);
    } else if (selectedPlace.kind === "ADMIN1") {
      setLocalities(items.filter((item) => ["CITY", "TOWN", "LOCALITY"].includes(item.kind)));
    } else {
      setLocalities([]);
    }
    if (children.error) setMessage(children.error.message);
    setZones(landZones.data?.items ?? []);
    setZoneCatalogLoaded(true);
    if (landZones.error) setLandMessage(landZones.error.message);
    setBusyId("");
  }, []);

  const initialSelectionLoaded = useRef(false);
  useEffect(() => {
    if (!initialSelection || initialSelectionLoaded.current) return;
    initialSelectionLoaded.current = true;
    void showPlace(initialSelection);
  }, [initialSelection, showPlace]);

  function returnToGlobe() {
    setSelected(null);
    setSelectedFeature(null);
    setHierarchy([]);
    setSubdivisions([]);
    setLocalities([]);
    setZones([]);
    setZoneCatalogLoaded(false);
    setActiveZone(null);
    setParcels([]);
    setSelectedParcel(null);
    setNextParcelCursor(null);
    setLandMessage("");
    parcelQueryRef.current = null;
    const source = mapRef.current?.getSource("selected-geography") as GeoJSONSource | undefined;
    source?.setData(EMPTY_FEATURE_COLLECTION);
    mapRef.current?.easeTo({
      center: [8, 9],
      zoom: 1.6,
      pitch: 0,
      bearing: 0,
      duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 700,
    });
  }

  async function loadParcelPage(
    zone: EarthZoneDetail,
    query: { bbox: string; zoom: number },
    cursor: string | null = null,
    append = false,
  ) {
    setLandBusy(true);
    setLandMessage("");
    const params = new URLSearchParams({
      bbox: query.bbox,
      zoom: String(query.zoom),
      limit: "200",
    });
    if (cursor) params.set("cursor", cursor);
    const result = await apiFetch<ParcelListResponse>(
      `/api/earth/zones/${zone.id}/parcels?${params.toString()}`,
    );
    setLandBusy(false);
    if (result.error || !result.data) {
      setLandMessage(result.error?.message ?? "Virtual plots could not be loaded.");
      return;
    }
    setParcels((current) => append ? [...current, ...result.data!.items] : result.data!.items);
    if (!append) setSelectedParcel(null);
    setNextParcelCursor(result.data.nextCursor);
    parcelQueryRef.current = query;
    if (!result.data.items.length && !append) {
      setLandMessage("No complete eligible virtual plots intersect this view.");
    }
  }

  async function showZone(zoneSummary: EarthZoneSummary) {
    setLandBusy(true);
    setLandMessage("");
    setParcels([]);
    setSelectedParcel(null);
    setNextParcelCursor(null);
    const result = await apiFetch<ZoneDetailResponse>(`/api/earth/zones/${zoneSummary.id}`);
    if (result.error || !result.data) {
      setLandBusy(false);
      setLandMessage(result.error?.message ?? "Development zone could not be loaded.");
      return;
    }
    const zone = result.data.zone;
    setActiveZone(zone);
    setLandView("map");
    const map = mapRef.current;
    let requestZoom = 18;
    if (map) {
      map.fitBounds([
        [zone.bbox[0], zone.bbox[1]],
        [zone.bbox[2], zone.bbox[3]],
      ], { padding: window.innerWidth < 640 ? 30 : 90, duration: 0, maxZoom: 18 });
      if (map.getZoom() < 16) map.setZoom(16);
      requestZoom = Math.floor(map.getZoom());
    }
    await loadParcelPage(zone, { bbox: zone.bbox.join(","), zoom: requestZoom });
  }

  async function loadVisibleParcels() {
    const map = mapRef.current;
    if (!activeZone || !map) return;
    const zoom = Math.floor(map.getZoom());
    if (zoom < 16) {
      setLandMessage("Zoom to level 16 or closer before loading virtual plots.");
      return;
    }
    const bounds = map.getBounds();
    const west = Math.max(bounds.getWest(), activeZone.bbox[0]);
    const south = Math.max(bounds.getSouth(), activeZone.bbox[1]);
    const east = Math.min(bounds.getEast(), activeZone.bbox[2]);
    const north = Math.min(bounds.getNorth(), activeZone.bbox[3]);
    if (west >= east || south >= north) {
      setLandMessage("Move the map over the selected development zone to load plots.");
      return;
    }
    await loadParcelPage(activeZone, { bbox: [west, south, east, north].join(","), zoom });
  }

  function chooseParcel(parcel: EarthParcelView) {
    setSelectedParcel(parcel);
    const map = mapRef.current;
    map?.easeTo({
      center: parcel.centroid,
      zoom: Math.max(map.getZoom(), 18),
      duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 450,
    });
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
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <section className="overflow-hidden rounded-2xl border border-border bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-foreground">Protected Earth explorer</p>
            <p className="text-xs text-muted">Pinned WGS84 catalog geometry over a versioned Natural Earth overview</p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/earth" className={buttonClasses({ variant: "ghost", size: "sm" })}>
              Public globe
            </Link>
            <Badge variant="accent">{initialPlaceCount} places</Badge>
            <Badge variant={mapReady ? "success" : "warning"}>{mapReady ? "Globe ready" : "Loading WebGL"}</Badge>
          </div>
        </div>
        <div className="relative h-[28rem] min-h-[26rem] w-full bg-[#071323] sm:h-[34rem]">
          <div ref={mapElement} className="h-full w-full" aria-label="Interactive protected geography and virtual parcel map" data-protected-earth-map={mapReady ? "ready" : mapError ? "fallback" : "loading"} />
          <div className="absolute left-3 top-3 z-10 rounded-xl border border-white/10 bg-background/75 p-1 backdrop-blur">
            <Button type="button" variant="icon" size="sm" onClick={returnToGlobe} aria-label="Return to full Earth globe" title="Return to globe" disabled={!mapReady}>
              <RotateCcw className="size-4" />
            </Button>
          </div>
          {!mapReady && !mapError ? (
            <div className="pointer-events-none absolute inset-0 grid place-items-center text-sm text-secondary">
              <span className="flex items-center gap-2"><LoaderCircle className="size-4 animate-spin" />Preparing globe…</span>
            </div>
          ) : null}
          {mapError ? (
            <div className="absolute inset-x-4 bottom-4 rounded-xl border border-warning/30 bg-background/90 p-3 text-sm text-warning">
              {mapError} Use the accessible place, development-zone and virtual-plot lists to inspect the same data.
            </div>
          ) : null}
          {activeZone && mapReady ? (
            <div className="absolute bottom-8 left-3 z-10 flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-background/85 p-2 text-xs backdrop-blur">
              <span className="px-1 text-secondary">Zoom {mapZoom.toFixed(1)}</span>
              <Button type="button" size="sm" variant="secondary" onClick={() => void loadVisibleParcels()} disabled={landBusy}>
                {landBusy ? <LoaderCircle className="size-3.5 animate-spin" /> : <Grid3X3 className="size-3.5" />}
                Load visible plots
              </Button>
            </div>
          ) : null}
        </div>
        <div className="border-t border-border px-4 py-3 text-xs text-muted">
          Made with Natural Earth · {datasetLabels.join(" · ") || "No active protected dataset. Run the Nigeria import command."}
        </div>
      </section>

      <aside className="space-y-4">
        {hierarchy.length ? (
          <nav aria-label="Geographic hierarchy" className="rounded-2xl border border-border bg-surface p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Location hierarchy</p>
            <ol className="flex flex-wrap items-center gap-1 text-sm">
              <li>
                <button type="button" onClick={returnToGlobe} className="rounded px-1.5 py-1 text-secondary hover:text-accent">Earth</button>
              </li>
              {hierarchy.map((place) => (
                <li key={place.id} className="flex items-center gap-1">
                  <ChevronRight className="size-3 text-muted" aria-hidden />
                  <button
                    type="button"
                    onClick={() => void showPlace(place)}
                    disabled={Boolean(busyId) || place.id === selected?.id}
                    aria-current={place.id === selected?.id ? "location" : undefined}
                    className="rounded px-1.5 py-1 text-secondary hover:text-accent disabled:text-foreground"
                  >
                    {place.name}
                  </button>
                </li>
              ))}
            </ol>
          </nav>
        ) : null}

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

        {selected?.kind === "ADMIN1" && zoneCatalogLoaded ? (
          <section className="rounded-2xl border border-warning/30 bg-surface p-4" data-earth-land-catalog="loaded">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-warning">Virtual land discovery</p>
                <h2 className="mt-1 text-sm font-semibold">Approved development zones</h2>
              </div>
              <Grid3X3 className="size-5 text-warning" aria-hidden />
            </div>
            <p className="mt-2 rounded-lg bg-warning-soft p-2 text-xs text-warning">
              SIMVERSE virtual plots grant no rights in real-world land. Zone geometry is platform policy data, not an official or cadastral boundary.
            </p>
            {zones.length ? (
              <div className="mt-3 space-y-2">
                {zones.map((zone) => (
                  <button
                    key={zone.id}
                    type="button"
                    onClick={() => void showZone(zone)}
                    disabled={landBusy}
                    aria-pressed={activeZone?.id === zone.id}
                    className="flex w-full items-start justify-between gap-3 rounded-xl border border-border bg-background px-3 py-2.5 text-left transition hover:border-warning/50 disabled:opacity-60 aria-pressed:border-warning"
                  >
                    <span>
                      <span className="block text-sm font-medium text-foreground">{zone.name}</span>
                      <span className="mt-0.5 block text-xs text-muted">{zone.zoningLabel} · {zone.cellSizeMeters[0]} m × {zone.cellSizeMeters[1]} m</span>
                    </span>
                    {zone.isDemonstration ? <Badge variant="warning">Synthetic demo</Badge> : <Badge variant="success">Active</Badge>}
                  </button>
                ))}
              </div>
            ) : (
              <div className="mt-3 rounded-xl border border-dashed border-border p-3">
                <p className="text-sm font-medium">No active development zones</p>
                <p className="mt-1 text-xs text-muted">No approved virtual plot inventory is published for this region.</p>
              </div>
            )}
            {landMessage && !activeZone ? (
              <p role="status" className="mt-3 rounded-lg bg-warning-soft p-2 text-xs text-warning">{landMessage}</p>
            ) : null}

            {activeZone ? (
              <div className="mt-4 border-t border-border pt-4" data-active-earth-zone={activeZone.id}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold">{activeZone.name}</h3>
                    <p className="text-xs text-muted">Version {activeZone.activeVersion} · {activeZone.grid.algorithmVersion}</p>
                  </div>
                  <div className="flex rounded-lg border border-border p-0.5" aria-label="Parcel view">
                    <button
                      type="button"
                      aria-pressed={landView === "map"}
                      onClick={() => setLandView("map")}
                      className="rounded-md p-1.5 text-muted aria-pressed:bg-accent-soft aria-pressed:text-accent"
                      aria-label="Show parcel map view"
                    ><MapIcon className="size-4" /></button>
                    <button
                      type="button"
                      aria-pressed={landView === "list"}
                      onClick={() => setLandView("list")}
                      className="rounded-md p-1.5 text-muted aria-pressed:bg-accent-soft aria-pressed:text-accent"
                      aria-label="Show parcel list view"
                    ><List className="size-4" /></button>
                  </div>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg bg-background p-2"><dt className="text-muted">Zoning</dt><dd className="mt-0.5 font-medium">{activeZone.restrictions.zoningLabel}</dd></div>
                  <div className="rounded-lg bg-background p-2"><dt className="text-muted">Eligible plots shown</dt><dd className="mt-0.5 font-medium" data-earth-parcel-count={parcels.length}>{parcels.length}</dd></div>
                </dl>
                {activeZone.isDemonstration ? (
                  <p className="mt-2 text-xs text-warning">Synthetic test geometry positioned in sourced Lagos State context. It is not real land inventory.</p>
                ) : null}

                {landView === "map" ? (
                  <p className="mt-3 text-xs text-secondary">Select an outlined plot on the map, or switch to the keyboard-accessible list.</p>
                ) : (
                  <div className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-1" aria-label="Visible virtual plots">
                    {parcels.map((parcel) => (
                      <button
                        key={parcel.id}
                        type="button"
                        onClick={() => chooseParcel(parcel)}
                        aria-pressed={selectedParcel?.id === parcel.id}
                        className="w-full rounded-lg border border-border bg-background p-2 text-left text-xs transition hover:border-accent/50 aria-pressed:border-accent aria-pressed:bg-accent-soft"
                      >
                        <span className="block truncate font-mono text-foreground">{parcel.id}</span>
                        <span className="mt-1 block text-muted">Grid {parcel.grid.column}, {parcel.grid.row} · {parcel.areaSquareMeters} m²</span>
                      </button>
                    ))}
                    {!parcels.length && !landBusy ? <p className="text-xs text-muted">No eligible plots are loaded for this view.</p> : null}
                  </div>
                )}
                {nextParcelCursor && parcelQueryRef.current ? (
                  <Button
                    type="button"
                    className="mt-3 w-full"
                    size="sm"
                    variant="secondary"
                    disabled={landBusy}
                    onClick={() => void loadParcelPage(activeZone, parcelQueryRef.current!, nextParcelCursor, true)}
                  >Load next 200 plots</Button>
                ) : null}
                {selectedParcel ? (
                  <div className="mt-3 rounded-xl border border-accent/30 bg-accent-soft p-3" data-selected-earth-parcel={selectedParcel.id}>
                    <p className="text-xs font-semibold uppercase tracking-wider text-accent">Selected virtual plot</p>
                    <p className="mt-1 break-all font-mono text-xs text-foreground">{selectedParcel.id}</p>
                    <dl className="mt-2 space-y-1 text-xs text-secondary">
                      <div className="flex justify-between gap-3"><dt>Area</dt><dd>{selectedParcel.areaSquareMeters} m²</dd></div>
                      <div className="flex justify-between gap-3"><dt>Dimensions</dt><dd>{selectedParcel.dimensionsMeters[0]} m × {selectedParcel.dimensionsMeters[1]} m</dd></div>
                      <div className="flex justify-between gap-3"><dt>Approx. centre</dt><dd>{selectedParcel.centroid[1].toFixed(6)}, {selectedParcel.centroid[0].toFixed(6)}</dd></div>
                      <div className="flex justify-between gap-3"><dt>Zoning</dt><dd>{selectedParcel.zoningLabel}</dd></div>
                    </dl>
                    <p className="mt-2 text-xs text-warning">Discovery only. Claiming, purchasing and ownership are unavailable.</p>
                  </div>
                ) : null}
                {landBusy ? <p role="status" className="mt-3 flex items-center gap-2 text-xs text-secondary"><LoaderCircle className="size-3.5 animate-spin" />Loading bounded virtual plots…</p> : null}
                {landMessage ? <p role="status" className="mt-3 rounded-lg bg-warning-soft p-2 text-xs text-warning">{landMessage}</p> : null}
              </div>
            ) : null}
          </section>
        ) : null}

        {selected ? (
          <section className="rounded-2xl border border-accent/30 bg-accent-soft p-4" data-selected-earth-place={selected.id}>
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
            <div className="mt-2 flex gap-3 text-xs">
              <a href={selected.dataset.sourceUrl} target="_blank" rel="noreferrer" className="text-accent hover:underline">Source</a>
              <a href={selected.dataset.licenseUrl} target="_blank" rel="noreferrer" className="text-accent hover:underline">License</a>
            </div>
          </section>
        ) : null}

        {message ? <p role="status" className="rounded-xl border border-warning/30 bg-warning-soft p-3 text-sm text-warning">{message}</p> : null}
      </aside>
    </div>
  );
}
