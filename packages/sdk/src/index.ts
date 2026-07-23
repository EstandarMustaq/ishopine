export type IshopineClientOptions = {
  /** Gateway or API base, e.g. http://localhost:4000 */
  baseUrl: string;
  getToken?: () => string | null | Promise<string | null>;
  tenantId?: string | null;
};

export class IshopineApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = "IshopineApiError";
  }
}

/**
 * Thin fetch client aimed at the strangler gateway.
 * Domain methods grow as frontends migrate off local `lib/api.ts` copies.
 */
export function createIshopineClient(options: IshopineClientOptions) {
  const base = options.baseUrl.replace(/\/$/, "");

  async function request<T>(
    path: string,
    init: RequestInit = {},
  ): Promise<T> {
    const token = options.getToken ? await options.getToken() : null;
    const headers = new Headers(init.headers);
    if (!headers.has("Content-Type") && init.body) {
      headers.set("Content-Type", "application/json");
    }
    if (token) headers.set("Authorization", `Bearer ${token}`);
    if (options.tenantId) headers.set("x-tenant-id", options.tenantId);

    const res = await fetch(`${base}${path.startsWith("/") ? path : `/${path}`}`, {
      ...init,
      headers,
      credentials: "include",
    });

    const text = await res.text();
    let data: unknown = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }

    if (!res.ok) {
      const message =
        typeof data === "object" &&
        data &&
        "message" in data &&
        typeof (data as { message: unknown }).message === "string"
          ? (data as { message: string }).message
          : `Request failed (${res.status})`;
      throw new IshopineApiError(message, res.status, data);
    }

    return data as T;
  }

  return {
    request,
    health: () => request<{ ok: boolean }>("/api/health"),
    get: <T>(path: string) => request<T>(path),
    post: <T>(path: string, body?: unknown) =>
      request<T>(path, {
        method: "POST",
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
  };
}

export type IshopineClient = ReturnType<typeof createIshopineClient>;
