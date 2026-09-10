"use client";

import { RegisterPlatform } from "@lockin/shared/Platform/Platform";
import type {
  DataStorageAdapter,
  KeyValueAdapter,
  MediaAdapter,
  WindowAdapter,
} from "@lockin/shared/Platform/Types";
import { IsAuthenticated } from "./Session";
import { ApiDataStorage, ApiKeyValue, ApiMedia } from "./ApiAdapters";
import { LocalDataStorage, LocalKeyValue, LocalMedia } from "./LocalAdapters";

/**
 * Web má dva zdroje dat a přepíná mezi nimi za běhu: dokud není uživatel
 * přihlášený, všechno zůstává v prohlížeči; po přihlášení jde všechno na API.
 *
 * Rozhoduje se při **každém volání**, ne jednou při startu — přihlášení i
 * odhlášení se může stát kdykoli a store si adaptér drží od chvíle, kdy
 * vznikl. Kdyby se cíl vybral dopředu, po loginu by se dál zapisovalo do
 * IndexedDB.
 */

function Data(): DataStorageAdapter {
  return IsAuthenticated() ? ApiDataStorage : LocalDataStorage;
}

function Media(): MediaAdapter {
  return IsAuthenticated() ? ApiMedia : LocalMedia;
}

function Kv(): KeyValueAdapter {
  return IsAuthenticated() ? ApiKeyValue : LocalKeyValue;
}

const SwitchingData: DataStorageAdapter = {
  LoadAll: () => Data().LoadAll(),
  SaveProject: (project) => Data().SaveProject(project),
  LoadProject: (id) => Data().LoadProject(id),
  DeleteProject: (id) => Data().DeleteProject(id),
  SaveDocument: (doc) => Data().SaveDocument(doc),
  LoadDocument: (id) => Data().LoadDocument(id),
  DeleteDocument: (id) => Data().DeleteDocument(id),
  RebuildIndex: () => Data().RebuildIndex(),
};

const SwitchingMedia: MediaAdapter = {
  Save: (file) => Media().Save(file),
  ResolveUrl: (path) => Media().ResolveUrl(path),
  Delete: (path) => Media().Delete(path),
  SweepOrphaned: (documents) => Media().SweepOrphaned(documents),
};

const SwitchingKv: KeyValueAdapter = {
  GetItem: (store, key) => Kv().GetItem(store, key),
  SetItem: (store, key, value) => Kv().SetItem(store, key, value),
  RemoveItem: (store, key) => Kv().RemoveItem(store, key),
};

/** Na webu se okno neovládá — všechno je no-op a WindowControls se skryjí. */
const NoWindow: WindowAdapter = {
  isAvailable: false,
  async IsMaximized() {
    return false;
  },
  async OnResized() {
    return () => {};
  },
  Close() {},
  Minimize() {},
  ToggleMaximize() {},
  StartDragging() {},
};

RegisterPlatform({
  name: "web",
  data: SwitchingData,
  media: SwitchingMedia,
  kv: SwitchingKv,
  window: NoWindow,
});
