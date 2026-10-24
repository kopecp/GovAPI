import { useEffect, useState } from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  BookOpen,
  Bookmark,
  Building2,
  Check,
  ChevronRight,
  Code2,
  Database,
  ExternalLink,
  FileText,
  GitFork,
  History,
  Layers3,
  Menu,
  Search,
  Scale,
  Sparkles,
  X,
} from "lucide-react";
import { DOCS_URL, request, routeHref } from "./api";
import type { ApiItem, Spec } from "./api";
import { Catalog, collections, DataCard, ItemDetail, isSaved } from "./catalog";
import Explorer from "./Explorer";
import EliView, { eliTitles } from "./Eli";
import { ELI_DOCS, ELI_SAVED_KEY, eliRequest, readSavedActs } from "./eli-api";
import type { Act, Publisher } from "./eli-api";
import { downloadJson, Empty, ErrorState, Loading } from "./ui";

function readRoute() {
  const [view, query] = window.location.hash.slice(2).split("?");
  return { view: view || "datasets", params: new URLSearchParams(query) };
}
function readSaved(): ApiItem[] {
  try {
    const data = JSON.parse(localStorage.getItem("govapi:saved:v1") || "[]");
    return Array.isArray(data)
      ? data.filter(
          (i) =>
            i &&
            typeof i.id === "string" &&
            typeof i.type === "string" &&
            i.attributes &&
            typeof i.attributes === "object",
        )
      : [];
  } catch {
    return [];
  }
}
export default function App() {
  const [route, setRoute] = useState(readRoute);
  const isEli = route.view.startsWith("eli-");
  const [saved, setSaved] = useState<ApiItem[]>(readSaved);
  const [savedActs, setSavedActs] = useState<Act[]>(() => {
    try {
      return readSavedActs(localStorage.getItem(ELI_SAVED_KEY));
    } catch {
      return [];
    }
  });
  const [publishers, setPublishers] = useState<Publisher[]>([]);
  const [publisherError, setPublisherError] = useState<Error>();
  const [connectionRevision, setConnectionRevision] = useState(0);
  const [notice, setNotice] = useState("");
  const [menu, setMenu] = useState(false);
  const [counts, setCounts] = useState<Record<string, number | undefined>>({});
  const [apiStatus, setApiStatus] = useState("Łączenie z API");
  const [loadedSpec, setSpec] = useState<{ eli: boolean; value: Spec }>();
  const spec = loadedSpec?.eli === isEli ? loadedSpec.value : undefined;
  const [specError, setSpecError] = useState<Error>();
  useEffect(() => {
    const handler = () => {
      setRoute(readRoute());
      setMenu(false);
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, []);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 4000);
    return () => clearTimeout(t);
  }, [notice]);
  useEffect(() => {
    const controller = new AbortController();
    setApiStatus("Łączenie z API");
    setSpec(undefined);
    setSpecError(undefined);
    setPublisherError(undefined);
    if (isEli) {
      eliRequest<Publisher[]>("/acts", controller.signal)
        .then((r) => {
          if (!controller.signal.aborted) {
            setPublishers(r.body);
            setApiStatus("API dostępne");
          }
        })
        .catch((error: Error) => {
          if (!controller.signal.aborted) {
            setPublisherError(error);
            setApiStatus("Sprawdź połączenie");
          }
        });
    } else
      Promise.allSettled(
        ["datasets", "resources", "institutions"].map(async (key) => {
          const r = await request(`/${key}?per_page=1`, controller.signal);
          if (!controller.signal.aborted)
            setCounts((v) => ({ ...v, [key]: r.body.meta?.count }));
        }),
      ).then((results) => {
        if (!controller.signal.aborted)
          setApiStatus(
            results.every((r) => r.status === "fulfilled")
              ? "API dostępne"
              : "Sprawdź połączenie",
          );
      });
    fetch(isEli ? "./eli-openapi.json" : "./openapi.json", {
      signal: controller.signal,
    })
      .then((r) => {
        if (!r.ok) throw new Error("Nie można pobrać specyfikacji");
        return r.json();
      })
      .then((value: Spec) => {
        if (!controller.signal.aborted) setSpec({ eli: isEli, value });
      })
      .catch((e) => {
        if (!controller.signal.aborted) setSpecError(e);
      });
    return () => controller.abort();
  }, [isEli, connectionRevision]);
  function toggleActSave(act: Act) {
    const exists = savedActs.some((s) => s.ELI === act.ELI);
    const next = exists
      ? savedActs.filter((s) => s.ELI !== act.ELI)
      : [...savedActs, act];
    try {
      localStorage.setItem(ELI_SAVED_KEY, JSON.stringify(next));
      setSavedActs(next);
      setNotice(
        exists
          ? "Usunięto akt z zapisanych"
          : "Zapisano akt w tej przeglądarce",
      );
    } catch {
      setNotice(
        "Nie udało się zapisać. Pamięć przeglądarki może być pełna lub niedostępna.",
      );
    }
  }
  function toggleSave(item: ApiItem) {
    const exists = isSaved(item, saved);
    const next = exists
      ? saved.filter((s) => !(s.id === item.id && s.type === item.type))
      : [...saved, item];
    try {
      localStorage.setItem("govapi:saved:v1", JSON.stringify(next));
      setSaved(next);
      setNotice(
        exists ? "Usunięto z zapisanych" : "Zapisano w tej przeglądarce",
      );
    } catch {
      setNotice(
        "Nie udało się zapisać. Pamięć przeglądarki może być pełna lub niedostępna.",
      );
    }
  }
  const nav = isEli
    ? ([
        ["eli-acts", Scale],
        ["eli-journals", BookOpen],
        ["eli-dictionaries", Layers3],
        ["eli-changes", History],
      ] as const)
    : ([
        ["datasets", Database],
        ["resources", FileText],
        ["institutions", Building2],
        ["showcases", Sparkles],
        ["histories", History],
        ["search", Search],
      ] as const);
  const title =
    eliTitles[route.view] ||
    collections[route.view]?.title ||
    {
      api: "Eksplorator API",
      saved: "Zapisane",
      item: "Szczegóły rekordu",
      browse: "Powiązane dane",
    }[route.view] ||
    "Katalog";
  return (
    <div className={`app ${isEli ? "eli-app" : ""}`}>
      <a
        className="skip-link"
        href="#main-content"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("main-content")?.focus();
        }}
      >
        Przejdź do treści
      </a>
      {menu && (
        <button
          aria-label="Zamknij menu"
          className="menu-backdrop"
          onClick={() => setMenu(false)}
        />
      )}
      <aside className={`sidebar ${menu ? "open" : ""}`}>
        <a className="brand" href={isEli ? "#/eli-acts" : "#/datasets"}>
          <span className="brand-icon">
            {isEli ? <Scale size={24} /> : <Database size={24} />}
          </span>
          <span>
            Gov<span className="brand-accent">API</span>
            <small>OTWARTE DANE. NOWE MOŻLIWOŚCI.</small>
          </span>
        </a>
        <button
          className="mobile-close icon-button"
          onClick={() => setMenu(false)}
          aria-label="Zamknij nawigację"
        >
          <X />
        </button>
        <div className="sidebar-section-label">ODKRYWAJ</div>
        <nav aria-label="Nawigacja główna">
          {nav.map(([key, Icon]) => (
            <a
              key={key}
              href={routeHref(key)}
              className={`nav-link ${route.view === key ? "active" : ""}`}
              aria-current={route.view === key ? "page" : undefined}
            >
              <Icon size={19} />
              <span>{eliTitles[key] || collections[key]?.title}</span>
              {route.view === key && <span className="nav-indicator" />}
            </a>
          ))}
        </nav>
        <div className="sidebar-section-label tools-label">TWÓJ WARSZTAT</div>
        <nav aria-label="Narzędzia">
          <a
            href={isEli ? "#/eli-api" : "#/api"}
            className={`nav-link ${route.view === "api" || route.view === "eli-api" ? "active" : ""}`}
          >
            <Code2 size={19} />
            <span>Eksplorator API</span>
            <span className="nav-count">
              {spec ? Object.keys(spec.paths).length : "…"}
            </span>
          </a>
          <a
            href={isEli ? "#/eli-saved" : "#/saved"}
            className={`nav-link ${route.view === "saved" || route.view === "eli-saved" ? "active" : ""}`}
          >
            <Bookmark size={19} />
            <span>Zapisane</span>
            {(isEli ? savedActs.length : saved.length) > 0 && (
              <span className="nav-count">
                {isEli ? savedActs.length : saved.length}
              </span>
            )}
          </a>
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <span className="note-icon">
              <Layers3 size={20} />
            </span>
            <strong>
              Dane są po to,
              <br />
              żeby z nich korzystać.
            </strong>
            <p>
              Zajrzyj pod powierzchnię.
              <br />
              Odkryj całe publiczne API.
            </p>
            <a href={isEli ? "#/eli-api" : "#/api"}>
              Zacznij odkrywać <ArrowRight size={14} />
            </a>
          </div>
          <a
            className="sidebar-docs"
            href={isEli ? ELI_DOCS : DOCS_URL}
            target="_blank"
            rel="noreferrer"
          >
            <BookOpen size={16} /> Dokumentacja źródłowa{" "}
            <ExternalLink size={13} />
          </a>
          <div className="sidebar-version">
            <span>GovAPI Explorer</span>
            <span>v1.1</span>
          </div>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <nav className="api-switcher" aria-label="Wybierz API">
            <a
              href="#/datasets"
              className={!isEli ? "active" : ""}
              aria-current={!isEli ? "true" : undefined}
            >
              <Database size={16} />
              <span>Dane.gov.pl</span>
            </a>
            <a
              href="#/eli-acts"
              className={isEli ? "active" : ""}
              aria-current={isEli ? "true" : undefined}
            >
              <Scale size={16} />
              <span>ELI · Akty prawne</span>
            </a>
          </nav>
          <div className="topbar-context">
            <div className="breadcrumbs">
              <button
                className="mobile-toggle icon-button"
                aria-label="Otwórz menu"
                onClick={() => setMenu(true)}
              >
                <Menu size={21} />
              </button>
              <span>{isEli ? "Przestrzeń prawa" : "Przestrzeń danych"}</span>
              <ChevronRight size={14} />
              <strong>{title}</strong>
            </div>
            <div className="topbar-right">
              <span
                className={`live-status ${apiStatus === "API dostępne" ? "online" : ""}`}
              >
                <i />
                {apiStatus}
              </span>
              <span className="version-badge">
                {isEli ? "ELI API" : "API v1.4"}
              </span>
              <a
                className="icon-button"
                href="https://github.com/kopecp/GovAPI"
                target="_blank"
                rel="noreferrer"
                aria-label="Repozytorium GitHub"
              >
                <GitFork size={19} />
              </a>
            </div>
          </div>
        </header>
        <main
          id="main-content"
          tabIndex={-1}
          key={
            route.view === "api"
              ? `api-${route.params.get("endpoint") || "/datasets"}`
              : route.view === "item"
                ? `item-${route.params.get("url")}`
                : `${route.view}-${route.params}`
          }
        >
          {isEli ? (
            <>
              {publisherError &&
                ["eli-acts", "eli-journals"].includes(route.view) && (
                  <ErrorState
                    error={publisherError}
                    retry={() => setConnectionRevision((v) => v + 1)}
                  />
                )}
              <EliView
                view={route.view}
                params={route.params}
                publishers={publishers}
                saved={savedActs}
                toggleSave={toggleActSave}
                spec={spec}
                specError={specError}
              />
            </>
          ) : route.view === "api" ? (
            spec ? (
              <Explorer
                spec={spec}
                params={route.params}
                saved={saved}
                toggleSave={toggleSave}
              />
            ) : specError ? (
              <ErrorState error={specError} retry={() => location.reload()} />
            ) : (
              <Loading />
            )
          ) : route.view === "item" ? (
            <ItemDetail
              url={route.params.get("url") || ""}
              saved={saved}
              toggleSave={toggleSave}
            />
          ) : route.view === "saved" ? (
            <>
              <section className="page-heading">
                <div>
                  <div className="eyebrow">TWOJA KOLEKCJA</div>
                  <h1>
                    Zapisane<span className="title-dot">.</span>
                  </h1>
                  <p>
                    Wróć do interesujących danych. Twoje zakładki są zapisane w
                    tej przeglądarce.
                  </p>
                </div>
                {saved.length > 0 && (
                  <button
                    className="button"
                    onClick={() => downloadJson(saved, "govapi-zapisane.json")}
                  >
                    <ArrowDownToLine size={16} /> Eksportuj zakładki
                  </button>
                )}
              </section>
              {saved.length ? (
                <>
                  <p className="saved-note">
                    Poniżej informacje z chwili zapisu. Otwórz rekord, aby
                    pobrać aktualne dane.
                  </p>
                  <div className="card-grid">
                    {saved.map((item) => (
                      <DataCard
                        key={`${item.type}-${item.id}`}
                        item={item}
                        saved={saved}
                        toggleSave={toggleSave}
                      />
                    ))}
                  </div>
                </>
              ) : (
                <Empty
                  title="Twoje odkrycia będą tutaj"
                  text="Kliknij ikonę zakładki przy dowolnym zbiorze, zasobie lub dostawcy, aby zachować go na później."
                />
              )}
            </>
          ) : (
            <Catalog
              view={
                collections[route.view] || route.view === "browse"
                  ? route.view
                  : "datasets"
              }
              params={route.params}
              counts={counts}
              saved={saved}
              toggleSave={toggleSave}
            />
          )}
        </main>
        <footer className="footer">
          <span>Niezależna przeglądarka danych publicznych</span>
          <span>
            Źródło:{" "}
            <a
              href={isEli ? "https://eli.gov.pl/" : "https://dane.gov.pl"}
              target="_blank"
              rel="noreferrer"
            >
              {isEli ? "eli.gov.pl · API Sejmu" : "dane.gov.pl"}{" "}
              <ExternalLink size={12} />
            </a>
            <i /> Otwarte dane, otwarte możliwości.
          </span>
        </footer>
      </div>
      {notice && (
        <div className="toast" role="status">
          <Check size={17} />
          {notice}
        </div>
      )}
    </div>
  );
}
