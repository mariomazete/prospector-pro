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
}

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
};

let state: ProspectorState = initial;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export const prospectorStore = {
  get: () => state,
  set: (patch: Partial<ProspectorState> | ((s: ProspectorState) => Partial<ProspectorState>)) => {
    const next = typeof patch === "function" ? patch(state) : patch;
    state = { ...state, ...next };
    emit();
  },
  reset: () => {
    state = initial;
    emit();
  },
  subscribe: (l: () => void) => {
    listeners.add(l);
    return () => { listeners.delete(l); };
  },
};

export function useProspectorStore(): ProspectorState {
  return useSyncExternalStore(prospectorStore.subscribe, prospectorStore.get, prospectorStore.get);
}