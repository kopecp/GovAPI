import { useEffect, useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  ChevronDown,
  ExternalLink,
  Play,
  Search,
  Terminal,
} from "lucide-react";
import {
  API_BASE,
  buildEndpointUrl,
  itemUrl,
  itemsOf,
  pathParameters,
  request,
  routeHref,
} from "./api";
import type { ApiResponse, Operation, Parameter, Spec } from "./api";
import { DataCard, itemTitle } from "./catalog";
import type { SavedProps } from "./catalog";
import {
  CopyButton,
  Empty,
  ErrorState,
  JsonView,
  Loading,
  number,
  plain,
} from "./ui";

export const endpointLabels: Record<string, string> = {
  "/institutions": "Lista dostawców",
  "/institutions/{id}": "Szczegóły dostawcy",
  "/institutions/{id}/datasets": "Zbiory dostawcy",
  "/datasets": "Lista zbiorów",
  "/datasets/{id}": "Szczegóły zbioru",
  "/datasets/{id}/resources": "Zasoby zbioru",
  "/datasets/{id}/showcases": "Zastosowania zbioru",
  "/resources": "Lista zasobów",
  "/resources/{id}": "Szczegóły zasobu",
  "/resources/{id}/data": "Wiersze tabeli",
  "/resources/{id}/data/{row_id}": "Pojedynczy wiersz",
  "/search": "Wyszukiwanie globalne",
  "/showcases": "Lista zastosowań",
  "/showcases/{id}": "Szczegóły zastosowania",
  "/histories": "Historia zmian",
  "/histories/{id}": "Szczegóły zmiany",
  "/dga-aggregated": "Dane zagregowane DGA",
  "/reports/brokenlinks": "Raport niedziałających linków",
  "/reports/brokenlinks/data": "Dane raportu",
  "/reports/brokenlinks/{extension}": "Pobierz raport",
};
function leaves(schema: any, prefix: string): string[] {
  if (!schema?.properties) return [prefix];
  return Object.entries(schema.properties).flatMap(([key, value]) =>
    leaves(value, `${prefix}[${key}]`),
  );
}
function ParameterField({
  parameter: p,
  query,
  setQuery,
}: {
  parameter: Parameter;
  query: string;
  setQuery: (s: string) => void;
}) {
  const choices = leaves(p.schema, p.name);
  const params = new URLSearchParams(query);
  const activeKey =
    choices.find((k) => params.has(k)) ||
    (choices.includes(`${p.name}[term]`) ? `${p.name}[term]` : choices[0]);
  const [key, setKey] = useState(activeKey);
  const inputKey = choices.includes(key) ? key : activeKey;
  const value = params.get(inputKey) || "";
  function update(nextValue: string, nextKey = inputKey) {
    const next = new URLSearchParams(query);
    if (nextKey !== inputKey) next.delete(inputKey);
    if (nextValue) next.set(nextKey, nextValue);
    else next.delete(nextKey);
    setQuery(next.toString());
  }
  return (
    <div className="parameter-field">
      <label>
        <span>
          {p.name}
          {p.required && <b> *</b>}
          <small>{p.schema?.type || "string"}</small>
        </span>
        <div className="parameter-input">
          {choices.length > 1 && (
            <select
              aria-label={`Operator ${p.name}`}
              value={inputKey}
              onChange={(e) => {
                setKey(e.target.value);
                update(value, e.target.value);
              }}
            >
              {choices.map((c) => (
                <option key={c} value={c}>
                  {c.slice(p.name.length)}
                </option>
              ))}
            </select>
          )}
          {p.schema?.enum ? (
            <select value={value} onChange={(e) => update(e.target.value)}>
              <option value="">Domyślnie</option>
              {p.schema.enum.map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          ) : (
            <input
              value={value}
              placeholder={
                p.name === "q"
                  ? "np. transport"
                  : p.name === "per_page"
                    ? "12"
                    : p.name === "sort"
                      ? "np. -modified"
                      : p.schema?.example != null
                        ? String(p.schema.example)
                        : "Opcjonalnie"
              }
              onChange={(e) => update(e.target.value)}
            />
          )}
        </div>
      </label>
      {p.description && (
        <details className="parameter-help">
          <summary>Opis parametru</summary>
          <p>{plain(p.description)}</p>
        </details>
      )}
    </div>
  );
}

export default function Explorer({
  spec,
  params,
  saved,
  toggleSave,
}: { spec: Spec; params: URLSearchParams } & SavedProps) {
  const paths = Object.keys(spec.paths).filter((p) => spec.paths[p].get);
  const endpoint = paths.includes(params.get("endpoint") || "")
    ? params.get("endpoint")!
    : "/datasets";
  const operation: Operation = spec.paths[endpoint].get!;
  const pathParams = pathParameters(endpoint, operation);
  const queryParams = (operation.parameters || []).filter(
    (p) => p.in === "query",
  );
  const [pathValues, setPathValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      pathParams.map((p) => [
        p.name,
        params.get(p.name) || (p.name === "extension" ? "csv" : ""),
      ]),
    ),
  );
  const [query, setQuery] = useState(
    params.get("query") ||
      (queryParams.some((p) => p.name === "per_page")
        ? "per_page=12&page=1"
        : ""),
  );
  const [language, setLanguage] = useState(
    params.get("lang") === "en" ? "en" : "pl",
  );
  const [filter, setFilter] = useState("");
  const [state, setState] = useState<{
    loading?: boolean;
    error?: Error;
    result?: { body: ApiResponse; ms: number; status: number; url: string };
  }>({});
  const [tab, setTab] = useState("data");
  const [validation, setValidation] = useState("");
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  let preview = "",
    missing = "";
  try {
    preview = buildEndpointUrl(endpoint, pathValues, query);
  } catch (e) {
    missing = (e as Error).message;
  }
  const download = endpoint === "/reports/brokenlinks/{extension}";
  const basic = ["q", "per_page", "page", "sort", "include"];
  async function execute(url?: string) {
    if (!url && !preview) {
      setValidation(missing);
      return;
    }
    setValidation("");
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    setState({ loading: true });
    const submittedQuery = new URL(url || preview).searchParams.toString();
    setQuery(submittedQuery);
    history.replaceState(
      null,
      "",
      routeHref("api", {
        endpoint,
        ...pathValues,
        query: submittedQuery,
        lang: language,
      }),
    );
    try {
      const result = await request(url || preview, current.signal, language);
      if (!current.signal.aborted) setState({ result });
    } catch (e) {
      if (!current.signal.aborted) setState({ error: e as Error });
    }
  }
  const items = itemsOf(state.result?.body);
  return (
    <>
      <section className="page-heading">
        <div>
          <div className="eyebrow">DANE.GOV.PL · API V1.4</div>
          <h1>
            Eksplorator API<span className="title-dot">.</span>
          </h1>
          <p>Każdy endpoint. Wszystkie parametry. Dane prosto ze źródła.</p>
        </div>
        <span className="subtle-badge">{paths.length} endpointów · GET</span>
      </section>
      <div className="explorer-layout">
        <aside className="endpoint-sidebar">
          <div className="endpoint-filter">
            <Search size={16} />
            <input
              aria-label="Znajdź endpoint"
              placeholder="Znajdź endpoint…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>
          <nav aria-label="Endpointy API">
            {paths
              .filter((p) =>
                `${p} ${endpointLabels[p]}`
                  .toLowerCase()
                  .includes(filter.toLowerCase()),
              )
              .map((p) => (
                <a
                  key={p}
                  href={routeHref("api", { endpoint: p })}
                  className={endpoint === p ? "active" : ""}
                >
                  <span>{endpointLabels[p] || spec.paths[p].get?.summary}</span>
                  <code>
                    <b>GET</b> {p}
                  </code>
                </a>
              ))}
          </nav>
          <div className="spec-note">
            Na podstawie oficjalnej specyfikacji OpenAPI.
            <a href="./openapi.json" target="_blank" rel="noreferrer">
              Pobierz specyfikację <ExternalLink size={12} />
            </a>
          </div>
        </aside>
        <div className="explorer-main">
          <section className="panel request-panel">
            <div className="endpoint-title">
              <span className="method">GET</span>
              <code>{endpoint}</code>
            </div>
            <h2>{endpointLabels[endpoint] || operation.summary}</h2>
            {operation.description && (
              <details className="operation-description">
                <summary>
                  Dokumentacja endpointu <ChevronDown size={14} />
                </summary>
                <p>{plain(operation.description)}</p>
              </details>
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!download) void execute();
              }}
            >
              {pathParams.length > 0 && (
                <div className="path-parameters">
                  {pathParams.map((p) => (
                    <label key={p.name}>
                      <span>
                        {p.name} <b>*</b>
                        <small>parametr ścieżki</small>
                      </span>
                      <input
                        required
                        aria-label={`Parametr ${p.name}`}
                        placeholder={
                          p.name === "extension"
                            ? "csv lub xlsx"
                            : "Wpisz identyfikator"
                        }
                        value={pathValues[p.name] || ""}
                        onChange={(e) => {
                          setPathValues((v) => ({
                            ...v,
                            [p.name]: e.target.value,
                          }));
                          setValidation("");
                        }}
                      />
                      {p.description && <small>{plain(p.description)}</small>}
                    </label>
                  ))}
                </div>
              )}
              <div className="parameter-grid">
                {queryParams
                  .filter((p) => basic.includes(p.name))
                  .map((p) => (
                    <ParameterField
                      key={p.name}
                      parameter={p}
                      query={query}
                      setQuery={setQuery}
                    />
                  ))}
              </div>
              {queryParams.some((p) => !basic.includes(p.name)) && (
                <details className="advanced-params">
                  <summary>
                    Pozostałe parametry{" "}
                    <span className="count-badge">
                      {
                        queryParams.filter((p) => !basic.includes(p.name))
                          .length
                      }
                    </span>
                    <ChevronDown size={15} />
                  </summary>
                  <div className="parameter-grid">
                    {queryParams
                      .filter((p) => !basic.includes(p.name))
                      .map((p) => (
                        <ParameterField
                          key={p.name}
                          parameter={p}
                          query={query}
                          setQuery={setQuery}
                        />
                      ))}
                  </div>
                </details>
              )}
              <details className="advanced-params">
                <summary>
                  Edytuj query string i język <ChevronDown size={15} />
                </summary>
                <label className="query-label">
                  Parametry URL
                  <textarea
                    aria-label="Query string"
                    value={query}
                    onChange={(e) =>
                      setQuery(e.target.value.replace(/^\?/, ""))
                    }
                    spellCheck={false}
                  />
                </label>
                <p className="muted">
                  Wartości wielokrotne oddzielaj przecinkiem. Filtry złożone:
                  np. format[terms]=csv,xlsx. Formularz i query string edytują
                  to samo zapytanie.
                </p>
                <label className="language-label">
                  Accept-Language{" "}
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                  >
                    <option value="pl">Polski</option>
                    <option value="en">English</option>
                  </select>
                </label>
              </details>
              <div className="url-preview">
                <code>{preview || `${API_BASE}${endpoint}`}</code>
                {preview && <CopyButton value={preview} label="URL" />}
              </div>
              {validation && (
                <p role="alert" className="validation">
                  {validation}
                </p>
              )}
              <div className="request-actions">
                {download ? (
                  preview ? (
                    <a
                      className="button primary"
                      href={preview}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <ArrowDownToLine size={16} /> Otwórz plik raportu
                    </a>
                  ) : (
                    <span>Uzupełnij rozszerzenie raportu.</span>
                  )
                ) : (
                  <button
                    className="button primary"
                    disabled={state.loading}
                    type="submit"
                  >
                    <Play size={15} fill="currentColor" />
                    {state.loading ? "Wysyłanie…" : "Wyślij zapytanie"}
                  </button>
                )}
                {state.loading && (
                  <button
                    className="button"
                    type="button"
                    onClick={() => {
                      controller.current?.abort();
                      setState({});
                    }}
                  >
                    Anuluj
                  </button>
                )}
                <span>Odczyt publicznych danych · bez klucza API</span>
              </div>
            </form>
          </section>
          <section className="panel response-panel">
            <div className="response-heading">
              <h2>Odpowiedź</h2>
              {state.result && (
                <div>
                  <span className="response-status">
                    {state.result.status} OK
                  </span>
                  <span>{number(state.result.ms)} ms</span>
                </div>
              )}
            </div>
            {state.loading ? (
              <Loading />
            ) : state.error ? (
              <ErrorState error={state.error} retry={() => execute()} />
            ) : state.result ? (
              <>
                <div className="response-url">
                  <code>{state.result.url}</code>
                </div>
                <div className="tabs">
                  <button
                    className={tab === "data" ? "active" : ""}
                    onClick={() => setTab("data")}
                  >
                    Dane{" "}
                    {state.result.body.meta?.count != null &&
                      `(${number(state.result.body.meta.count)})`}
                  </button>
                  <button
                    className={tab === "table" ? "active" : ""}
                    onClick={() => setTab("table")}
                  >
                    Tabela
                  </button>
                  <button
                    className={tab === "json" ? "active" : ""}
                    onClick={() => setTab("json")}
                  >
                    JSON
                  </button>
                </div>
                {tab === "json" || !state.result.body.data ? (
                  <JsonView data={state.result.body} />
                ) : tab === "table" ||
                  items.some((i) => i.type === "row" || !itemUrl(i)) ? (
                  <ResponseTable body={state.result.body} />
                ) : items.length ? (
                  <div className="card-grid api-cards">
                    {items.map((item, i) => (
                      <DataCard
                        key={`${item.id}-${i}`}
                        item={item}
                        included={state.result?.body.included}
                        saved={saved}
                        toggleSave={toggleSave}
                      />
                    ))}
                  </div>
                ) : (
                  <Empty text="Zapytanie zakończyło się poprawnie, ale API nie zwróciło rekordów." />
                )}
                {(state.result.body.links?.prev ||
                  state.result.body.links?.next) && (
                  <div className="pagination">
                    <span>Stronicowanie odpowiedzi API</span>
                    <div>
                      <button
                        className="button small"
                        disabled={!state.result.body.links?.prev}
                        onClick={() => execute(state.result!.body.links!.prev)}
                      >
                        Poprzednia
                      </button>
                      <button
                        className="button small"
                        disabled={!state.result.body.links?.next}
                        onClick={() => execute(state.result!.body.links!.next)}
                      >
                        Następna <ArrowRight size={14} />
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="console-empty">
                <Terminal size={32} />
                <h3>
                  {download
                    ? "Raport jest plikiem do pobrania"
                    : "Zobacz, co kryje się w danych"}
                </h3>
                <p>
                  {download
                    ? "Wybierz csv lub xlsx i otwórz plik przyciskiem powyżej."
                    : "Ustaw parametry i wyślij pierwsze zapytanie. Odpowiedź pojawi się tutaj."}
                </p>
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
function ResponseTable({ body }: { body: ApiResponse }) {
  const data = itemsOf(body);
  if (!data.length) return <Empty />;
  const rows: Record<string, any>[] = data.map((item) => ({
    id: item.id,
    ...(item.attributes || item),
  }));
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const fields =
    body.meta?.headers_map || body.meta?.headers || body.meta?.fields || {};
  return (
    <div className="table-scroll" tabIndex={0}>
      <table>
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col}>
                {typeof fields[col] === "string" ? fields[col] : col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {columns.map((col) => (
                <td key={col}>
                  {col === "id" && itemUrl(data[i]) ? (
                    <a
                      href={routeHref("item", { url: itemUrl(data[i]) })}
                      title={itemTitle(data[i])}
                    >
                      {String(row[col])}
                    </a>
                  ) : row[col] == null ? (
                    "—"
                  ) : typeof row[col] === "object" ? (
                    "repr" in row[col] ? (
                      plain(row[col].repr)
                    ) : "val" in row[col] ? (
                      plain(row[col].val)
                    ) : (
                      JSON.stringify(row[col])
                    )
                  ) : (
                    plain(row[col])
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
