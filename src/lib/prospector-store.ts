import { useSyncExternalStore } from "react";
import type { Business } from "@/lib/mock-businesses";
import type { QuickFilterState } from "@/components/prospector/QuickFilters";

export interface ScanProgressState {
  country: string;
  currentCity: string;
  processed: number;
  total: number;
  found: number;
  dupes: number;
  errored: number;
  startedAt: number;
}

export interface ProspectorState {
  filters: { country: string; city: string; niche: string } | null;
  results: Business[];
  quick: QuickFilterState;
  progress: ScanProgressState | null;
  searched: boolean;
  historyId: string | null;
  activeBusiness: Business | null;
  resultPage: number;
}

const STORAGE_KEY = "prospector-ai:search-session:v1";

const initial: ProspectorState = {
  filters: null,
  results: [],
  quick: {
    noWebsite: false,
    minRating45: false,
    minReviews50: false,
    highOpportunity: false,
  },
  progress: null,
  searched: false,
  historyId: null,
  activeBusiness: null,
  resultPage: 1,
};

let state: ProspectorState = initial;
let hydrated = false;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";
}

function persist() {
  if (!canUseStorage()) return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Session persistence is a convenience layer; the app must keep working if storage is unavailable.
  }
}

function hydrate() {
  if (hydrated || !canUseStorage()) return;
  hydrated = true;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw) as Partial<ProspectorState>;
    state = {
      ...initial,
      ...saved,
      quick: { ...initial.quick, ...(saved.quick ?? {}) },
      progress: null,
    };
    emit();
  } catch {
    window.sessionStorage.removeItem(STORAGE_KEY);
  }
}

export const prospectorStore = {
  get: () => state,
  set: (patch: Partial<ProspectorState> | ((s: ProspectorState) => Partial<ProspectorState>)) => {
    const next = typeof patch === "function" ? patch(state) : patch;
    state = { ...state, ...next };
    persist();
    emit();
  },
  reset: () => {
    state = initial;
    if (canUseStorage()) window.sessionStorage.removeItem(STORAGE_KEY);
    emit();
  },
  subscribe: (l: () => void) => {
    hydrate();
    listeners.add(l);
    return () => { listeners.delete(l); };
  },
};

export function useProspectorStore(): ProspectorState {
  return useSyncExternalStore(prospectorStore.subscribe, prospectorStore.get, prospectorStore.get);
}