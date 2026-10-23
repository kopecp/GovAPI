import { useState } from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  Bookmark,
  Building2,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Database,
  ExternalLink,
  FileText,
  Filter,
  LayoutGrid,
  List,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import {
  API_BASE,
  explorerRoute,
  itemUrl,
  itemsOf,
  routeHref,
  safeHref,
  withQuery,
} from "./api";
import type { ApiItem, ApiResponse } from "./api";
import {
  CopyButton,
  date,
  Empty,
  ErrorState,
  JsonView,
  Loading,
  number,
  plain,
  useApi,
} from "./ui";

export const collections: Record<
  string,
  { title: string; singular: string; description: string }
> = {
  datasets: {
    title: "Zbiory danych",
    singular: "Zbiór danych",
    description:
      "Odkrywaj dane, które mają znaczenie. Wyszukuj, filtruj i zaglądaj głębiej.",
  },
  resources: {
    title: "Zasoby",
    singular: "Zasób",
    description:
      "Pliki, tabele i usługi. Znajdź konkretne dane gotowe do wykorzystania.",
  },
  institutions: {
    title: "Dostawcy danych",
    singular: "Dostawca",
    description:
      "Poznaj instytucje i organizacje, które udostępniają otwarte dane.",
  },
  showcases: {
    title: "Zastosowania",
    singular: "Zastosowanie",
    description: "Zobacz, co powstaje dzięki otwartym danym.",
  },
  histories: {
    title: "Historia zmian",
    singular: "Zmiana",
    description: "Sprawdzaj zmiany publikowane w katalogu danych.",
  },
  search: {
    title: "Szukaj wszędzie",
    singular: "Wynik",
    description:
      "Jedno zapytanie w całym katalogu: zbiory, zasoby, dostawcy i zastosowania.",
  },
};
export function itemTitle(item: ApiItem) {
  return plain(
    item.attributes?.title ||
      item.attributes?.name ||
      item.attributes?.message ||
      `${item.type} #${item.id}`,
  );
}
export function itemKind(item: ApiItem) {
  return (
    {
      dataset: "Zbiór danych",
      resource: "Zasób",
      institution: "Dostawca",
      showcase: "Zastosowanie",
      history: "Zmiana",
    }[item.type] || item.type
  );
}
const relationTitle = (name: string) =>
  collections[name]?.title ||
  {
    institution: "Dostawca danych",
    dataset: "Zbiór danych",
    resource: "Zasób",
    showcase: "Zastosowanie",
  }[name] ||
  name;
export function isSaved(item: ApiItem, saved: ApiItem[]) {
  return saved.some((s) => s.id === item.id && s.type === item.type);
}
export type SavedProps = {
  saved: ApiItem[];
  toggleSave: (item: ApiItem) => void;
};

export function DataCard({
  item,
  included = [],
  saved,
  toggleSave,
}: { item: ApiItem; included?: ApiItem[] } & SavedProps) {
  const a = item.attributes || {};
  const url = itemUrl(item);
  const relation = item.relationships?.institution?.data;
  const owner = included.find(
    (i) => i.type === relation?.type && i.id === relation?.id,
  );
  const formats: string[] = a.formats || (a.format ? [a.format] : []);
  const Icon =
    item.type === "institution"
      ? Building2
      : item.type === "resource"
        ? FileText
        : Database;
  return (
    <article className="data-card">
      <div className="card-top">
        <span className={`type-icon ${item.type}`}>
          <Icon size={20} />
        </span>
        <span className="card-kind">{itemKind(item)}</span>
        <button
          className={`icon-button bookmark ${isSaved(item, saved) ? "saved" : ""}`}
          aria-label={
            isSaved(item, saved)
              ? `Usuń z zapisanych: ${itemTitle(item)}`
              : `Zapisz: ${itemTitle(item)}`
          }
          aria-pressed={isSaved(item, saved)}
          onClick={() => toggleSave(item)}
        >
          <Bookmark size={18} />
        </button>
      </div>
      <h3>
        {url ? (
          <a href={routeHref("item", { url })}>{itemTitle(item)}</a>
        ) : (
          itemTitle(item)
        )}
      </h3>
      {owner && (
        <div className="card-owner">
          <Building2 size={13} />
          {plain(owner.attributes.title)}
        </div>
      )}
      <p className="card-description">
        {plain(
          a.notes ||
            a.description ||
            a.message ||
            a.city ||
            "Otwórz szczegóły, aby poznać dostępne dane i powiązania.",
        )}
      </p>
      <div className="tags">
        {formats.slice(0, 4).map((f) => (
          <span className={`format format-${String(f).toLowerCase()}`} key={f}>
            {f}
          </span>
        ))}
        {formats.length > 4 && (
          <span className="tag">+{formats.length - 4}</span>
        )}
        {a.categories?.[0]?.title && (
          <span className="category-tag">{a.categories[0].title}</span>
        )}
      </div>
      <div className="card-bottom">
        <span>
          <CalendarDays size={13} />
          {date(a.modified || a.change_timestamp || a.created)}
        </span>
        {item.relationships?.resources?.meta?.count != null ? (
          <span>{number(item.relationships.resources.meta.count)} zasobów</span>
        ) : (
          <span>#{item.id}</span>
        )}
        {url && (
          <a
            className="card-arrow"
            href={routeHref("item", { url })}
            aria-label={`Otwórz: ${itemTitle(item)}`}
          >
            <ArrowRight size={16} />
          </a>
        )}
      </div>
    </article>
  );
}

function updateQuery(
  view: string,
  params: URLSearchParams,
  values: Record<string, string | number | undefined>,
) {
  const next: Record<string, string | number | undefined> =
    Object.fromEntries(params);
  Object.assign(next, { page: undefined }, values);
  window.location.hash = routeHref(view, next);
}
export function Pagination({
  body,
  page,
  perPage,
  change,
}: {
  body: ApiResponse;
  page: number;
  perPage: number;
  change: (page: number) => void;
}) {
  const count = body.meta?.count;
  const lastLink = body.links?.last;
  const last = lastLink
    ? Number(new URL(lastLink, API_BASE).searchParams.get("page"))
    : undefined;
  const pages =
    count == null
      ? undefined
      : Math.min(Math.ceil(count / perPage), last || Infinity);
  return (
    <div className="pagination">
      <span>
        Strona <strong>{page}</strong>
        {pages ? ` z ${number(pages)}` : ""}
        {count != null && (
          <span className="pagination-total"> · {number(count)} wyników</span>
        )}
      </span>
      <div>
        <button
          className="button small"
          disabled={page <= 1}
          onClick={() => change(page - 1)}
        >
          <ChevronLeft size={16} /> Poprzednia
        </button>
        <button
          className="button small"
          disabled={!body.links?.next}
          onClick={() => change(page + 1)}
        >
          Następna <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

export function Catalog({
  view,
  params,
  saved,
  toggleSave,
  counts,
}: {
  view: string;
  params: URLSearchParams;
  counts: Record<string, number | undefined>;
} & SavedProps) {
  const related = view === "browse";
  const config = collections[view] || {
    title: params.get("title") || "Powiązane dane",
    description: "Przeglądaj zasoby powiązane z wybranym rekordem.",
  };
  const [draft, setDraft] = useState(params.get("q") || "");
  const [layout, setLayout] = useState("grid");
  const [raw, setRaw] = useState(false);
  const [revision, setRevision] = useState(0);
  const page = Math.max(1, Number(params.get("page")) || 1);
  const perPage = Number(params.get("per_page")) || 12;
  const path = related ? params.get("path") || "/datasets" : `/${view}`;
  const isData = /\/(datasets|resources)$/.test(path) || view === "search";
  const supportsSearch = !path.endsWith("/showcases");
  let url = "",
    pathError: Error | undefined;
  try {
    url = withQuery(path, {
      page,
      per_page: perPage,
      q: params.get("q") || undefined,
      sort:
        params.get("sort") ||
        (view === "histories"
          ? "-change_timestamp"
          : view === "search" || !supportsSearch
            ? undefined
            : "-modified"),
      format: params.get("format") || undefined,
      "categories[id]": params.get("category") || undefined,
      has_high_value_data: params.get("high") || undefined,
      include: /\/datasets$/.test(path) ? "institution" : undefined,
    });
  } catch (e) {
    pathError = e as Error;
  }
  const state = useApi(url || undefined, revision);
  const items = itemsOf(state.body);
  const change = (values: Record<string, string | number | undefined>) =>
    updateQuery(view, params, values);
  const filtered = ["q", "format", "category", "high"].some((k) =>
    params.has(k),
  );
  return (
    <>
      <section className="page-heading">
        <div>
          <div className="eyebrow">KATALOG OTWARTYCH DANYCH</div>
          <h1>
            {config.title}
            <span className="title-dot">.</span>
          </h1>
          <p>{config.description}</p>
        </div>
        <a
          className="button"
          href={url ? explorerRoute(url) : routeHref("api")}
        >
          <span className="code-symbol">&lt;/&gt;</span> Otwórz w API{" "}
          <ArrowRight size={16} />
        </a>
      </section>
      {!related && (
        <div className="stats-row">
          {[
            ["datasets", "zbiorów danych", Database],
            ["resources", "zasobów do odkrycia", FileText],
            ["institutions", "dostawców danych", Building2],
          ].map(([key, label, Icon]) => {
            const I = Icon as typeof Database;
            return (
              <a
                href={routeHref(key as string)}
                className="stat"
                key={key as string}
              >
                <I size={22} />
                <div>
                  <strong>{number(counts[key as string])}</strong>
                  <span>{label as string}</span>
                </div>
                <ArrowRight size={15} />
              </a>
            );
          })}
        </div>
      )}
      <div className="catalog-panel">
        <form
          className="search-bar"
          onSubmit={(e) => {
            e.preventDefault();
            change({ q: draft.trim() || undefined });
          }}
        >
          <Search size={21} />
          <input
            aria-label="Szukaj w katalogu"
            placeholder={
              supportsSearch
                ? "Jakich danych szukasz? np. transport, ludność, jakość powietrza…"
                : "Przeglądaj zastosowania danych poniżej"
            }
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            disabled={!supportsSearch}
          />
          {draft && (
            <button
              type="button"
              className="icon-button"
              aria-label="Wyczyść wyszukiwanie"
              onClick={() => {
                setDraft("");
                change({ q: undefined });
              }}
            >
              <X size={16} />
            </button>
          )}
          <button
            type="submit"
            className="button primary"
            disabled={!supportsSearch}
          >
            Szukaj <ArrowRight size={16} />
          </button>
        </form>
        <div className="filter-row">
          <span className="filter-label">
            <SlidersHorizontal size={16} /> Filtry
          </span>
          {isData && (
            <>
              <label>
                <span className="sr-only">Format pliku</span>
                <select
                  value={params.get("format") || ""}
                  onChange={(e) =>
                    change({ format: e.target.value || undefined })
                  }
                >
                  <option value="">Wszystkie formaty</option>
                  {[
                    "csv",
                    "xlsx",
                    "xls",
                    "json",
                    "jsonld",
                    "xml",
                    "pdf",
                    "zip",
                  ].map((f) => (
                    <option key={f} value={f}>
                      {f.toUpperCase()}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className={`filter-chip ${params.has("high") ? "active" : ""}`}
                onClick={() =>
                  change({ high: params.has("high") ? undefined : "true" })
                }
              >
                Dane o wysokiej wartości {params.has("high") && <X size={13} />}
              </button>
            </>
          )}
          <label className="sort-select">
            <span>Sortuj:</span>
            <select
              aria-label="Sortowanie"
              value={
                params.get("sort") ||
                (view === "histories"
                  ? "-change_timestamp"
                  : view === "search" || !supportsSearch
                    ? ""
                    : "-modified")
              }
              onChange={(e) => change({ sort: e.target.value || undefined })}
            >
              {view === "histories" ? (
                <>
                  <option value="-change_timestamp">Najnowsze zmiany</option>
                  <option value="change_timestamp">Najstarsze zmiany</option>
                </>
              ) : view === "search" || !supportsSearch ? (
                <option value="">Domyślnie</option>
              ) : (
                <>
                  <option value="-modified">Ostatnio zaktualizowane</option>
                  <option value="-created">Najnowsze</option>
                  <option value="title">Nazwa A–Z</option>
                  {isData && (
                    <option value="-views_count">Najpopularniejsze</option>
                  )}
                </>
              )}
            </select>
          </label>
        </div>
      </div>
      {filtered && (
        <div className="active-filters">
          <Filter size={14} />
          <span>Aktywne filtry</span>
          {params.get("q") && <span className="tag">„{params.get("q")}”</span>}
          {params.get("format") && (
            <span className="tag">{params.get("format")?.toUpperCase()}</span>
          )}
          {params.get("high") && <span className="tag">Wysoka wartość</span>}
          <button
            className="text-button"
            onClick={() => {
              setDraft("");
              change({
                q: undefined,
                format: undefined,
                category: undefined,
                high: undefined,
              });
            }}
          >
            Wyczyść wszystkie
          </button>
        </div>
      )}
      <div className="results-toolbar">
        <h2>
          {state.loading
            ? "Pobieranie danych…"
            : `${number(state.body?.meta?.count ?? items.length)} wyników`}
          <span>
            {related ? "Powiązane rekordy" : "Bezpośrednio z dane.gov.pl"}
          </span>
        </h2>
        <div className="view-switch">
          <button
            className={!raw && layout === "grid" ? "selected" : ""}
            aria-label="Widok kart"
            onClick={() => {
              setLayout("grid");
              setRaw(false);
            }}
          >
            <LayoutGrid size={17} />
          </button>
          <button
            className={!raw && layout === "list" ? "selected" : ""}
            aria-label="Widok listy"
            onClick={() => {
              setLayout("list");
              setRaw(false);
            }}
          >
            <List size={18} />
          </button>
          <button
            className={raw ? "selected" : ""}
            onClick={() => setRaw(true)}
          >
            JSON
          </button>
        </div>
      </div>
      {pathError || state.error ? (
        <ErrorState
          error={pathError || state.error!}
          retry={() => setRevision((v) => v + 1)}
        />
      ) : state.loading ? (
        <Loading cards />
      ) : raw ? (
        <JsonView data={state.body} />
      ) : !items.length ? (
        <Empty />
      ) : (
        <div
          className={layout === "grid" ? "card-grid" : "card-grid list-layout"}
        >
          {items.map((item, i) => (
            <DataCard
              item={item}
              included={state.body?.included}
              saved={saved}
              toggleSave={toggleSave}
              key={`${item.type}-${item.id}-${i}`}
            />
          ))}
        </div>
      )}
      {state.body && (
        <Pagination
          body={state.body}
          page={page}
          perPage={perPage}
          change={(page) => change({ page })}
        />
      )}
      <div className="request-foot">
        <span className="method">GET</span>
        <a href={url} target="_blank" rel="noreferrer">
          {url.replace(API_BASE, "/1.4")} <ExternalLink size={12} />
        </a>
      </div>
    </>
  );
}

const fieldLabels: Record<string, string> = {
  modified: "Ostatnia aktualizacja",
  created: "Data publikacji",
  verified: "Weryfikacja",
  license_name: "Licencja",
  update_frequency: "Częstotliwość aktualizacji",
  format: "Format",
  file_size: "Rozmiar pliku (bajty)",
  openness_score: "Poziom otwartości",
  views_count: "Wyświetlenia",
  downloads_count: "Pobrania",
  city: "Miasto",
  regon: "REGON",
  email: "E-mail",
  tel: "Telefon",
  website: "Strona WWW",
  data_date: "Data danych",
  language: "Język",
};
export function ItemDetail({
  url,
  saved,
  toggleSave,
}: { url: string } & SavedProps) {
  const [revision, setRevision] = useState(0);
  const [tab, setTab] = useState("overview");
  const state = useApi(url, revision);
  const item = itemsOf(state.body)[0];
  if (state.loading) return <Loading />;
  if (state.error)
    return (
      <ErrorState error={state.error} retry={() => setRevision((v) => v + 1)} />
    );
  if (!item) return <JsonView data={state.body} />;
  const a = item.attributes || {};
  const links = Object.entries(item.relationships || {}).filter(
    ([, r]) => r.links?.related,
  );
  const downloads = [
    ["Plik źródłowy", a.download_url || a.file_url || a.link],
    ["CSV", a.csv_download_url || a.csv_file_url],
    ["JSON-LD", a.jsonld_download_url || a.jsonld_file_url],
  ].filter(([, v]) => safeHref(v));
  const table =
    item.type === "resource" && a.visualization_types?.includes("table");
  return (
    <>
      <a
        className="back-link"
        href={routeHref(
          {
            dataset: "datasets",
            resource: "resources",
            institution: "institutions",
            showcase: "showcases",
            history: "histories",
          }[item.type] || "datasets",
        )}
      >
        <ChevronLeft size={16} /> Wróć do katalogu
      </a>
      <section className="detail-heading">
        <div className="eyebrow">
          {itemKind(item)} · #{item.id}
        </div>
        <h1>{itemTitle(item)}</h1>
        <div className="detail-actions">
          <button
            className={`button ${isSaved(item, saved) ? "saved" : ""}`}
            onClick={() => toggleSave(item)}
          >
            <Bookmark size={16} />
            {isSaved(item, saved) ? "Zapisano" : "Zapisz na później"}
          </button>
          <CopyButton
            value={`${window.location.origin}${window.location.pathname}${routeHref("item", { url })}`}
            label="Kopiuj link"
          />
          <a className="button" href={url} target="_blank" rel="noreferrer">
            <ExternalLink size={16} /> Odpowiedź API
          </a>
          {table && (
            <a
              className="button primary"
              href={routeHref("api", {
                endpoint: "/resources/{id}/data",
                id: item.id,
              })}
            >
              <List size={16} /> Przeglądaj tabelę
            </a>
          )}
        </div>
      </section>
      <div className="tabs">
        <button
          className={tab === "overview" ? "active" : ""}
          onClick={() => setTab("overview")}
        >
          Przegląd
        </button>
        <button
          className={tab === "metadata" ? "active" : ""}
          onClick={() => setTab("metadata")}
        >
          Wszystkie metadane
        </button>
        <button
          className={tab === "json" ? "active" : ""}
          onClick={() => setTab("json")}
        >
          JSON
        </button>
      </div>
      {tab === "json" ? (
        <JsonView data={state.body} />
      ) : tab === "metadata" ? (
        <div className="panel">
          <Metadata attributes={a} />
        </div>
      ) : (
        <div className="detail-columns">
          <div>
            <section className="panel">
              <h2>O danych</h2>
              <p className="description-full">
                {plain(a.notes || a.description || a.message) ||
                  "Dostawca nie udostępnił opisu."}
              </p>
              <div className="tags">
                {(a.keywords || []).map((k: string) => (
                  <a
                    className="tag"
                    key={k}
                    href={routeHref("search", { q: k })}
                  >
                    {k}
                  </a>
                ))}
              </div>
            </section>
            <section className="panel">
              <h2>
                Powiązane dane{" "}
                <span className="count-badge">{links.length}</span>
              </h2>
              {links.length ? (
                <div className="related-links">
                  {links.map(([name, r]) => {
                    const single = r.data && !Array.isArray(r.data);
                    return (
                      <a
                        key={name}
                        href={routeHref(
                          single ? "item" : "browse",
                          single
                            ? { url: r.links!.related }
                            : {
                                path: r.links!.related,
                                title: relationTitle(name),
                              },
                        )}
                      >
                        <span className="type-icon">
                          <Database size={18} />
                        </span>
                        <div>
                          <strong>{relationTitle(name)}</strong>
                          <span>
                            {r.meta?.count != null
                              ? `${number(r.meta.count)} rekordów`
                              : "Otwórz powiązanie"}
                          </span>
                        </div>
                        <ArrowRight size={18} />
                      </a>
                    );
                  })}
                </div>
              ) : (
                <p className="muted">API nie zwróciło powiązań.</p>
              )}
            </section>
            {item.type === "resource" && !table && (
              <div className="info-note">
                Podgląd wierszy jest dostępny, gdy API udostępnia zasób jako
                tabelę. Pozostałe dane otworzysz w pliku źródłowym.
              </div>
            )}
          </div>
          <aside>
            <section className="panel">
              <h2>Informacje</h2>
              <dl className="info-list">
                {Object.entries(fieldLabels)
                  .filter(
                    ([k]) => a[k] !== undefined && a[k] !== null && a[k] !== "",
                  )
                  .map(([key, label]) => (
                    <div key={key}>
                      <dt>{label}</dt>
                      <dd>
                        {[
                          "created",
                          "modified",
                          "verified",
                          "data_date",
                        ].includes(key)
                          ? date(a[key])
                          : plain(a[key])}
                      </dd>
                    </div>
                  ))}
              </dl>
            </section>
            {downloads.length > 0 && (
              <section className="panel">
                <h2>Pliki do pobrania</h2>
                <div className="download-list">
                  {downloads.map(([label, value]) => (
                    <a
                      className="button"
                      href={safeHref(value)}
                      target="_blank"
                      rel="noreferrer"
                      key={label}
                    >
                      <ArrowDownToLine size={16} />
                      {label}
                      <ExternalLink size={13} />
                    </a>
                  ))}
                </div>
              </section>
            )}
            {a.license_description && (
              <section className="panel">
                <h2>Warunki wykorzystania</h2>
                <p className="description-full">
                  {plain(a.license_description)}
                </p>
              </section>
            )}
          </aside>
        </div>
      )}
    </>
  );
}
export function Metadata({ attributes }: { attributes: Record<string, any> }) {
  return (
    <dl className="metadata">
      {Object.entries(attributes).map(([key, value]) => (
        <div key={key}>
          <dt>{fieldLabels[key] || key}</dt>
          <dd>
            {value == null || value === "" ? (
              <span className="muted">Brak</span>
            ) : typeof value === "boolean" ? (
              value ? (
                "Tak"
              ) : (
                "Nie"
              )
            ) : typeof value === "object" ? (
              <pre>{JSON.stringify(value, null, 2)}</pre>
            ) : safeHref(value) ? (
              <a href={safeHref(value)} target="_blank" rel="noreferrer">
                {String(value)} <ExternalLink size={12} />
              </a>
            ) : (
              plain(value)
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}
