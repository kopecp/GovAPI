import { useState } from "react";
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Bookmark,
  Code2,
  ExternalLink,
  FileText,
  Scale,
  Search,
} from "lucide-react";
import { routeHref, safeHref } from "./api";
import type { Spec } from "./api";
import {
  actHref,
  actPath,
  ELI_DOCS,
  eliUrl,
  pageOptions,
  parseActId,
  searchUrl,
  textFileUrl,
} from "./eli-api";
import type { Act, ActPage, Publisher } from "./eli-api";
import { ActResults, EliModes, EliPagination, useEli } from "./EliShared";
import type { EliSavedProps } from "./EliShared";
import EliExplorer from "./EliExplorer";
import {
  CopyButton,
  date,
  downloadJson,
  Empty,
  ErrorState,
  JsonView,
  Loading,
  number,
  plain,
} from "./ui";

export const eliTitles: Record<string, string> = {
  "eli-acts": "Akty prawne",
  "eli-journals": "Dzienniki i roczniki",
  "eli-dictionaries": "Słowniki ELI",
  "eli-changes": "Ostatnie zmiany",
  "eli-api": "Eksplorator API",
  "eli-saved": "Zapisane akty",
  "eli-act": "Szczegóły aktu",
};
function Heading({ title, text }: { title: string; text: string }) {
  return (
    <section className="page-heading">
      <div>
        <div className="eyebrow">
          ELI · EUROPEJSKI IDENTYFIKATOR PRAWODAWSTWA
        </div>
        <h1>
          {title}
          <span className="title-dot">.</span>
        </h1>
        <p>{text}</p>
      </div>
      <a className="button" href={ELI_DOCS} target="_blank" rel="noreferrer">
        <BookOpen size={16} /> Dokumentacja <ExternalLink size={13} />
      </a>
    </section>
  );
}
function defaultSince() {
  const now = new Date();
  now.setDate(now.getDate() - 7);
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}T00:00:00`;
}
function EliCatalog({
  params,
  publishers,
  changes = false,
  saved,
  toggleSave,
}: {
  params: URLSearchParams;
  publishers: Publisher[];
  changes?: boolean;
} & EliSavedProps) {
  const initial = new URLSearchParams(params);
  if (changes && !initial.get("since")) initial.set("since", defaultSince());
  const [draft, setDraft] = useState(() => Object.fromEntries(initial));
  const [identifier, setIdentifier] = useState("");
  const [validation, setValidation] = useState("");
  const [revision, setRevision] = useState(0);
  const { loading, error, result } = useEli<ActPage>(
    searchUrl(initial, changes),
    revision,
  );
  const types = useEli<string[]>(changes ? undefined : "/types");
  const mode = params.get("mode") || "cards";
  const { limit, offset } = pageOptions(initial);
  const view = changes ? "eli-changes" : "eli-acts";
  const years = [
    ...new Set(
      publishers
        .filter((p) => !draft.publisher || p.code === draft.publisher)
        .flatMap((p) => p.years),
    ),
  ].sort((a, b) => b - a);
  function update(key: string, value: string) {
    setDraft((d) => ({ ...d, [key]: value }));
  }
  function navigate(values: Record<string, string | number>) {
    window.location.hash = routeHref(view, {
      ...Object.fromEntries(initial),
      ...values,
    });
  }
  function submit() {
    for (const [from, to, label] of [
      ["dateFrom", "dateTo", "wydania"],
      ["pubDateFrom", "pubDateTo", "publikacji"],
      ["dateEffectFrom", "dateEffectTo", "wejścia w życie"],
    ]) {
      if (draft[from] && draft[to] && draft[from] > draft[to]) {
        setValidation(
          `Data ${label} „od” musi być wcześniejsza lub równa dacie „do”.`,
        );
        return;
      }
    }
    setValidation("");
    window.location.hash = routeHref(view, { ...draft, offset: 0, mode });
  }
  function textField(key: string, label: string, type = "text") {
    return (
      <label>
        {label}
        <input
          type={type}
          min={type === "number" ? 0 : undefined}
          value={draft[key] || ""}
          onChange={(e) => update(key, e.target.value)}
        />
      </label>
    );
  }
  return (
    <>
      <Heading
        title={changes ? "Ostatnie zmiany" : "Akty prawne"}
        text={
          changes
            ? "Sprawdzaj aktualizacje metadanych aktów od wybranej daty."
            : "Przeglądaj polskie prawo. Wyszukuj akty, czytaj teksty i odkrywaj ich powiązania."
        }
      />
      {!changes && (
        <>
          <div className="stats-row eli-stats">
            {publishers.map((publisher) => (
              <a
                className={`stat ${params.get("publisher") === publisher.code ? "selected" : ""}`}
                key={publisher.code}
                href={routeHref("eli-acts", { publisher: publisher.code })}
              >
                <Scale size={23} />
                <div>
                  <strong>{number(publisher.actsCount)}</strong>
                  <span>{publisher.name}</span>
                </div>
                <ArrowRight size={16} />
              </a>
            ))}
            <a className="stat" href="#/eli-journals">
              <BookOpen size={23} />
              <div>
                <strong>Roczniki</strong>
                <span>Dzienniki i zeszyty</span>
              </div>
              <ArrowRight size={16} />
            </a>
          </div>
          <form
            className="eli-direct"
            onSubmit={(e) => {
              e.preventDefault();
              const id = parseActId(identifier);
              if (id) window.location.hash = actHref(id);
              else
                setValidation(
                  "Podaj ELI (np. DU/1994/414), link eli.gov.pl lub adres ISAP (np. WDU19940890414).",
                );
            }}
          >
            <label htmlFor="eli-identifier">Otwórz konkretny akt</label>
            <input
              id="eli-identifier"
              placeholder="DU/1994/414 lub link ELI"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
            />
            <button className="button" type="submit">
              Otwórz <ArrowRight size={14} />
            </button>
          </form>
        </>
      )}
      <section className="catalog-panel eli-filters">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          {changes ? (
            <div className="eli-filter-grid">
              <label>
                Zmienione od
                <input
                  type="datetime-local"
                  step="1"
                  required
                  value={draft.since || ""}
                  onChange={(e) =>
                    update(
                      "since",
                      e.target.value.length === 16
                        ? e.target.value + ":00"
                        : e.target.value,
                    )
                  }
                />
              </label>
              <div className="eli-filter-submit">
                <button className="button primary" type="submit">
                  <Search size={16} /> Pokaż zmiany
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="search-bar">
                <Search size={20} />
                <input
                  aria-label="Szukaj w tytule aktu"
                  placeholder="Szukaj w tytule, np. prawo budowlane…"
                  value={draft.title || ""}
                  onChange={(e) => update("title", e.target.value)}
                />
                <button className="button primary" type="submit">
                  Szukaj <ArrowRight size={15} />
                </button>
              </div>
              <div className="eli-filter-grid">
                <label>
                  Dziennik
                  <select
                    value={draft.publisher || ""}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        publisher: e.target.value,
                        year: "",
                        volume: "",
                      }))
                    }
                  >
                    <option value="">Wszystkie dzienniki</option>
                    {publishers.map((p) => (
                      <option key={p.code} value={p.code}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Rok
                  <select
                    value={draft.year || ""}
                    onChange={(e) => update("year", e.target.value)}
                  >
                    <option value="">Wszystkie lata</option>
                    {draft.year && !years.includes(Number(draft.year)) && (
                      <option>{draft.year}</option>
                    )}
                    {years.map((year) => (
                      <option key={year}>{year}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Typ aktu
                  <select
                    value={draft.type || ""}
                    onChange={(e) => update("type", e.target.value)}
                  >
                    <option value="">Wszystkie typy</option>
                    {draft.type && !types.result?.body.includes(draft.type) && (
                      <option>{draft.type}</option>
                    )}
                    {types.result?.body
                      .slice()
                      .sort((a, b) => a.localeCompare(b, "pl"))
                      .map((type) => (
                        <option key={type}>{type}</option>
                      ))}
                  </select>
                </label>
                <label>
                  Obowiązywanie
                  <select
                    value={draft.inForce || ""}
                    onChange={(e) => update("inForce", e.target.value)}
                  >
                    <option value="">Wszystkie akty</option>
                    <option value="1">Tylko obowiązujące</option>
                  </select>
                </label>
              </div>
              <details className="advanced-params">
                <summary>
                  Więcej filtrów: daty, słowa kluczowe, pozycja i zeszyt
                </summary>
                <div className="eli-filter-grid">
                  {textField("keyword", "Słowa kluczowe (oddziel przecinkiem)")}
                  {textField("position", "Pozycja", "number")}
                  {textField("volume", "Numer zeszytu", "number")}
                  {textField("dateFrom", "Data wydania od", "date")}
                  {textField("dateTo", "Data wydania do", "date")}
                  {textField("pubDateFrom", "Publikacja od", "date")}
                  {textField("pubDateTo", "Publikacja do", "date")}
                  {textField("dateEffectFrom", "Wejście w życie od", "date")}
                  {textField("dateEffectTo", "Wejście w życie do", "date")}
                </div>
              </details>
              <div className="eli-filter-grid eli-sort-row">
                <label>
                  Sortowanie
                  <select
                    value={`${draft.sortBy || "publisher"}:${draft.sortDir || "desc"}`}
                    onChange={(e) => {
                      const [sortBy, sortDir] = e.target.value.split(":");
                      setDraft((d) => ({ ...d, sortBy, sortDir }));
                    }}
                  >
                    <option value="publisher:desc">
                      Dziennik, rok i pozycja ↓
                    </option>
                    <option value="publisher:asc">
                      Dziennik, rok i pozycja ↑
                    </option>
                    <option value="change:desc">Ostatnio zmienione</option>
                    <option value="title:asc">Tytuł A–Z</option>
                    <option value="position:desc">Pozycja malejąco</option>
                  </select>
                </label>
                <label>
                  Wyników na stronie
                  <select
                    value={draft.limit || "12"}
                    onChange={(e) => update("limit", e.target.value)}
                  >
                    {[12, 24, 48].map((n) => (
                      <option key={n}>{n}</option>
                    ))}
                  </select>
                </label>
                <div className="eli-filter-submit">
                  <button className="button" type="submit">
                    Zastosuj filtry
                  </button>
                  <a className="button ghost" href="#/eli-acts">
                    Wyczyść
                  </a>
                </div>
              </div>
            </>
          )}
        </form>
      </section>
      {validation && (
        <p className="validation" role="alert">
          {validation}
        </p>
      )}
      <div className="results-toolbar">
        <h2>
          {changes ? "Zmienione akty" : "Wyniki wyszukiwania"}{" "}
          <span>
            {result
              ? `${number(result.body.totalCount)} aktów · ${number(result.ms)} ms`
              : ""}
          </span>
        </h2>
        <EliModes mode={mode} onChange={(mode) => navigate({ mode })} />
      </div>
      {loading ? (
        <Loading cards />
      ) : error ? (
        <ErrorState error={error} retry={() => setRevision((v) => v + 1)} />
      ) : (
        result && (
          <>
            <ActResults
              body={result.body}
              mode={mode}
              saved={saved}
              toggleSave={toggleSave}
            />
            <EliPagination
              offset={result.body.offset ?? offset}
              count={result.body.items.length}
              total={result.body.totalCount}
              limit={limit}
              onPage={(offset) => navigate({ offset })}
            />
            <details className="eli-request-info">
              <summary>Zapytanie źródłowe · HTTP {result.status}</summary>
              <code>{result.url}</code>
              <a
                className="button small"
                href={routeHref("eli-api", {
                  endpoint: changes ? "/changes/acts" : "/acts/search",
                  query: new URL(result.url).searchParams.toString(),
                })}
              >
                <Code2 size={14} /> Otwórz w eksploratorze
              </a>
            </details>
          </>
        )
      )}
    </>
  );
}

function Journals({
  publishers,
  params,
}: {
  publishers: Publisher[];
  params: URLSearchParams;
}) {
  const chosen = publishers.find((p) => p.code === params.get("publisher"));
  const [year, setYear] = useState(params.get("year") || "");
  const [revision, setRevision] = useState(0);
  const volumes = useEli<number[]>(
    chosen && year
      ? `/acts/${encodeURIComponent(chosen.code)}/${encodeURIComponent(year)}/volumes`
      : undefined,
    revision,
  );
  return (
    <>
      <Heading
        title="Dzienniki i roczniki"
        text="Wybierz dziennik urzędowy, a następnie rocznik lub historyczny numer zeszytu."
      />
      <div className="card-grid eli-journals">
        {publishers.map((p) => (
          <article className="data-card" key={p.code}>
            <div className="card-top">
              <span className="type-icon">
                <BookOpen size={22} />
              </span>
              <span className="card-kind">{p.shortName}</span>
            </div>
            <h2>{p.name}</h2>
            <p className="card-description">
              {number(p.actsCount)} aktów · {Math.min(...p.years)}–
              {Math.max(...p.years)}
            </p>
            <a
              className="button"
              href={routeHref("eli-journals", { publisher: p.code })}
            >
              Przeglądaj roczniki <ArrowRight size={15} />
            </a>
          </article>
        ))}
      </div>
      {chosen && (
        <section className="panel eli-year-panel">
          <h2>{chosen.name} · roczniki</h2>
          <div className="eli-year-grid">
            {chosen.years
              .slice()
              .sort((a, b) => b - a)
              .map((year) => (
                <a
                  key={year}
                  href={routeHref("eli-acts", { publisher: chosen.code, year })}
                >
                  {year}
                </a>
              ))}
          </div>
          <div className="eli-filter-grid">
            <label>
              Sprawdź zeszyty w roczniku
              <select value={year} onChange={(e) => setYear(e.target.value)}>
                <option value="">Wybierz rok</option>
                {chosen.years
                  .slice()
                  .sort((a, b) => b - a)
                  .map((year) => (
                    <option key={year}>{year}</option>
                  ))}
              </select>
            </label>
          </div>
          {volumes.loading ? (
            <Loading />
          ) : volumes.error ? (
            <ErrorState
              error={volumes.error}
              retry={() => setRevision((n) => n + 1)}
            />
          ) : (
            volumes.result && (
              <div className="eli-year-grid">
                {volumes.result.body.length ? (
                  volumes.result.body.map((volume) => (
                    <a
                      key={volume}
                      href={routeHref("eli-acts", {
                        publisher: chosen.code,
                        year,
                        volume,
                      })}
                    >
                      {volume === 0 ? "Bez zeszytu" : `Nr ${volume}`}
                    </a>
                  ))
                ) : (
                  <p className="muted">Brak podziału na zeszyty.</p>
                )}
              </div>
            )
          )}
        </section>
      )}
    </>
  );
}
const dictionaries: Record<string, string> = {
  types: "Typy aktów",
  keywords: "Słowa kluczowe",
  institutions: "Instytucje",
  statuses: "Statusy aktów",
  references: "Rodzaje powiązań",
};
function Dictionaries({ params }: { params: URLSearchParams }) {
  const kind =
    params.get("kind") && dictionaries[params.get("kind")!]
      ? params.get("kind")!
      : "types";
  const [filter, setFilter] = useState("");
  const [revision, setRevision] = useState(0);
  const state = useEli<string[]>(`/${kind}`, revision);
  const values = state.result?.body
    .filter((v) =>
      v.toLocaleLowerCase("pl").includes(filter.toLocaleLowerCase("pl")),
    )
    .slice()
    .sort((a, b) => a.localeCompare(b, "pl"));
  return (
    <>
      <Heading
        title="Słowniki ELI"
        text="Poznaj klasyfikację aktów i słownictwo używane w metadanych API."
      />
      <div className="eli-dictionary-tabs">
        {Object.entries(dictionaries).map(([key, label]) => (
          <a
            className={`button ${kind === key ? "primary" : ""}`}
            key={key}
            href={routeHref("eli-dictionaries", { kind: key })}
          >
            {label}
          </a>
        ))}
      </div>
      <div className="search-bar">
        <Search size={18} />
        <input
          aria-label="Filtruj słownik"
          placeholder={`Filtruj: ${dictionaries[kind].toLowerCase()}…`}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>
      {state.loading ? (
        <Loading />
      ) : state.error ? (
        <ErrorState
          error={state.error}
          retry={() => setRevision((n) => n + 1)}
        />
      ) : (
        <>
          <div className="results-toolbar">
            <h2>
              {dictionaries[kind]} <span>{number(values?.length)} pozycji</span>
            </h2>
            {state.result && (
              <button
                className="button small"
                onClick={() =>
                  downloadJson(state.result!.body, `eli-${kind}.json`)
                }
              >
                <ArrowDownToLine size={15} /> JSON
              </button>
            )}
          </div>
          {values?.length ? (
            <div className="eli-dictionary-list">
              {values.map((value) => (
                <div key={value}>
                  <span>{value}</span>
                  {(kind === "types" || kind === "keywords") && (
                    <a
                      className="icon-button"
                      href={routeHref("eli-acts", {
                        [kind === "types" ? "type" : "keyword"]: value,
                      })}
                      aria-label={`Pokaż akty: ${value}`}
                    >
                      <ArrowRight size={16} />
                    </a>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <Empty />
          )}
        </>
      )}
    </>
  );
}

const metadataLabels: Record<string, string> = {
  ELI: "Identyfikator ELI",
  address: "Adres ISAP",
  displayAddress: "Adres publikacyjny",
  title: "Tytuł",
  publisher: "Dziennik",
  year: "Rok",
  pos: "Pozycja",
  volume: "Zeszyt",
  type: "Typ aktu",
  status: "Status aktu",
  inForce: "Obowiązywanie wg API",
  announcementDate: "Data wydania",
  promulgation: "Data ogłoszenia",
  entryIntoForce: "Wejście w życie",
  validFrom: "Obowiązuje od",
  repealDate: "Data uchylenia",
  expirationDate: "Data wygaśnięcia",
  changeDate: "Aktualizacja metadanych",
  legalStatusDate: "Stan prawny na dzień",
  releasedBy: "Organ wydający",
  authorizedBody: "Organ upoważniony",
  obligated: "Organ zobowiązany",
  keywords: "Słowa kluczowe",
  keywordsNames: "Hasła nazwowe",
  comments: "Uwagi",
  previousTitle: "Poprzednie tytuły",
  directives: "Prawo Unii Europejskiej",
  prints: "Druki sejmowe",
  textHTML: "Tekst HTML",
  textPDF: "Tekst PDF",
};
function metadataValue(key: string, value: unknown) {
  if (key === "inForce")
    return (
      {
        IN_FORCE: "Obowiązuje",
        NOT_IN_FORCE: "Nie obowiązuje",
        UNKNOWN: "Nieokreślone",
      }[String(value)] || String(value)
    );
  if (typeof value === "boolean") return value ? "Tak" : "Nie";
  if (
    typeof value === "string" &&
    /Date$|^promulgation$|^entryIntoForce$|^validFrom$/.test(key)
  )
    return date(value);
  if (Array.isArray(value) && value.every((v) => typeof v === "string"))
    return value.join(", ") || "—";
  if (value && typeof value === "object")
    return <pre>{JSON.stringify(value, null, 2)}</pre>;
  return String(value ?? "—");
}
type Reference = { act?: Act; id?: string; date?: string; art?: string };
function References({ id }: { id: string }) {
  const [revision, setRevision] = useState(0);
  const state = useEli<Record<string, Reference[]>>(
    `${actPath(id)}/references`,
    revision,
  );
  if (state.loading) return <Loading />;
  if (state.error)
    return (
      <ErrorState error={state.error} retry={() => setRevision((n) => n + 1)} />
    );
  const groups = Object.entries(state.result?.body || {});
  return groups.length ? (
    <div className="eli-references">
      {groups.map(([label, refs]) => (
        <details className="panel" key={label}>
          <summary>
            {label} <span className="count-badge">{refs.length}</span>
          </summary>
          <ul>
            {refs.map((ref, i) => {
              const target = ref.act?.ELI || ref.id;
              return (
                <li key={`${target}-${i}`}>
                  {target && parseActId(target) ? (
                    <a href={actHref(target)}>
                      <strong>{ref.act?.displayAddress || target}</strong>
                      <span>{ref.act?.title}</span>
                    </a>
                  ) : (
                    <span>{target || "Brak identyfikatora"}</span>
                  )}
                  {ref.art && <small>{ref.art}</small>}
                  {ref.date && <small>Data: {date(ref.date)}</small>}
                </li>
              );
            })}
          </ul>
        </details>
      ))}
    </div>
  ) : (
    <Empty
      title="Brak powiązań"
      text="API nie udostępnia powiązań dla tego aktu."
    />
  );
}
type Structure = { id: string; title?: string; children?: Structure[] };
function StructureTree({ nodes }: { nodes: Structure[] }) {
  return (
    <ul>
      {nodes.map((node, index) => (
        <li key={`${node.id}-${index}`}>
          {node.children?.length ? (
            <details>
              <summary>{node.title || node.id}</summary>
              <StructureTree nodes={node.children} />
            </details>
          ) : (
            <span>{node.title || node.id}</span>
          )}
        </li>
      ))}
    </ul>
  );
}
function ActText({ act }: { act: Act }) {
  const [showText, setShowText] = useState(false);
  const [revision, setRevision] = useState(0);
  const text = useEli<string>(
    showText ? `${actPath(act.ELI)}/text.html` : undefined,
    revision,
  );
  const struct = useEli<Structure[]>(
    showText ? `${actPath(act.ELI)}/struct` : undefined,
    revision,
  );
  return (
    <>
      <section className="panel">
        <h2>Dostępne teksty</h2>
        <p className="muted eli-text-note">
          Wersje i pliki udostępnione przez ELI dla tego aktu.
        </p>
        <div className="eli-files">
          {act.texts?.map((text, i) => (
            <a
              className="eli-file"
              key={`${text.type}-${i}`}
              href={textFileUrl(act, text)}
              target="_blank"
              rel="noreferrer"
            >
              <FileText size={21} />
              <span>
                <strong>
                  {(
                    {
                      H: "Tekst HTML",
                      O: "Tekst ogłoszony",
                      I: "Tekst z ISAP",
                      U: "Tekst ujednolicony",
                    } as Record<string, string>
                  )[text.type] || `Tekst · ${text.type}`}
                </strong>
                <small>{text.fileName}</small>
              </span>
              <ExternalLink size={16} />
            </a>
          ))}
        </div>
        {!act.texts?.length && (
          <p className="muted">Brak listy plików w metadanych.</p>
        )}
        <div className="detail-actions">
          {act.textPDF && (
            <a
              className="button"
              href={eliUrl(`${actPath(act.ELI)}/text.pdf`)}
              target="_blank"
              rel="noreferrer"
            >
              Otwórz PDF <ExternalLink size={14} />
            </a>
          )}
          {act.textHTML && (
            <>
              <a
                className="button"
                href={eliUrl(`${actPath(act.ELI)}/text.html`)}
                target="_blank"
                rel="noreferrer"
              >
                Otwórz HTML <ExternalLink size={14} />
              </a>
              <button
                className="button primary"
                onClick={() => setShowText(!showText)}
              >
                {showText ? "Ukryj podgląd" : "Czytaj tekst tutaj"}
              </button>
            </>
          )}
        </div>
      </section>
      {showText && (
        <>
          {struct.result && Array.isArray(struct.result.body) && (
            <details className="panel eli-structure">
              <summary>Struktura aktu</summary>
              <StructureTree nodes={struct.result.body} />
            </details>
          )}
          {text.loading ? (
            <Loading />
          ) : text.error ? (
            <ErrorState
              error={text.error}
              retry={() => setRevision((n) => n + 1)}
            />
          ) : (
            text.result && (
              <section className="panel">
                <h2>Tekst aktu</h2>
                <p className="muted eli-text-note">
                  Podgląd tekstowy. Oryginalny układ, tabele i przypisy
                  sprawdzisz w pliku źródłowym.
                </p>
                <pre className="eli-text">{plain(text.result.body)}</pre>
              </section>
            )
          )}
        </>
      )}
    </>
  );
}
function ActDetail({
  params,
  saved,
  toggleSave,
}: { params: URLSearchParams } & EliSavedProps) {
  const id = parseActId(params.get("id") || "");
  const [revision, setRevision] = useState(0);
  const [tab, setTab] = useState("metadata");
  const state = useEli<Act>(id ? actPath(id) : undefined, revision);
  if (!id)
    return (
      <Empty
        title="Nieprawidłowy identyfikator aktu"
        text="Wróć do wyszukiwarki i podaj identyfikator ELI, np. DU/1994/414."
      />
    );
  if (state.loading) return <Loading />;
  if (state.error)
    return (
      <ErrorState error={state.error} retry={() => setRevision((n) => n + 1)} />
    );
  const act = state.result?.body;
  if (!act) return null;
  const bookmarked = saved.some((s) => s.ELI === act.ELI);
  return (
    <>
      <a
        className="back-link"
        href={routeHref("eli-acts", {
          publisher: act.publisher,
          year: act.year,
        })}
      >
        <ArrowLeft size={15} /> Akty w roczniku {act.year}
      </a>
      <section className="detail-heading">
        <div className="eyebrow">
          {act.displayAddress || act.ELI} · {act.type}
        </div>
        <h1>{act.title}</h1>
        <div className="tags">
          <span
            className={`eli-status ${act.inForce === "IN_FORCE" ? "in-force" : ""}`}
          >
            {act.status || "Brak statusu"}
          </span>
          <span>{act.ELI}</span>
        </div>
      </section>
      <div className="detail-actions">
        <button
          className="button"
          aria-pressed={bookmarked}
          onClick={() => toggleSave(act)}
        >
          <Bookmark size={16} />{" "}
          {bookmarked ? "Usuń z zapisanych" : "Zapisz akt"}
        </button>
        <a
          className="button"
          href={`https://eli.gov.pl/eli/${act.ELI}/ogl`}
          target="_blank"
          rel="noreferrer"
        >
          Zobacz w ELI <ExternalLink size={14} />
        </a>
        <CopyButton
          value={`https://eli.gov.pl/eli/${act.ELI}`}
          label="Kopiuj ELI"
        />
        <a
          className="button"
          href={routeHref("eli-api", {
            endpoint: "/acts/{publisher}/{year}/{position}",
            publisher: act.ELI.split("/")[0],
            year: act.ELI.split("/")[1],
            position: act.ELI.split("/")[2],
          })}
        >
          <Code2 size={16} /> API
        </a>
      </div>
      <div className="tabs">
        {[
          ["metadata", "Metadane"],
          ["texts", "Teksty aktu"],
          ["references", "Powiązania"],
          ["json", "JSON"],
        ].map(([key, label]) => (
          <button
            className={tab === key ? "active" : ""}
            key={key}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "json" ? (
        <JsonView data={act} />
      ) : tab === "references" ? (
        <References id={act.ELI} />
      ) : tab === "texts" ? (
        <ActText act={act} />
      ) : (
        <>
          {act.keywords?.length ? (
            <section className="panel">
              <h2>Słowa kluczowe</h2>
              <div className="eli-keywords">
                {act.keywords.map((keyword) => (
                  <a
                    className="filter-chip"
                    key={keyword}
                    href={routeHref("eli-acts", { keyword })}
                  >
                    {keyword} <ArrowRight size={12} />
                  </a>
                ))}
              </div>
            </section>
          ) : null}
          <section className="panel">
            <h2>Informacje o akcie</h2>
            <dl className="metadata">
              {Object.entries(act)
                .filter(([key]) => !["texts", "references"].includes(key))
                .map(([key, value]) => (
                  <div key={key}>
                    <dt>{metadataLabels[key] || key}</dt>
                    <dd>{metadataValue(key, value)}</dd>
                  </div>
                ))}
            </dl>
          </section>
          {Array.isArray(act.prints) && act.prints.length > 0 && (
            <section className="panel">
              <h2>Przebieg prac legislacyjnych</h2>
              <div className="eli-keywords">
                {act.prints.map(
                  (print: any, i) =>
                    safeHref(print.link) && (
                      <a
                        key={i}
                        className="button"
                        href={safeHref(print.link)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Druk {print.number} · kadencja {print.term}{" "}
                        <ExternalLink size={14} />
                      </a>
                    ),
                )}
              </div>
            </section>
          )}
        </>
      )}
    </>
  );
}

export default function EliView({
  view,
  params,
  publishers,
  saved,
  toggleSave,
  spec,
  specError,
}: {
  view: string;
  params: URLSearchParams;
  publishers: Publisher[];
  spec?: Spec;
  specError?: Error;
} & EliSavedProps) {
  if (view === "eli-api")
    return spec ? (
      <EliExplorer
        spec={spec}
        params={params}
        saved={saved}
        toggleSave={toggleSave}
      />
    ) : specError ? (
      <ErrorState error={specError} retry={() => location.reload()} />
    ) : (
      <Loading />
    );
  if (view === "eli-act")
    return <ActDetail params={params} saved={saved} toggleSave={toggleSave} />;
  if (view === "eli-journals")
    return <Journals publishers={publishers} params={params} />;
  if (view === "eli-dictionaries") return <Dictionaries params={params} />;
  if (view === "eli-saved")
    return (
      <>
        <Heading
          title="Zapisane akty"
          text="Twoja kolekcja aktów prawnych zapisana w tej przeglądarce."
        />
        {saved.length ? (
          <>
            <div className="results-toolbar">
              <p className="saved-note">
                Informacje z chwili zapisu. Otwórz akt, aby pobrać aktualne
                metadane.
              </p>
              <button
                className="button"
                onClick={() => downloadJson(saved, "eli-zapisane.json")}
              >
                <ArrowDownToLine size={16} /> Eksportuj zakładki
              </button>
            </div>
            <ActResults
              body={saved}
              mode="cards"
              saved={saved}
              toggleSave={toggleSave}
            />
          </>
        ) : (
          <Empty
            title="Zachowaj interesujące akty"
            text="Kliknij ikonę zakładki przy akcie, aby wrócić do niego później."
          />
        )}
      </>
    );
  return (
    <EliCatalog
      params={params}
      publishers={publishers}
      changes={view === "eli-changes"}
      saved={saved}
      toggleSave={toggleSave}
    />
  );
}
