import { useEffect, useRef, useState } from "react";
import { ExternalLink, Play, Search, Terminal } from "lucide-react";
import { pathParameters, routeHref } from "./api";
import type { Parameter, Spec } from "./api";
import {
  actsOf,
  buildEliEndpoint,
  ELI_BASE,
  eliEndpointLabel,
  eliRequest,
  isFileEndpoint,
} from "./eli-api";
import type { ActPage, EliResult } from "./eli-api";
import { ActResults, EliPagination } from "./EliShared";
import type { EliSavedProps } from "./EliShared";
import { CopyButton, ErrorState, JsonView, Loading, number, plain } from "./ui";

const examples: Record<string, string> = {
  publisher: "DU",
  year: "2020",
  position: "2",
  volume: "19",
  address: "WDU19900190117",
  type: "O",
  fileName: "D20200002.pdf",
  tree: "paragraf=2/ustep=1",
};
export default function EliExplorer({
  spec,
  params,
  saved,
  toggleSave,
}: { spec: Spec; params: URLSearchParams } & EliSavedProps) {
  const paths = Object.keys(spec.paths).filter((path) => spec.paths[path].get);
  const endpoint = paths.includes(params.get("endpoint") || "")
    ? params.get("endpoint")!
    : "/acts/search";
  const entry = spec.paths[endpoint];
  const operation = {
    ...entry.get!,
    parameters: [...(entry.parameters || []), ...(entry.get?.parameters || [])],
  };
  const pathFields = pathParameters(endpoint, operation);
  const queryFields = operation.parameters.filter((p) => p.in === "query");
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      pathFields.map((p) => [p.name, params.get(p.name) || ""]),
    ),
  );
  const [query, setQuery] = useState(
    params.get("query") ||
      (queryFields.some((p) => p.name === "limit") ? "limit=12&offset=0" : ""),
  );
  const [filter, setFilter] = useState("");
  const [tab, setTab] = useState("data");
  const [state, setState] = useState<{
    loading?: boolean;
    error?: Error;
    result?: EliResult;
  }>({});
  const [validation, setValidation] = useState("");
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  let preview = "",
    missing = "";
  try {
    preview = buildEliEndpoint(endpoint, values, query);
  } catch (error) {
    missing = (error as Error).message;
  }
  const file = isFileEndpoint(endpoint, operation);
  function setParam(name: string, value: string) {
    const next = new URLSearchParams(query);
    if (value) next.set(name, value);
    else next.delete(name);
    setQuery(next.toString());
  }
  async function execute(input = preview) {
    if (!input) {
      setValidation(missing);
      return;
    }
    const required = queryFields.find(
      (p) => p.required && !new URL(input).searchParams.get(p.name),
    );
    if (required) {
      setValidation(`Uzupełnij parametr: ${required.name}`);
      return;
    }
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    setValidation("");
    setState({ loading: true });
    const submittedQuery = new URL(input).searchParams.toString();
    setQuery(submittedQuery);
    history.replaceState(
      null,
      "",
      routeHref("eli-api", { endpoint, ...values, query: submittedQuery }),
    );
    try {
      const result = await eliRequest(input, current.signal);
      if (!current.signal.aborted) setState({ result });
    } catch (error) {
      if (!current.signal.aborted) setState({ error: error as Error });
    }
  }
  function field(p: Parameter, path = false) {
    return (
      <label key={`${p.in}-${p.name}`} className="parameter-field">
        <span>
          {p.name}
          {p.required && <b> *</b>}{" "}
          <small>{path ? "ścieżka" : p.schema?.type || "string"}</small>
        </span>
        <input
          required={p.required}
          aria-label={`Parametr ${p.name}`}
          value={
            path
              ? values[p.name] || ""
              : new URLSearchParams(query).get(p.name) || ""
          }
          placeholder={
            path
              ? examples[p.name]
              : p.name === "since"
                ? "2026-10-01T00:00:00"
                : "Opcjonalnie"
          }
          onChange={(e) =>
            path
              ? setValues((v) => ({ ...v, [p.name]: e.target.value }))
              : setParam(p.name, e.target.value)
          }
        />
        {p.description && <small>{p.description}</small>}
      </label>
    );
  }
  const body = state.result?.body;
  const page =
    body && typeof body === "object" && "items" in body
      ? (body as ActPage)
      : undefined;
  const basic = ["title", "publisher", "year", "limit", "offset", "since", "q"];
  return (
    <>
      <section className="page-heading">
        <div>
          <div className="eyebrow">ELI · API SEJMU</div>
          <h1>
            Eksplorator API<span className="title-dot">.</span>
          </h1>
          <p>
            Dzienniki, akty, teksty i słowniki. Zapytania zgodne ze specyfikacją
            ELI.
          </p>
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
          <nav aria-label="Endpointy ELI">
            {paths
              .filter((path) =>
                `${path} ${eliEndpointLabel(path)}`
                  .toLocaleLowerCase("pl")
                  .includes(filter.toLocaleLowerCase("pl")),
              )
              .map((path) => (
                <a
                  key={path}
                  href={routeHref("eli-api", { endpoint: path })}
                  className={endpoint === path ? "active" : ""}
                >
                  <span>{eliEndpointLabel(path)}</span>
                  <code>
                    <b>GET</b> {path}
                  </code>
                </a>
              ))}
          </nav>
          <div className="spec-note">
            Oficjalna specyfikacja ELI.
            <a href="./eli-openapi.json" target="_blank" rel="noreferrer">
              Pobierz OpenAPI <ExternalLink size={12} />
            </a>
          </div>
        </aside>
        <div className="explorer-main">
          <section className="panel request-panel">
            <div className="endpoint-title">
              <span className="method">GET</span>
              <code>{endpoint}</code>
            </div>
            <h2>{eliEndpointLabel(endpoint)}</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!file) void execute();
              }}
            >
              {pathFields.length > 0 && (
                <div className="path-parameters">
                  {pathFields.map((p) => field(p, true))}
                </div>
              )}
              <div className="parameter-grid">
                {queryFields
                  .filter((p) => basic.includes(p.name))
                  .map((p) => field(p))}
              </div>
              {queryFields.some((p) => !basic.includes(p.name)) && (
                <details className="advanced-params">
                  <summary>Pozostałe parametry</summary>
                  <div className="parameter-grid">
                    {queryFields
                      .filter((p) => !basic.includes(p.name))
                      .map((p) => field(p))}
                  </div>
                </details>
              )}
              <details className="advanced-params">
                <summary>Edytuj query string</summary>
                <label className="query-label">
                  Parametry URL
                  <textarea
                    aria-label="Query string"
                    value={query}
                    spellCheck={false}
                    onChange={(e) =>
                      setQuery(e.target.value.replace(/^\?/, ""))
                    }
                  />
                </label>
                <p className="muted">
                  Słowa kluczowe oddzielaj przecinkiem. Fragment tekstu: np.
                  artykul=1/ustep=2.
                </p>
              </details>
              <div className="url-preview">
                <code>{preview || `${ELI_BASE}${endpoint}`}</code>
                {preview && <CopyButton value={preview} label="URL" />}
              </div>
              {validation && (
                <p role="alert" className="validation">
                  {validation}
                </p>
              )}
              <div className="request-actions">
                {file ? (
                  preview ? (
                    <a
                      className="button primary"
                      href={preview}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <ExternalLink size={16} /> Otwórz plik
                    </a>
                  ) : (
                    <span>Uzupełnij parametry ścieżki.</span>
                  )
                ) : (
                  <button
                    className="button primary"
                    type="submit"
                    disabled={state.loading}
                  >
                    <Play size={15} />
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
                <span>Publiczne API ELI · bez klucza</span>
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
                  {["data", "json"].map((value) => (
                    <button
                      key={value}
                      className={tab === value ? "active" : ""}
                      onClick={() => setTab(value)}
                    >
                      {value === "json" ? "JSON / źródło" : "Dane"}
                    </button>
                  ))}
                </div>
                {tab === "json" ? (
                  <JsonView data={body} />
                ) : typeof body === "string" ? (
                  <pre className="eli-text">{plain(body)}</pre>
                ) : actsOf(body).length ? (
                  <ActResults
                    body={body}
                    mode="cards"
                    saved={saved}
                    toggleSave={toggleSave}
                  />
                ) : (
                  <JsonView data={body} />
                )}
                {page &&
                  typeof page.totalCount === "number" &&
                  queryFields.some((p) => p.name === "offset") && (
                    <EliPagination
                      offset={page.offset}
                      count={page.items.length}
                      total={page.totalCount}
                      limit={
                        Number(
                          new URL(state.result.url).searchParams.get("limit"),
                        ) ||
                        page.count ||
                        12
                      }
                      onPage={(offset) => {
                        const url = new URL(state.result!.url);
                        url.searchParams.set("offset", String(offset));
                        void execute(url.href);
                      }}
                    />
                  )}
              </>
            ) : (
              <div className="console-empty">
                <Terminal size={28} />
                <h3>Sprawdź odpowiedź u źródła</h3>
                <p>Wybierz endpoint, uzupełnij parametry i wyślij zapytanie.</p>
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
