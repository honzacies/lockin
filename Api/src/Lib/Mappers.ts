import type { Document, Project } from "@prisma/client";

/**
 * Převod mezi databázovým řádkem a tvarem, který zná klient
 * (Shared/Types/Project.ts). Dvě věci se tady srovnávají:
 *
 *  1. `clientId` ↔ `id` — server má vlastní cuid primární klíč, klient o něm
 *     neví a pracuje se svým `doc-…` / `proj-…` ID.
 *  2. Volitelná pole — v databázi jsou `null`, klientské typy čekají
 *     `undefined` nebo prostě chybějící klíč.
 */

export interface ClientProject {
  id: string;
  name: string;
  icon?: string;
  tag: string;
  priority: string;
  status: string;
  progress: number;
  deadline: string | null;
  deadlineTime?: string | null;
  createdAt: string;
  lastEditedAt: string;
  rootDocumentId: string;
  documentIds: string[];
  isFavorite: boolean;
  folderId: string | null;
  tagIds: string[];
}

export interface ClientDocument {
  id: string;
  projectId: string | null;
  name: string;
  description: string;
  updatedAt: string;
  createdAt: string;
  lastMode: string;
  folderId: string | null;
  tagIds: string[];
  isFavorite: boolean;
  icon?: string;
  isLocked?: boolean;
  smallText?: boolean;
  showTableOfContents?: boolean;
  theme?: unknown;
  text: unknown;
  sketch: unknown;
  style?: unknown;
}

export function ToClientProject(row: Project): ClientProject {
  return {
    id: row.clientId,
    name: row.name,
    icon: row.icon ?? undefined,
    tag: row.tag,
    priority: row.priority,
    status: row.status,
    progress: row.progress,
    deadline: row.deadline,
    deadlineTime: row.deadlineTime,
    createdAt: row.createdAt.toISOString(),
    lastEditedAt: row.lastEditedAt.toISOString(),
    rootDocumentId: row.rootDocumentId,
    documentIds: row.documentIds,
    isFavorite: row.isFavorite,
    folderId: row.folderId,
    tagIds: row.tagIds,
  };
}

export function ToClientDocument(row: Document): ClientDocument {
  return {
    id: row.clientId,
    projectId: row.projectId,
    name: row.name,
    description: row.description,
    updatedAt: row.updatedAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    lastMode: row.lastMode,
    folderId: row.folderId,
    tagIds: row.tagIds,
    isFavorite: row.isFavorite,
    icon: row.icon ?? undefined,
    isLocked: row.isLocked,
    smallText: row.smallText,
    showTableOfContents: row.showTableOfContents,
    theme: row.theme ?? undefined,
    text: row.text,
    sketch: row.sketch,
    style: row.style ?? undefined,
  };
}
