/** Thin wrapper over fetch for the app's own JSON API, with readable errors. */
export async function apiRequest<T = unknown>(
  url: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  const response = await fetch(url, {
    method: options.method ?? "GET",
    headers: options.body ? { "Content-Type": "application/json" } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "error" in payload
        ? String((payload as { error: unknown }).error)
        : `Request failed (${response.status})`;
    const issues =
      payload && typeof payload === "object" && "issues" in payload
        ? ((payload as { issues: Record<string, string> }).issues ?? undefined)
        : undefined;
    throw new ApiRequestError(message, response.status, issues);
  }

  return payload as T;
}

export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly issues?: Record<string, string>,
  ) {
    super(message);
  }
}
