import type { DocumentRecord, Project } from "@lockin/shared/Types/Project";

/**
 * Vše, co se v LockIn liší podle prostředí, prochází těmito čtyřmi rozhraními.
 * `Shared/` je jen konzumuje, implementace dodává konkrétní build:
 * TauriBuild/Platform/ (souborový systém) nebo WebBuild/Platform/ (API + IndexedDB).
 */

/** Projekty a dokumenty — v Tauri jeden JSON soubor na entitu, na webu API. */
export interface DataStorageAdapter {
  /** Bootstrap při startu — načte vše, z čeho se hydratuje store. */
  LoadAll(): Promise<{ projects: Project[]; documents: DocumentRecord[] }>;
  SaveProject(project: Project): Promise<void>;
  LoadProject(id: string): Promise<Project | null>;
  DeleteProject(id: string): Promise<void>;
  SaveDocument(doc: DocumentRecord): Promise<void>;
  LoadDocument(id: string): Promise<DocumentRecord | null>;
  DeleteDocument(id: string): Promise<void>;
  /**
   * Tauri: přestaví Manifest.json podle skutečného obsahu disku (self-healing
   * po pádu). Na webu index vlastní server, takže tam je to no-op.
   */
  RebuildIndex(): Promise<void>;
}

/** Obrázky a videa. Vrací se relativní cesta, ne URL — ta se resolvuje až při renderu. */
export interface MediaAdapter {
  Save(file: File): Promise<string>;
  ResolveUrl(relativePath: string): Promise<string>;
  Delete(relativePath: string): Promise<void>;
  /**
   * Smaže média, na která už žádný dokument neodkazuje. Volá se jednou při
   * startu, až po načtení VŠECH dokumentů — dřív nelze bezpečně říct, že
   * soubor nikdo nepoužívá.
   */
  SweepOrphaned(documents: DocumentRecord[]): Promise<void>;
}

/**
 * Backend pro zustand `persist` — drobné kolekce (folders, tagy, poznámky,
 * rozložení sidebaru, UI stav). `store` je logický název souboru/oddílu,
 * `key` je klíč uvnitř něj.
 */
export interface KeyValueAdapter {
  GetItem(store: string, key: string): Promise<string | null>;
  SetItem(store: string, key: string, value: string): Promise<void>;
  RemoveItem(store: string, key: string): Promise<void>;
}

/**
 * Ovládání okna. Na webu neexistuje — `isAvailable: false` a všechny metody
 * jsou no-op, takže WindowControls se prostě nevykreslí.
 */
export interface WindowAdapter {
  readonly isAvailable: boolean;
  IsMaximized(): Promise<boolean>;
  /** Vrací odhlašovací funkci. */
  OnResized(callback: () => void): Promise<() => void>;
  Close(): void;
  Minimize(): void;
  ToggleMaximize(): void;
  StartDragging(): void;
}

export interface Platform {
  readonly name: "tauri" | "web";
  readonly data: DataStorageAdapter;
  readonly media: MediaAdapter;
  readonly kv: KeyValueAdapter;
  readonly window: WindowAdapter;
}
