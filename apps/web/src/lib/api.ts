import type { ApiErrorBody } from "@/lib/types";

export const AUTH_STORAGE_KEY = "ishoppine-auth";
export const DEV_CODE_STORAGE_KEY = "ishoppine-dev-code";

export function getApiBase(): string {
  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
}

export function getGoogleAuthUrl(): string {
  return `${getApiBase()}/api/auth/google/start`;
}

function getClientToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      state?: { accessToken?: string | null };
    };
    return parsed.state?.accessToken ?? null;
  } catch {
    return null;
  }
}

async function parseError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as ApiErrorBody;
    if (Array.isArray(body.message)) return body.message.join(", ");
    if (body.message) return body.message;
  } catch {
    // ignore
  }
  return res.statusText || "Erro na requisição";
}

export type ApiOptions = RequestInit & {
  /** Pass a token explicitly. Pass `null` to force unauthenticated. Omit to auto-read from localStorage on the client. */
  token?: string | null;
};

export async function apiFetch<T>(
  path: string,
  options: ApiOptions = {},
): Promise<T> {
  const { token, headers: initHeaders, ...rest } = options;
  const headers = new Headers(initHeaders);

  const bearer =
    token === null
      ? null
      : token !== undefined
        ? token
        : getClientToken();

  if (bearer) {
    headers.set("Authorization", `Bearer ${bearer}`);
  }

  if (
    rest.body &&
    !(rest.body instanceof FormData) &&
    !headers.has("Content-Type")
  ) {
    headers.set("Content-Type", "application/json");
  }

  const url = path.startsWith("http")
    ? path
    : `${getApiBase()}/api${path.startsWith("/") ? path : `/${path}`}`;

  const res = await fetch(url, {
    ...rest,
    headers,
    cache: rest.cache ?? "no-store",
  });

  if (!res.ok) {
    throw new Error(await parseError(res));
  }

  if (res.status === 204) {
    return undefined as T;
  }

  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

/** Fetch helper with Bearer token from localStorage when available. */
export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  return apiFetch<T>(path, options);
}
