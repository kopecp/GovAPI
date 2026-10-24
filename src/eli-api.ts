import { ApiError, routeHref } from "./api.ts";
import type { Operation } from "./api.ts";

export const ELI_BASE = "https://api.sejm.gov.pl/eli";
export const ELI_DOCS = "https://api.sejm.gov.pl/eli_pl.html";
export const ELI_SAVED_KEY = "govapi:eli:saved:v1";

export interface Publisher {
  code: string;
  name: string;
  shortName: string;
  actsCount: number;
  years: number[];
}
export interface Act {
  ELI: string;
  title: string;
  publisher: string;
  year: number;
  pos: number;
  volume?: number;
  address?: string;
  displayAddress?: string;
  type?: string;
  status?: string;
  inForce?: string;
  announcementDate?: string;
  promulgation?: string;
  entryIntoForce?: string;
  changeDate?: string;
  textHTML?: boolean;
  textPDF?: boolean;
  releasedBy?: string[];
  keywords?: string[];
  texts?: { type: string; fileName: string }[];
  references?: Record<string, { id: string; art?: string; date?: string }[]>;
  [key: string]: unknown;
}
export interface ActPage {
  items: Act[];
  totalCount: number;
  count: number;
  offset: number;
}
export interface EliResult<T = unknown> {
  body: T;
  status: number;
  ms: number;
  url: string;
}

export function eliUrl(input: string) {
  const url = new URL(
    /^[a-z][a-z\d+.-]*:/i.test(input)
      ? input
      : `${ELI_BASE}/${input.replace(/^\//, "")}`,
  );
  if (
    url.origin !== "https://api.sejm.gov.pl" ||
    !url.pathname.startsWith("/eli/") ||
    url.username ||
    url.password
  )
    throw new Error("Dozwolone są tylko adresy oficjalnego API ELI.");
  url.hash = "";
  return url.href;
}

export async function eliRequest<T = unknown>(
  input: string,
  signal?: AbortSignal,
): Promise<EliResult<T>> {
  const url = eliUrl(input);
  const started = performance.now();
  const timeout = AbortSignal.timeout(25000);
  const res = await fetch(url, {
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    credentials: "omit",
    headers: {
      Accept: input.includes("text.html") ? "text/html" : "application/json",
    },
  });
  const text = await res.text();
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  if (!res.ok) throw new ApiError(res.status, body);
  return {
    body: body as T,
    url,
    ms: Math.round(performance.now() - started),
    status: res.status,
  };
}

// Keep the ELI position as a string: historical MP identifiers include volume and leading zeros.
export function parseActId(input: string): string | undefined {
  let id = input.trim();
  if (/^https?:\/\//i.test(id)) {
    try {
      const url = new URL(id);
      if (url.hostname === "eli.gov.pl")
        id = url.pathname
          .replace(/^\/eli\//, "")
          .replace(/\/(ogl|tj|uj)(\/.*)?$/, "");
      else if (url.origin === "https://api.sejm.gov.pl")
        id = url.pathname.replace(/^\/eli\/acts\//, "");
      else return;
    } catch {
      return;
    }
  }
  return /^[A-ZĄĘĆŁŃÓŚŻŹ_]{2,8}\/\d{4}\/\d{1,10}$/.test(id) ||
    /^W[A-ZĄĘĆŁŃÓŚŻŹ_]{2}\d{11}$/.test(id)
    ? id
    : undefined;
}

export function actPath(id: string) {
  const valid = parseActId(id);
  if (!valid)
    throw new Error(
      "Wpisz identyfikator ELI, np. DU/1994/414, lub adres publikacyjny ISAP.",
    );
  return `/acts/${valid}`;
}
export const actHref = (id: string) => routeHref("eli-act", { id });
export const isAct = (value: unknown): value is Act =>
  !!value &&
  typeof value === "object" &&
  typeof (value as Act).title === "string" &&
  typeof (value as Act).ELI === "string" &&
  !!parseActId((value as Act).ELI);
export function actsOf(body: unknown): Act[] {
  if (isAct(body)) return [body];
  const items = Array.isArray(body)
    ? body
    : body && typeof body === "object"
      ? (body as ActPage).items
      : [];
  return Array.isArray(items) ? items.filter(isAct) : [];
}
export function readSavedActs(raw: string | null): Act[] {
  try {
    const value: unknown = JSON.parse(raw || "[]");
    return Array.isArray(value) ? value.filter(isAct) : [];
  } catch {
    return [];
  }
}

export function pageOptions(params: URLSearchParams) {
  const rawLimit = Number(params.get("limit") || 12);
  const limit = [12, 24, 48].includes(rawLimit) ? rawLimit : 12;
  const rawOffset = Number(params.get("offset") || 0);
  return {
    limit,
    offset: Number.isSafeInteger(rawOffset) && rawOffset >= 0 ? rawOffset : 0,
  };
}
export function searchUrl(params: URLSearchParams, changes = false) {
  const query = new URLSearchParams();
  const fields = changes
    ? ["since"]
    : [
        "publisher",
        "year",
        "volume",
        "position",
        "title",
        "type",
        "keyword",
        "inForce",
        "dateFrom",
        "dateTo",
        "pubDateFrom",
        "pubDateTo",
        "dateEffectFrom",
        "dateEffectTo",
        "sortBy",
        "sortDir",
      ];
  for (const key of fields)
    if (params.get(key)) query.set(key, params.get(key)!);
  const { limit, offset } = pageOptions(params);
  query.set("limit", String(limit));
  query.set("offset", String(offset));
  if (!changes) {
    if (!query.has("sortBy")) query.set("sortBy", "publisher");
    if (!query.has("sortDir")) query.set("sortDir", "desc");
  }
  return eliUrl(`${changes ? "/changes/acts" : "/acts/search"}?${query}`);
}

function pathSegment(value: string) {
  if (value === "." || value === "..")
    throw new Error("Nieprawidłowy parametr ścieżki.");
  return encodeURIComponent(value);
}
export function buildEliEndpoint(
  path: string,
  values: Record<string, string>,
  query = "",
) {
  const expanded = path.replace(/\{([^}]+)\}/g, (_, key: string) => {
    const value = values[key]?.trim();
    if (!value) throw new Error(`Uzupełnij parametr: ${key}`);
    if (key === "tree") {
      if (
        !value
          .split("/")
          .every((s) =>
            /^(ksiega|book|tytul|titl|dzial|bran|rozdzial|chpt|oddzial|schp|artykul|art|arti|ustep|pass|paragraf|para|punkt|pint|litera|lit|lett)=[\p{L}\d._-]+$/u.test(
              s,
            ),
          )
      )
        throw new Error("Fragment podaj np. jako artykul=1/ustep=2.");
      return value.split("/").map(pathSegment).join("/");
    }
    return pathSegment(value);
  });
  const url = new URL(eliUrl(expanded));
  url.search = new URLSearchParams(query.replace(/^\?/, "")).toString();
  return url.href;
}
export function textFileUrl(
  act: Act,
  text: { type: string; fileName: string },
) {
  return eliUrl(
    `${actPath(act.ELI)}/text/${pathSegment(text.type)}/${pathSegment(text.fileName)}`,
  );
}
export function isFileEndpoint(path: string, operation: Operation) {
  return (
    path.includes("/text/") ||
    path.endsWith(".pdf") ||
    !!operation.responses?.["200"]?.content?.["application/pdf"]
  );
}
export function eliEndpointLabel(path: string) {
  const labels: Record<string, string> = {
    "/": "Zasoby API",
    "/acts": "Dzienniki urzędowe",
    "/acts/search": "Wyszukiwanie aktów",
    "/acts/{address}": "Akt według adresu ISAP",
    "/acts/{publisher}": "Informacje o dzienniku",
    "/acts/{publisher}/{year}": "Akty w roczniku",
    "/changes/acts": "Ostatnie zmiany",
    "/institutions": "Instytucje",
    "/keywords": "Słowa kluczowe",
    "/references": "Rodzaje powiązań",
    "/statuses": "Statusy aktów",
    "/titles": "Podpowiedzi tytułów",
    "/types": "Typy aktów",
  };
  if (labels[path]) return labels[path];
  const suffix = path.endsWith("/volumes")
    ? "Zeszyty w roczniku"
    : path.endsWith("/references")
      ? "Powiązania aktu"
      : path.endsWith("/struct")
        ? "Struktura aktu"
        : path.endsWith("/{tree}")
          ? "Fragment tekstu HTML"
          : path.endsWith("text.html")
            ? "Tekst HTML"
            : path.endsWith("text.pdf")
              ? "Tekst PDF"
              : path.includes("/text/")
                ? "Wybrana wersja tekstu"
                : path.endsWith("/{volume}")
                  ? "Akty w zeszycie"
                  : "Szczegóły aktu";
  return suffix + (path.includes("/volumes/{volume}/") ? " · zeszyt" : "");
}
