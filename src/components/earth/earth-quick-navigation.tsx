"use client";

import { useState } from "react";
import {
  Building2, ChevronDown, ChevronRight, Globe2, House, Layers3,
  MapPin, MapPinned, X,
} from "lucide-react";
import type { EarthPlaceSummary } from "@/lib/earth/types";
import type { EarthZoneSummary } from "@/lib/earth/land";

export type EarthQuickSection = "country" | "states" | "lgas" | "cities" | "zones" | "my-land";

interface EarthQuickNavigationProps {
  countries: EarthPlaceSummary[];
  hierarchy: EarthPlaceSummary[];
  selected: EarthPlaceSummary | null;
  states: EarthPlaceSummary[];
  lgas: EarthPlaceSummary[];
  cities: EarthPlaceSummary[];
  zones: EarthZoneSummary[];
  busy: boolean;
  onChoosePlace: (place: EarthPlaceSummary) => void;
  onChooseZone: (zone: EarthZoneSummary) => void;
  onOpenDetails: () => void;
}

/**
 * Compact Earth navigation lives next to the map, not in the global platform
 * sidebar. It never guesses account nationality or synthesizes property records.
 */
export function EarthQuickNavigation({
  countries, hierarchy, selected, states, lgas, cities, zones,
  busy, onChoosePlace, onChooseZone, onOpenDetails,
}: EarthQuickNavigationProps) {
  const [open, setOpen] = useState(false);
  const [section, setSection] = useState<EarthQuickSection>("country");
  const activeCountry = hierarchy.find((place) => place.kind === "COUNTRY")
    ?? (selected?.kind === "COUNTRY" ? selected : null)
    ?? (countries.length === 1 ? countries[0] : null);
  const activeState = hierarchy.find((place) => place.kind === "ADMIN1")
    ?? (selected?.kind === "ADMIN1" ? selected : null);

  const sections = [
    { key: "country", label: "My Country", icon: Globe2 },
    { key: "states", label: "States", icon: MapPinned },
    { key: "lgas", label: "LGAs", icon: Layers3 },
    { key: "cities", label: "Cities / Towns", icon: Building2 },
    { key: "zones", label: "Development Zones", icon: MapPin },
    { key: "my-land", label: "My Land", icon: House },
  ] as const;

  function choosePlace(place: EarthPlaceSummary) {
    onChoosePlace(place);
    setOpen(false);
  }
  function chooseZone(zone: EarthZoneSummary) {
    onChooseZone(zone);
    setOpen(false);
    onOpenDetails();
  }
  function placeButtons(places: EarthPlaceSummary[]) {
    return <div className="max-h-56 space-y-1 overflow-y-auto pr-1">
      {places.map((place) => (
        <button key={place.id} type="button" disabled={busy}
          onClick={() => choosePlace(place)}
          className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs text-foreground transition hover:bg-surface-hover disabled:opacity-50">
          <span className="truncate">{place.name}</span>
          <ChevronRight className="size-3.5 shrink-0 text-muted" aria-hidden />
        </button>
      ))}
    </div>;
  }
  function changeSection(key: EarthQuickSection) {
    setSection(key);
    setOpen(true);
  }

  return (
    <div className="relative" data-earth-quick-navigation>
      <button type="button" aria-expanded={open} aria-controls="earth-quick-navigation-panel"
        onClick={() => setOpen((value) => !value)}
        className="flex max-w-full items-center gap-2 rounded-xl border border-accent/30 bg-accent-soft px-3 py-2 text-left text-sm text-foreground transition hover:border-accent"
        data-earth-country-chip>
        <Globe2 className="size-4 shrink-0 text-accent" aria-hidden />
        <span className="min-w-0">
          <span className="block text-[10px] leading-none text-secondary">My Country</span>
          <span className="block truncate font-semibold">{activeCountry?.name ?? "Choose country"}</span>
        </span>
        <ChevronDown className="size-4 shrink-0 text-accent" aria-hidden />
      </button>

      {open ? (
        <div id="earth-quick-navigation-panel" role="region"
          aria-label="Earth quick navigation"
          className="absolute left-0 top-[calc(100%+0.5rem)] z-50 w-[min(21rem,calc(100vw-3rem))] overflow-hidden rounded-2xl border border-border-strong bg-surface p-3 shadow-2xl"
          data-earth-quick-menu="expanded">
          <div className="flex items-center justify-between gap-2 border-b border-border pb-2">
            <div>
              <p className="text-sm font-semibold text-foreground">Explore SIMVERSE Earth</p>
              <p className="text-xs text-muted">Jump to places without repeated zooming</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close Earth navigation"
              className="rounded-lg p-2 text-muted hover:bg-surface-hover hover:text-foreground">
              <X className="size-4" aria-hidden />
            </button>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            {sections.map(({ key, label, icon: Icon }) => (
              <button key={key} type="button" onClick={() => changeSection(key)}
                aria-pressed={section === key}
                className="flex min-h-10 items-center gap-2 rounded-lg border border-transparent px-2 py-2 text-left text-xs text-secondary transition hover:bg-surface-hover aria-pressed:border-accent/30 aria-pressed:bg-accent-soft aria-pressed:text-foreground">
                <Icon className="size-3.5 shrink-0" aria-hidden />
                {label}
              </button>
            ))}
          </div>
          <div className="mt-2 rounded-xl border border-border bg-background/60 p-2" data-earth-quick-section={section}>
            {section === "country" ? (
              countries.length ? placeButtons(countries) : (
                <p className="p-2 text-xs text-muted">No country catalog has been imported yet.</p>
              )
            ) : null}
            {section === "states" ? (
              states.length ? placeButtons(states) : activeCountry ? (
                <button type="button" disabled={busy} onClick={() => {
                  onChoosePlace(activeCountry);
                  onOpenDetails();
                }} className="w-full rounded-lg p-2 text-left text-xs text-accent hover:bg-surface-hover">
                  Open {activeCountry.name} to browse its states
                </button>
              ) : <p className="p-2 text-xs text-muted">Choose a country first.</p>
            ) : null}
            {section === "lgas" ? (
              lgas.length ? placeButtons(lgas) : activeState ? (
                <div className="space-y-2 p-2">
                  <p className="text-xs text-muted">LGAs are listed when reviewed boundaries are available. Open the state explorer for details.</p>
                  <button type="button" disabled={busy} onClick={() => {
                    onChoosePlace(activeState);
                    onOpenDetails();
                  }} className="text-xs text-accent">Open {activeState.name}</button>
                </div>
              ) : <p className="p-2 text-xs text-muted">Choose a state to browse its LGAs.</p>
            ) : null}
            {section === "cities" ? (
              cities.length ? placeButtons(cities) : (
                <p className="p-2 text-xs text-muted">Open a state or LGA to see verified city and town points. Coverage is still expanding.</p>
              )
            ) : null}
            {section === "zones" ? (
              zones.length ? (
                <div className="max-h-52 space-y-1 overflow-y-auto">
                  {zones.map((zone) => (
                    <button key={zone.id} type="button" disabled={busy}
                      onClick={() => chooseZone(zone)}
                      className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-xs hover:bg-surface-hover disabled:opacity-50">
                      <span className="min-w-0">
                        <span className="block truncate font-semibold">{zone.name}</span>
                        <span className="text-muted">{zone.isDemonstration ? "Synthetic demonstration" : "Active virtual zone"}</span>
                      </span>
                      <ChevronRight className="size-3.5 shrink-0 text-muted" />
                    </button>
                  ))}
                </div>
              ) : <p className="p-2 text-xs text-muted">Select a state with an approved virtual development zone.</p>
            ) : null}
            {section === "my-land" ? (
              <div className="space-y-2 p-2">
                <p className="text-sm font-semibold text-foreground">My Land</p>
                <p className="text-xs text-secondary">Your acquired virtual plots, properties and construction projects will be available here when Phase 5 ownership is implemented.</p>
                <p className="rounded-lg border border-warning/30 p-2 text-xs text-warning">
                  Purchasing, claiming and ownership are not available yet. Demo plots are not owned land.
                </p>
                <button type="button" onClick={() => { setOpen(false); onOpenDetails(); }}
                  className="text-xs font-medium text-accent hover:underline">
                  View current virtual land explorer
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
