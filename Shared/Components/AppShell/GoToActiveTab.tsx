"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { UseUiStore } from "@lockin/shared/Store/UseUiStore";

/** Stránka, jejíž projekt/dokument už neexistuje (smazaný): přejde na aktivní tab, jinak na Your Projects. */
export function GoToActiveTab() {
  const router = useRouter();
  useEffect(() => {
    const { openTabs, activeTabId } = UseUiStore.getState();
    router.replace(openTabs.find((t) => t.id === activeTabId)?.href ?? "/YourProjects");
  }, [router]);
  return null;
}
