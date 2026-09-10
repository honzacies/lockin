"use client";

import {
  ClearSession,
  GetAccessToken,
  GetRefreshToken,
  UpdateTokens,
} from "./Session";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Obnova access tokenu. Drží se jeden sdílený promise — když vyprší token a
 * naráz doběhne pět requestů, všechny počkají na jednu obnovu místo aby
 * poslaly pět refreshů. To by u rotujících tokenů znamenalo, že čtyři z nich
 * dostanou odvolaný token a uživatele to bezdůvodně odhlásí.
 */
let refreshInFlight: Promise<boolean> | null = null;

async function RefreshAccessToken(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const refreshToken = GetRefreshToken();
    if (!refreshToken) return false;

    try {
      const response = await fetch(`${API_URL}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });
      if (!response.ok) {
        ClearSession();
        return false;
      }
      const data = (await response.json()) as { accessToken: string; refreshToken: string };
      UpdateTokens(data.accessToken, data.refreshToken);
      return true;
    } catch {
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  /** Když je true, tělo se posílá jak je (FormData), bez JSON serializace. */
  raw?: boolean;
  signal?: AbortSignal;
}

/**
 * Volání API s přiloženým tokenem. Na 401 zkusí jednou obnovit token a
 * request zopakovat; když ani to neprojde, session se zahodí a volající
 * dostane ApiError.
 */
export async function ApiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const Send = async (): Promise<Response> => {
    const headers: Record<string, string> = {};
    const token = GetAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    if (!options.raw && options.body !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    return fetch(`${API_URL}${path}`, {
      method: options.method ?? "GET",
      headers,
      body: options.raw
        ? (options.body as BodyInit)
        : options.body !== undefined
          ? JSON.stringify(options.body)
          : undefined,
      signal: options.signal,
    });
  };

  let response = await Send();

  if (response.status === 401 && GetRefreshToken()) {
    const refreshed = await RefreshAccessToken();
    if (refreshed) response = await Send();
  }

  if (response.status === 401) {
    ClearSession();
    throw new ApiError("Your session has expired.", 401);
  }

  if (!response.ok) {
    const message = await response
      .json()
      .then((data: { error?: string }) => data.error)
      .catch(() => null);
    throw new ApiError(message ?? `Request failed (${response.status}).`, response.status);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

/** Přihlášení a registrace token nepotřebují, proto mimo ApiFetch. */
export async function ApiPostPublic<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const message = await response
      .json()
      .then((data: { error?: string }) => data.error)
      .catch(() => null);
    throw new ApiError(message ?? `Request failed (${response.status}).`, response.status);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export { API_URL };
