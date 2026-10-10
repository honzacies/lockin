"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { UseSettingsStore } from "@lockin/shared/Store/UseSettingsStore";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const { startPage, lastPage } = UseSettingsStore.getState();
    router.replace(startPage === "last" ? lastPage || "/YourProjects" : startPage);
  }, [router]);

  return null;
}
