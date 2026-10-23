import { useEffect, useState } from "react";
import {
  AlertCircle,
  Check,
  Copy,
  Download,
  RefreshCw,
  SearchX,
} from "lucide-react";
import { ApiError, request } from "./api";
import type { ApiResponse } from "./api";

export function plain(value: unknown): string {
  if (value == null) return "";
  const doc = new DOMParser().parseFromString(String(value), "text/html");
  doc.querySelectorAll("script,style").forEach((n) => n.remove());
  doc
    .querySelectorAll("br,p,div,li,h1,h2,h3,h4,tr")
    .forEach((n) => n.append("\n"));
  return (doc.body.textContent || "")
    .replace(/[\t ]+/g, " ")
    .replace(/\n\s*\n/g, "\n")
    .trim();
}
export const number = (value?: number) =>
  value == null ? "—" : new Intl.NumberFormat("pl-PL").format(value);
export function date(value: unknown) {
  if (!value || typeof value !== "string") return "—";
  const parsed = new Date(value);
  return Number.isNaN(+parsed)
    ? value
    : new Intl.DateTimeFormat("pl-PL", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(parsed);
}
export function useApi(url: string | undefined, revision = 0) {
  const [state, setState] = useState<{
    body?: ApiResponse;
    error?: Error;
    loading: boolean;
    ms?: number;
  }>({ loading: !!url });
  useEffect(() => {
    const controller = new AbortController();
    if (!url) {
      setState({ loading: false });
      return;
    }
    setState({ loading: true });
    request(url, controller.signal)
      .then((r) => setState({ body: r.body, ms: r.ms, loading: false }))
      .catch((e) => {
        if (!controller.signal.aborted) setState({ error: e, loading: false });
      });
    return () => controller.abort();
  }, [url, revision]);
  return state;
}
export function ErrorState({
  error,
  retry,
}: {
  error: Error;
  retry?: () => void;
}) {
  return (
    <div className="state-box error-state" role="alert">
      <AlertCircle size={30} />
      <h3>Nie udało się pobrać danych</h3>
      <p>
        {error instanceof ApiError
          ? error.message
          : "Połączenie z API nie powiodło się lub trwało zbyt długo. Sprawdź połączenie i spróbuj ponownie."}
      </p>
      {error instanceof ApiError && (
        <details>
          <summary>Szczegóły odpowiedzi</summary>
          <pre>{JSON.stringify(error.payload, null, 2)}</pre>
        </details>
      )}
      {retry && (
        <button className="button" onClick={retry}>
          <RefreshCw size={16} /> Spróbuj ponownie
        </button>
      )}
    </div>
  );
}
export function Loading({ cards = false }: { cards?: boolean }) {
  return (
    <div
      role="status"
      aria-label="Ładowanie danych"
      className={cards ? "card-grid skeleton-grid" : "loading-block"}
    >
      {Array.from({ length: cards ? 6 : 1 }, (_, i) => (
        <div className="skeleton-card" key={i}>
          <div />
          <div />
          <div />
          <div />
        </div>
      ))}
      <span className="sr-only">Ładowanie danych…</span>
    </div>
  );
}
export function Empty({
  title = "Brak wyników",
  text = "Zmień wyszukiwaną frazę lub usuń część filtrów.",
}: {
  title?: string;
  text?: string;
}) {
  return (
    <div className="state-box">
      <SearchX size={32} />
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}
export function CopyButton({
  value,
  label = "Kopiuj",
}: {
  value: string;
  label?: string;
}) {
  const [state, setState] = useState("");
  useEffect(() => {
    if (!state) return;
    const t = setTimeout(() => setState(""), 2500);
    return () => clearTimeout(t);
  }, [state]);
  return (
    <button
      className="button small"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setState("Skopiowano");
        } catch {
          setState("Kopiowanie niedostępne");
        }
      }}
    >
      {state === "Skopiowano" ? <Check size={15} /> : <Copy size={15} />}
      {state || label}
    </button>
  );
}
export function downloadJson(data: unknown, name = "govapi-odpowiedz.json") {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json;charset=utf-8",
    }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function JsonView({ data }: { data: unknown }) {
  const json = JSON.stringify(data, null, 2);
  return (
    <div className="json-view">
      <div className="json-toolbar">
        <span>JSON · bieżąca odpowiedź</span>
        <div>
          <CopyButton value={json} />
          <button className="button small" onClick={() => downloadJson(data)}>
            <Download size={15} /> Pobierz JSON
          </button>
        </div>
      </div>
      <pre tabIndex={0}>{json}</pre>
    </div>
  );
}
