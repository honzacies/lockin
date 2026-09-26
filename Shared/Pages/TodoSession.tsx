"use client";

import { SessionView } from "@lockin/shared/Components/Focus/SessionView";
import { UseFocusStore } from "@lockin/shared/Store/UseFocusStore";
import { GetPlatform } from "@lockin/shared/Platform/Platform";

/** Obsah připnutého okna session (jen desktop). Stav sem dodá synchronizace
 * s hlavním oknem, proto se store z disku nehydratuje. */
export default function TodoSessionPage() {
  return (
    <div className="h-screen overflow-hidden">
      <SessionView
        onClose={() => {
          UseFocusStore.getState().Pause();
          GetPlatform().window.Close();
        }}
        onMiniChange={(mini) =>
          GetPlatform().window.SetSessionMini(mini).catch((error: unknown) => console.warn("SetSessionMini failed", error))
        }
      />
    </div>
  );
}
