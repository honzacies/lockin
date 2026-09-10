"use client";

/**
 * Kdo je přihlášený a čím se to dokládá.
 *
 * Tokeny jdou do localStorage, ne do cookie: API běží na jiné doméně než web
 * (api.honzacs.dev vs lockin.honzacs.dev), takže cookie by musela být
 * cross-site, a ta je dnes v prohlížečích na tenkém ledě. Cenou je, že token
 * je čitelný z JavaScriptu — proto má access token krátkou životnost a refresh
 * token se při každém použití rotuje.
 */

const ACCESS_KEY = "lockin.accessToken";
const REFRESH_KEY = "lockin.refreshToken";
const USER_KEY = "lockin.user";

export interface SessionUser {
  id: string;
  username: string;
  role: "USER" | "ADMIN";
}

type Listener = (user: SessionUser | null) => void;
const listeners = new Set<Listener>();

function ReadStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    // Privátní okno nebo zablokované úložiště — chovej se jako odhlášený.
    return null;
  }
}

function WriteStorage(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Neuložíme — přihlášení pak nepřežije reload, ale aplikace jede dál.
  }
}

export function GetAccessToken(): string | null {
  return ReadStorage(ACCESS_KEY);
}

export function GetRefreshToken(): string | null {
  return ReadStorage(REFRESH_KEY);
}

export function GetSessionUser(): SessionUser | null {
  const raw = ReadStorage(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionUser;
  } catch {
    return null;
  }
}

export function IsAuthenticated(): boolean {
  return GetAccessToken() !== null;
}

export function SetSession(
  accessToken: string,
  refreshToken: string,
  user: SessionUser,
): void {
  WriteStorage(ACCESS_KEY, accessToken);
  WriteStorage(REFRESH_KEY, refreshToken);
  WriteStorage(USER_KEY, JSON.stringify(user));
  Notify(user);
}

/** Jen výměna access tokenu při refreshi — uživatel se nemění. */
export function UpdateTokens(accessToken: string, refreshToken: string): void {
  WriteStorage(ACCESS_KEY, accessToken);
  WriteStorage(REFRESH_KEY, refreshToken);
}

export function ClearSession(): void {
  WriteStorage(ACCESS_KEY, null);
  WriteStorage(REFRESH_KEY, null);
  WriteStorage(USER_KEY, null);
  Notify(null);
}

function Notify(user: SessionUser | null): void {
  for (const listener of listeners) listener(user);
}

/**
 * Odběr změn přihlášení. Store se na to věší, aby se po loginu i logoutu
 * přenačetla data z toho správného zdroje.
 */
export function OnSessionChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
