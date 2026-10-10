"use client";

import { useEffect, useState } from "react";
import { TryGetPlatform } from "@lockin/shared/Platform/Platform";

export interface WindowControls {
  /** Na webu vždy false — okno se odsud neovládá. */
  isAvailable: boolean;
  /** Odráží skutečný stav OS okna, ne vlastní toggle. */
  isMaximized: boolean;
  Close: () => void;
  Minimize: () => void;
  ToggleMaximize: () => void;
  /**
   * Napoj na `onPointerDown` toho, co má fungovat jako titulkový pruh (pozadí
   * topbaru, ne jeho tlačítka). Ignoruje jiné než primární tlačítko, aby
   * nesnědl pravý a prostřední klik.
   */
  StartDragging: (event: React.PointerEvent) => void;
}

/**
 * Ovládání okna pro vlastní titulkový pruh. V Tauri buildu jede přes
 * `WindowAdapter` nad `getCurrentWindow()`, na webu je celý adaptér no-op a
 * `isAvailable` je false — WindowControls se pak vůbec nevykreslí.
 *
 * Dřív to byl UseTauriWindowControls.ts s přímým voláním Tauri API.
 */
export function useWindowControls(): WindowControls {
  const platform = TryGetPlatform();
  const adapter = platform?.window;
  const isAvailable = adapter?.isAvailable ?? false;
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    if (!adapter?.isAvailable) return;
    let cancelled = false;
    let unlisten: (() => void) | undefined;

    adapter
      .IsMaximized()
      .then((value) => {
        if (!cancelled) setIsMaximized(value);
      })
      .catch(() => {});

    // Maximalizace i obnovení vyvolají resize — je to jediný spolehlivý
    // způsob, jak zachytit změnu stavu na úrovni OS (dvojklik na drag region,
    // klávesová zkratka správce oken), ne jen klik na naše vlastní tlačítko.
    adapter
      .OnResized(() => {
        adapter
          .IsMaximized()
          .then((value) => {
            if (!cancelled) setIsMaximized(value);
          })
          .catch(() => {});
      })
      .then((fn) => {
        if (cancelled) fn();
        else unlisten = fn;
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [adapter]);

  return {
    isAvailable,
    isMaximized,
    Close: () => adapter?.Close(),
    Minimize: () => adapter?.Minimize(),
    ToggleMaximize: () => adapter?.ToggleMaximize(),
    StartDragging: (event: React.PointerEvent) => {
      if (event.button !== 0) return;
      adapter?.StartDragging();
    },
  };
}
