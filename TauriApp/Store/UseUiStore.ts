import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type {
  BlockStyle,
  DocumentMode,
  DocumentStyleConfig,
  StyleableBlockType,
} from "@/Types/Project";
import type { OpenDocumentTab } from "@/Types/Tabs";
import { CreateTauriStorage } from "./TauriStorage";

/** Which kind of block a BlockSettingsPanelSlot.tsx side-panel entry
 * belongs to — paired with the block's own config id, since ids aren't
 * unique across kinds. */
export type BlockSettingsKind = "todo" | "colorPalette" | "scenario";

interface UiState {
  sidebarCollapsed: boolean;
  activeProjectId: string | null;
  documentModeByDocId: Record<string, DocumentMode>;
  openTabs: OpenDocumentTab[];
  activeTabId: string | null;
  /** Whether document content stretches full-width (only the 50px side
   * padding stays) or is capped at a comfortable 850px reading width. */
  isDocumentWide: boolean;
  /** Which block type's style modal is open (transient — never persisted). */
  styleEditorTarget: StyleableBlockType | null;
  /** Element styles applied to newly created documents ("apply to future"). */
  defaultDocumentStyle: DocumentStyleConfig;
  /** Icons (emoji or uploaded-image data URLs) recently picked anywhere in
   * the app, most-recent-first — shown for quick reuse in the icon picker. */
  recentIcons: string[];
  /** Which block (to-do list / color palette / scenario) has its settings
   * panel open — drives the side panel in AppShell (transient — never
   * persisted). Shared across all three kinds, one panel at a time. */
  openBlockSettings: { kind: BlockSettingsKind; id: string } | null;
  ToggleSidebar: () => void;
  SetActiveProject: (id: string | null) => void;
  SetDocumentMode: (docId: string, mode: DocumentMode) => void;
  OpenTab: (tab: OpenDocumentTab) => void;
  CloseTab: (id: string) => string | null;
  SetActiveTab: (id: string | null) => void;
  /** Reorders an open tab — moves `id` to sit right before `beforeId`, or to
   * the end when `beforeId` is null. */
  MoveTab: (id: string, beforeId: string | null) => void;
  ToggleDocumentWide: () => void;
  OpenStyleEditor: (blockType: StyleableBlockType) => void;
  CloseStyleEditor: () => void;
  SetDefaultBlockStyle: (
    blockType: StyleableBlockType,
    style: BlockStyle,
  ) => void;
  AddRecentIcon: (icon: string) => void;
  OpenBlockSettings: (kind: BlockSettingsKind, id: string) => void;
  CloseBlockSettings: () => void;
}

const MAX_RECENT_ICONS = 16;

export const UseUiStore = create<UiState>()(
  persist(
    (set, get) => ({
      sidebarCollapsed: false,
      activeProjectId: null,
      documentModeByDocId: {},
      openTabs: [],
      activeTabId: null,
      isDocumentWide: false,
      styleEditorTarget: null,
      defaultDocumentStyle: {},
      recentIcons: [],
      openBlockSettings: null,
      ToggleSidebar: () =>
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      SetActiveProject: (id) => set({ activeProjectId: id }),
      SetDocumentMode: (docId, mode) =>
        set((state) => ({
          documentModeByDocId: { ...state.documentModeByDocId, [docId]: mode },
        })),
      OpenTab: (tab) =>
        set((state) => {
          const existingIndex = state.openTabs.findIndex((t) => t.id === tab.id);
          if (existingIndex === -1) {
            return { openTabs: [...state.openTabs, tab], activeTabId: tab.id };
          }
          const openTabs = [...state.openTabs];
          openTabs[existingIndex] = tab;
          return { openTabs, activeTabId: tab.id };
        }),
      /** Returns the tab id that should become active next (or null), so the
       * caller can navigate there — closing a tab shouldn't strand the user. */
      CloseTab: (id) => {
        const state = get();
        const index = state.openTabs.findIndex((t) => t.id === id);
        if (index === -1) return state.activeTabId;
        const openTabs = state.openTabs.filter((t) => t.id !== id);
        const wasActive = state.activeTabId === id;
        const nextActiveId = wasActive
          ? (openTabs[index - 1]?.id ?? openTabs[index]?.id ?? null)
          : state.activeTabId;
        set({ openTabs, activeTabId: nextActiveId });
        return nextActiveId;
      },
      SetActiveTab: (id) => set({ activeTabId: id }),
      MoveTab: (id, beforeId) =>
        set((state) => {
          const moved = state.openTabs.find((t) => t.id === id);
          if (!moved) return state;
          const rest = state.openTabs.filter((t) => t.id !== id);
          const index = beforeId ? rest.findIndex((t) => t.id === beforeId) : -1;
          const openTabs =
            index === -1
              ? [...rest, moved]
              : [...rest.slice(0, index), moved, ...rest.slice(index)];
          return { openTabs };
        }),
      ToggleDocumentWide: () =>
        set((state) => ({ isDocumentWide: !state.isDocumentWide })),
      OpenStyleEditor: (blockType) => set({ styleEditorTarget: blockType }),
      CloseStyleEditor: () => set({ styleEditorTarget: null }),
      SetDefaultBlockStyle: (blockType, style) =>
        set((state) => ({
          defaultDocumentStyle: {
            ...state.defaultDocumentStyle,
            [blockType]: style,
          },
        })),
      AddRecentIcon: (icon) =>
        set((state) => ({
          recentIcons: [icon, ...state.recentIcons.filter((i) => i !== icon)].slice(
            0,
            MAX_RECENT_ICONS,
          ),
        })),
      OpenBlockSettings: (kind, id) => set({ openBlockSettings: { kind, id } }),
      CloseBlockSettings: () => set({ openBlockSettings: null }),
    }),
    {
      name: "lockin-ui-state",
      storage: createJSONStorage(() => CreateTauriStorage("ui-state.json")),
      skipHydration: true,
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        activeProjectId: state.activeProjectId,
        documentModeByDocId: state.documentModeByDocId,
        openTabs: state.openTabs,
        activeTabId: state.activeTabId,
        isDocumentWide: state.isDocumentWide,
        defaultDocumentStyle: state.defaultDocumentStyle,
        recentIcons: state.recentIcons,
      }),
    },
  ),
);
