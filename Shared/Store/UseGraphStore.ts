import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { CreatePersistStorage } from "@lockin/shared/Platform/PersistStorage";

/** Vlastní barevná skupina: poznámky, jejichž cesta nebo název obsahuje `query`. */
export interface GraphGroup {
  id: string;
  query: string;
  color: string;
}

export type LabelWeight = "regular" | "medium" | "bold";

export interface GraphSettings {
  /** Karta s legendou vlevo nahoře — zavřená ukáže jen nadpis stránky. */
  legendOpen: boolean;
  search: string;
  showOrphans: boolean;
  groups: GraphGroup[];
  arrows: boolean;
  /** Všechny tečky jednou barvou (nodeColor) místo skupin a složek. */
  ungrouped: boolean;
  nodeColor: string;
  /** Popisky teček: velikost (px při přiblížení 1), barva, tloušťka, bílý lem. */
  labelSize: number;
  labelColor: string;
  labelWeight: LabelWeight;
  labelHalo: boolean;
  /** Posun, od jakého přiblížení se objevují popisky (-3 dřív … 3 později). */
  textFadeThreshold: number;
  nodeSize: number;
  linkThickness: number;
  centerForce: number;
  repelForce: number;
  linkForce: number;
  linkDistance: number;
}

export const DEFAULT_GRAPH_SETTINGS: GraphSettings = {
  legendOpen: true,
  search: "",
  showOrphans: true,
  groups: [],
  arrows: false,
  ungrouped: false,
  nodeColor: "#91918e",
  labelSize: 11,
  labelColor: "#5f5e59",
  labelWeight: "regular",
  labelHalo: true,
  textFadeThreshold: 0,
  nodeSize: 1,
  linkThickness: 1,
  centerForce: 0.5,
  repelForce: 10,
  linkForce: 1,
  linkDistance: 100,
};

interface GraphState extends GraphSettings {
  /** Čítač, na který graf reaguje znovurozhozením (tlačítko Animate). */
  shakeNonce: number;
  Set: (patch: Partial<GraphSettings>) => void;
  Reset: () => void;
  Shake: () => void;
}

/** Nastavení grafu — persistuje se přes KV, takže má každý workspace vlastní. */
export const UseGraphStore = create<GraphState>()(
  persist(
    (set) => ({
      ...DEFAULT_GRAPH_SETTINGS,
      shakeNonce: 0,
      Set: (patch) => set(patch),
      Reset: () => set(DEFAULT_GRAPH_SETTINGS),
      Shake: () => set((state) => ({ shakeNonce: state.shakeNonce + 1 })),
    }),
    {
      name: "lockin-graph",
      storage: createJSONStorage(() => CreatePersistStorage("graph.json")),
      skipHydration: true,
      partialize: ({ shakeNonce: _, Set: __, Reset: ___, Shake: ____, ...settings }) => settings,
    },
  ),
);
