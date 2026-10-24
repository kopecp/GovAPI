import { useEffect, useState } from "react";
import {
  ArrowRight,
  Bookmark,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Code2,
  LayoutGrid,
  List,
  Scale,
} from "lucide-react";
import { actHref, actsOf, eliRequest } from "./eli-api";
import type { Act, EliResult } from "./eli-api";
import { date, Empty, JsonView, number } from "./ui";

export type EliSavedProps = { saved: Act[]; toggleSave: (act: Act) => void };
export function useEli<T>(url: string | undefined, revision = 0) {
  const [state, setState] = useState<{
    loading: boolean;
    error?: Error;
    result?: EliResult<T>;
  }>({ loading: !!url });
  useEffect(() => {
    const controller = new AbortController();
    setState({ loading: !!url });
    if (url)
      eliRequest<T>(url, controller.signal)
        .then((result) => {
          if (!controller.signal.aborted) setState({ loading: false, result });
        })
        .catch((error: Error) => {
          if (!controller.signal.aborted) setState({ loading: false, error });
        });
    return () => controller.abort();
  }, [url, revision]);
  return state;
}
export function ActCard({
  act,
  saved,
  toggleSave,
}: { act: Act } & EliSavedProps) {
  const bookmarked = saved.some((a) => a.ELI === act.ELI);
  return (
    <article className="data-card eli-act-card">
      <div className="card-top">
        <span className="type-icon">
          <Scale size={20} />
        </span>
        <span className="card-kind">{act.type || "Akt prawny"}</span>
        <button
          className={`icon-button bookmark ${bookmarked ? "saved" : ""}`}
          aria-label={`${bookmarked ? "Usuń z zapisanych" : "Zapisz"}: ${act.displayAddress || act.ELI}`}
          aria-pressed={bookmarked}
          onClick={() => toggleSave(act)}
        >
          <Bookmark size={18} />
        </button>
      </div>
      <div className="eli-address">{act.displayAddress || act.ELI}</div>
      <h3>
        <a href={actHref(act.ELI)}>{act.title}</a>
      </h3>
      <div className="tags">
        {act.status && (
          <span
            className={`eli-status ${act.inForce === "IN_FORCE" ? "in-force" : ""}`}
          >
            {act.status}
          </span>
        )}
        {act.textPDF && <span>PDF</span>}
        {act.textHTML && <span>HTML</span>}
      </div>
      <div className="card-bottom">
        <span>
          <CalendarDays size={13} />{" "}
          {date(act.promulgation || act.announcementDate)}
        </span>
        <a
          className="card-arrow"
          href={actHref(act.ELI)}
          aria-label={`Szczegóły: ${act.displayAddress || act.ELI}`}
        >
          <ArrowRight size={16} />
        </a>
      </div>
    </article>
  );
}
export function ActResults({
  body,
  mode,
  saved,
  toggleSave,
}: { body: unknown; mode: string } & EliSavedProps) {
  if (mode === "json") return <JsonView data={body} />;
  const acts = actsOf(body);
  if (!acts.length) return <Empty />;
  return (
    <div className={`card-grid ${mode === "list" ? "eli-list" : ""}`}>
      {acts.map((act) => (
        <ActCard
          key={act.ELI}
          act={act}
          saved={saved}
          toggleSave={toggleSave}
        />
      ))}
    </div>
  );
}
export function EliModes({
  mode,
  onChange,
}: {
  mode: string;
  onChange: (mode: string) => void;
}) {
  return (
    <div className="view-switch" aria-label="Widok wyników">
      {(
        [
          ["cards", LayoutGrid, "Karty"],
          ["list", List, "Lista"],
          ["json", Code2, "JSON"],
        ] as const
      ).map(([value, Icon, label]) => (
        <button
          key={value}
          type="button"
          className={mode === value ? "selected" : ""}
          onClick={() => onChange(value)}
          aria-label={label}
          aria-pressed={mode === value}
        >
          <Icon size={16} />
        </button>
      ))}
    </div>
  );
}
export function EliPagination({
  offset,
  count,
  total,
  limit,
  onPage,
}: {
  offset: number;
  count: number;
  total: number;
  limit: number;
  onPage: (offset: number) => void;
}) {
  return (
    <div className="pagination">
      <span>
        {count ? `${number(offset + 1)}–${number(offset + count)}` : "0"} z{" "}
        {number(total)}
      </span>
      <div>
        <button
          className="button small"
          disabled={offset <= 0}
          onClick={() => onPage(Math.max(0, offset - limit))}
        >
          <ChevronLeft size={14} /> Poprzednia
        </button>
        <button
          className="button small"
          disabled={!count || offset + count >= total}
          onClick={() => onPage(offset + count)}
        >
          Następna <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}
