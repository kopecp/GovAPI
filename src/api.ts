export const API_BASE = "https://api.dane.gov.pl/1.4";
export const DOCS_URL =
  "https://api.dane.gov.pl/doc?urls.primaryName=DANE.GOV.PL+API+v1.4";

export interface ApiItem {
  id: string;
  type: string;
  attributes: Record<string, any>;
  links?: { self?: string };
  relationships?: Record<
    string,
    { links?: { related?: string }; data?: any; meta?: { count?: number } }
  >;
}
export interface ApiResponse {
  data?: ApiItem[] | ApiItem;
  included?: ApiItem[];
  meta?: { count?: number; [key: string]: any };
  links?: Record<string, string>;
  [key: string]: any;
}
export interface Parameter {
  name: string;
  in: string;
  required?: boolean;
  description?: string;
  schema?: {
    type?: string;
    enum?: string[];
    example?: any;
    minimum?: number;
    maximum?: number;
    properties?: Record<string, any>;
  };
}
export interface Operation {
  summary?: string;
  description?: string;
  parameters?: Parameter[];
  responses?: Record<string, any>;
}
export interface Spec {
  paths: Record<string, { get?: Operation; parameters?: Parameter[] }>;
  info: { version: string; description: string };
  components?: any;
}

export function apiUrl(input: string): string {
  const url = new URL(
    input.startsWith("https://")
      ? input
      : `${API_BASE}/${input.replace(/^\//, "")}`,
  );
  if (
    url.origin !== "https://api.dane.gov.pl" ||
    !url.pathname.startsWith("/1.4/")
  )
    throw new Error("Dozwolone są tylko adresy API dane.gov.pl v1.4.");
  return url.href;
}
export function withQuery(
  path: string,
  values: Record<string, string | number | undefined>,
): string {
  const url = new URL(apiUrl(path));
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== "")
      url.searchParams.set(key, String(value));
  });
  return url.href;
}
export class ApiError extends Error {
  status: number;
  payload: unknown;
  constructor(status: number, payload: unknown) {
    super(
      status === 404
        ? "Nie znaleziono danych pod tym adresem (404)."
        : status === 429
          ? "API ograniczyło liczbę zapytań. Spróbuj ponownie za chwilę (429)."
          : `API zwróciło błąd ${status}. Sprawdź parametry zapytania lub spróbuj ponownie.`,
    );
    this.status = status;
    this.payload = payload;
  }
}
export async function request(
  input: string,
  signal?: AbortSignal,
  language = "pl",
): Promise<{ body: ApiResponse; status: number; ms: number; url: string }> {
  const url = apiUrl(input);
  const started = performance.now();
  const timeout = AbortSignal.timeout(25000);
  const res = await fetch(url, {
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    headers: { "Accept-Language": language },
    credentials: "omit",
  });
  const text = await res.text();
  let body: ApiResponse;
  try {
    body = JSON.parse(text);
  } catch {
    body = { text };
  }
  if (!res.ok) throw new ApiError(res.status, body);
  return {
    body,
    status: res.status,
    ms: Math.round(performance.now() - started),
    url,
  };
}
export function itemsOf(body?: ApiResponse | null): ApiItem[] {
  const data = body?.data;
  const items = !data ? [] : Array.isArray(data) ? data : [data];
  // Search returns a generic JSON:API type; the real collection is in attributes.model.
  return items.map((item) =>
    item.type === "common" && typeof item.attributes?.model === "string"
      ? { ...item, type: item.attributes.model }
      : item,
  );
}
export function safeHref(value: unknown): string | undefined {
  if (typeof value !== "string" || !value) return;
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) ? url.href : undefined;
  } catch {
    return;
  }
}
export function itemUrl(item: ApiItem): string | undefined {
  const self = item.links?.self;
  if (self) {
    try {
      const link = new URL(self);
      if (
        link.origin === "https://api.dane.gov.pl" &&
        /^\/[a-z-]+\/[^/]+$/.test(link.pathname)
      )
        return apiUrl(`${API_BASE}${link.pathname}${link.search}`);
      return apiUrl(self);
    } catch {
      /* fall back to known resource types */
    }
  }
  const collections: Record<string, string> = {
    dataset: "datasets",
    resource: "resources",
    institution: "institutions",
    showcase: "showcases",
    history: "histories",
  };
  const collection = collections[item.type];
  return collection && item.id
    ? `${API_BASE}/${collection}/${encodeURIComponent(item.id)}`
    : undefined;
}
export function explorerRoute(input: string): string {
  const url = new URL(apiUrl(input));
  const segments = url.pathname.slice("/1.4/".length).split("/");
  const values: Record<string, string> = { query: url.searchParams.toString() };
  if (
    segments.length >= 2 &&
    [
      "datasets",
      "resources",
      "institutions",
      "showcases",
      "histories",
    ].includes(segments[0])
  ) {
    values.id = decodeURIComponent(segments[1]).split(",")[0];
    segments[1] = "{id}";
    if (segments[2] === "data" && segments[3]) {
      values.row_id = decodeURIComponent(segments[3]);
      segments[3] = "{row_id}";
    }
  }
  return routeHref("api", { endpoint: "/" + segments.join("/"), ...values });
}
export function routeHref(
  view: string,
  values: Record<string, string | number | undefined> = {},
) {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== "") params.set(key, String(value));
  });
  return `#/${view}${params.size ? `?${params}` : ""}`;
}
export function buildEndpointUrl(
  path: string,
  pathValues: Record<string, string>,
  query: string,
): string {
  const expanded = path.replace(/\{([^}]+)\}/g, (_, name: string) => {
    const value = pathValues[name]?.trim();
    if (!value) throw new Error(`Uzupełnij parametr ścieżki: ${name}.`);
    return encodeURIComponent(value);
  });
  const params = new URLSearchParams(query.replace(/^\?/, ""));
  return apiUrl(expanded + (params.size ? `?${params}` : ""));
}
export function pathParameters(
  path: string,
  operation: Operation,
): Parameter[] {
  return Array.from(
    path.matchAll(/\{([^}]+)\}/g),
    (m) =>
      operation.parameters?.find((p) => p.name === m[1] && p.in === "path") || {
        name: m[1],
        in: "path",
        required: true,
        schema: { type: "string" },
      },
  );
}
