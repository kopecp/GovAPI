import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ApiError, pathParameters } from "../src/api.ts";
import {
  actHref,
  actPath,
  actsOf,
  buildEliEndpoint,
  eliRequest,
  eliUrl,
  isFileEndpoint,
  pageOptions,
  parseActId,
  readSavedActs,
  searchUrl,
  textFileUrl,
} from "../src/eli-api.ts";
import type { Act } from "../src/eli-api.ts";

test("ELI requests cannot leave the official API namespace", () => {
  assert.equal(eliUrl("/acts"), "https://api.sejm.gov.pl/eli/acts");
  assert.equal(eliUrl("/"), "https://api.sejm.gov.pl/eli/");
  for (const input of [
    "https://example.com/eli/acts",
    "https://api.sejm.gov.pl/sejm",
    "../sejm",
    "http://api.sejm.gov.pl/eli/acts",
    "https://user:pass@api.sejm.gov.pl/eli/acts",
    "javascript:alert(1)",
  ])
    assert.throws(() => eliUrl(input));
});
test("historical MP identities retain zeros across detail routes and requests", () => {
  const ids = ["MP/1946/0270045", "MP/1946/0280045"];
  for (const id of ids) {
    assert.equal(parseActId(`https://eli.gov.pl/eli/${id}/ogl/pol/pdf`), id);
    assert.equal(actPath(id), `/acts/${id}`);
    assert.equal(new URLSearchParams(actHref(id).split("?")[1]).get("id"), id);
  }
  assert.notEqual(actPath(ids[0]), actPath(ids[1]));
  assert.equal(parseActId("WDU19940890414"), "WDU19940890414");
});
test("direct lookup rejects malformed and foreign identifiers", () => {
  for (const id of [
    "DU/2020/../1",
    "DU/2020/1?foo=bar",
    "https://example.com/eli/DU/2020/1",
    "javascript:alert(1)",
    "",
    "DU/2020/-1",
  ])
    assert.equal(parseActId(id), undefined);
  assert.throws(() => actPath("bad-id"));
});
test("ELI search keeps Polish filters, dates and zero-volume while dropping UI-only state", () => {
  const url = new URL(
    searchUrl(
      new URLSearchParams({
        title: "środowisko & woda",
        keyword: "ochrona środowiska,opłaty",
        volume: "0",
        year: "2020",
        inForce: "1",
        dateFrom: "2020-01-01",
        limit: "24",
        offset: "48",
        mode: "json",
      }),
    ),
  );
  assert.equal(url.searchParams.get("title"), "środowisko & woda");
  assert.equal(url.searchParams.get("keyword"), "ochrona środowiska,opłaty");
  assert.equal(url.searchParams.get("volume"), "0");
  assert.equal(url.searchParams.get("inForce"), "1");
  assert.equal(url.searchParams.get("dateFrom"), "2020-01-01");
  assert.equal(url.searchParams.get("offset"), "48");
  assert.equal(url.searchParams.get("limit"), "24");
  assert.equal(url.searchParams.has("mode"), false);
});
test("invalid pagination cannot create an unbounded or negative catalog query", () => {
  for (const offset of ["-1", "NaN", "1.5", "Infinity", "9007199254740992"])
    assert.deepEqual(
      pageOptions(new URLSearchParams({ offset, limit: "1000000" })),
      { offset: 0, limit: 12 },
    );
});
test("changes pagination preserves the timestamp without search-only filters", () => {
  const url = new URL(
    searchUrl(
      new URLSearchParams({
        since: "2026-10-20T12:30:00",
        title: "ignored",
        offset: "24",
      }),
      true,
    ),
  );
  assert.equal(url.pathname, "/eli/changes/acts");
  assert.equal(url.searchParams.get("since"), "2026-10-20T12:30:00");
  assert.equal(url.searchParams.get("offset"), "24");
  assert.equal(url.searchParams.has("title"), false);
});
test("all 29 official ELI endpoints can be constructed from their documented path parameters", () => {
  const spec = JSON.parse(
    readFileSync(
      new URL("../public/eli-openapi.json", import.meta.url),
      "utf8",
    ),
  );
  const entries = Object.entries<any>(spec.paths).filter(
    ([, item]) => item.get,
  );
  assert.equal(entries.length, 29);
  for (const [path, entry] of entries) {
    const fields = pathParameters(path, entry.get);
    const values = Object.fromEntries(
      fields.map((p: any) => [p.name, String(p.example || "1")]),
    );
    const url = new URL(buildEliEndpoint(path, values));
    assert.equal(url.origin, "https://api.sejm.gov.pl");
    assert.ok(url.pathname.startsWith("/eli/"));
    assert.ok(!url.href.includes("%7B"));
  }
});
test("text fragment paths preserve structure and cannot escape the endpoint", () => {
  const path = "/acts/{publisher}/{year}/{position}/text.html/{tree}";
  const values = {
    publisher: "DU",
    year: "2020",
    position: "2",
    tree: "paragraf=2/ustep=1/punkt=3",
  };
  assert.equal(
    buildEliEndpoint(path, values),
    "https://api.sejm.gov.pl/eli/acts/DU/2020/2/text.html/paragraf%3D2/ustep%3D1/punkt%3D3",
  );
  assert.throws(() =>
    buildEliEndpoint(path, { ...values, tree: "../../acts" }),
  );
  assert.throws(() => buildEliEndpoint(path, { ...values, year: ".." }));
  assert.throws(() => buildEliEndpoint(path, { ...values, position: "" }));
});
test("PDF and named files are opened as files; HTML and metadata remain readable", () => {
  assert.equal(
    isFileEndpoint("/acts/{publisher}/{year}/{position}/text.pdf", {}),
    true,
  );
  assert.equal(
    isFileEndpoint(
      "/acts/{publisher}/{year}/{position}/text/{type}/{fileName}",
      {},
    ),
    true,
  );
  assert.equal(
    isFileEndpoint("/acts/{publisher}/{year}/{position}/text.html", {}),
    false,
  );
  assert.equal(isFileEndpoint("/acts", {}), false);
  const act = { ELI: "DU/1994/414", title: "Prawo budowlane" } as Act;
  assert.equal(
    textFileUrl(act, { type: "U", fileName: "D19940414Lj.pdf" }),
    "https://api.sejm.gov.pl/eli/acts/DU/1994/414/text/U/D19940414Lj.pdf",
  );
});
test("ELI bookmarks do not accept DANE.GOV.PL records or corrupted storage", () => {
  const act = { ELI: "DU/1994/414", title: "Prawo budowlane" };
  const dane = { id: "414", type: "dataset", attributes: { title: "Data" } };
  assert.deepEqual(readSavedActs(JSON.stringify([act, dane, null])), [act]);
  assert.deepEqual(readSavedActs("broken"), []);
  assert.deepEqual(actsOf({ items: [act, dane] }), [act]);
  assert.deepEqual(actsOf(act), [act]);
});
test("ELI request handles JSON, HTML, HTTP errors and cancellation", async (t) => {
  const replies = [
    new Response('{"items":[]}', { status: 200 }),
    new Response("<p>Tekst</p>", { status: 200 }),
    new Response('{"error":"missing"}', { status: 404 }),
  ];
  const fetchMock = t.mock.method(
    globalThis,
    "fetch",
    async (_url: unknown, options: RequestInit) => {
      options.signal?.throwIfAborted();
      assert.equal(options.credentials, "omit");
      return replies.shift()!;
    },
  );
  assert.deepEqual((await eliRequest("/acts")).body, { items: [] });
  assert.equal(
    (await eliRequest("/acts/DU/2020/2/text.html")).body,
    "<p>Tekst</p>",
  );
  await assert.rejects(
    eliRequest("/acts/DU/2020/0"),
    (e: unknown) => e instanceof ApiError && e.status === 404,
  );
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(eliRequest("/acts", controller.signal), {
    name: "AbortError",
  });
  assert.equal(fetchMock.mock.callCount(), 4);
});
