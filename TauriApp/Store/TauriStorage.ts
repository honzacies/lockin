import type { StateStorage } from "zustand/middleware";
import { LazyStore } from "@tauri-apps/plugin-store";

/**
 * Only works inside the Tauri webview (bun run tauri:dev / tauri:build) —
 * a plain `next dev` browser tab has no __TAURI__ bridge to talk to. Every
 * method swallows its own errors so a missing bridge never bubbles up as an
 * unhandled rejection (that would otherwise trip the Next.js dev overlay and
 * block all clicks on the page, even though nothing is actually broken).
 */
export function CreateTauriStorage(fileName: string): StateStorage {
  const tauriStore = new LazyStore(fileName);
  return {
    getItem: async (name) => {
      try {
        const value = await tauriStore.get<string>(name);
        return value ?? null;
      } catch (error) {
        console.warn(`${fileName}: getItem failed (no Tauri bridge?)`, error);
        return null;
      }
    },
    setItem: async (name, value) => {
      try {
        await tauriStore.set(name, value);
        await tauriStore.save();
      } catch (error) {
        console.warn(`${fileName}: setItem failed (no Tauri bridge?)`, error);
      }
    },
    removeItem: async (name) => {
      try {
        await tauriStore.delete(name);
        await tauriStore.save();
      } catch (error) {
        console.warn(`${fileName}: removeItem failed (no Tauri bridge?)`, error);
      }
    },
  };
}
