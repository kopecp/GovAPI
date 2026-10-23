import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  apiUrl,
  buildEndpointUrl,
  explorerRoute,
  itemsOf,
  itemUrl,
  pathParameters,
  routeHref,
  safeHref,
  withQuery,
} from "../src/api.ts";

test("requests remain on the official versioned API", () => {
  assert.equal(apiUrl("/datasets"), "https://api.dane.gov.pl/1.4/datasets");
  assert.throws(() => apiUrl("https://example.com/1.4/datasets"));
  assert.throws(() => apiUrl("../datasets"));
  assert.throws(() => apiUrl("https://api.dane.gov.pl/other"));
});
test("query encoding preserves Polish text and nested filter operators", () => {
  const url = new URL(
    withQuery("/datasets", {
      q: "jakość powietrza & woda",
      "format[terms]": "csv,xlsx",
    }),
  );
  assert.equal(url.searchParams.get("q"), "jakość powietrza & woda");
  assert.equal(url.searchParams.get("format[terms]"), "csv,xlsx");
});
test("path parameters are required and encoded independently", () => {
  assert.throws(
    () => buildEndpointUrl("/resources/{id}/data/{row_id}", { id: "2" }, ""),
    /row_id/,
  );
  assert.equal(
    buildEndpointUrl(
      "/resources/{id}/data/{row_id}",
      { id: "2", row_id: "a/b" },
      "q=a%26b",
    ),
    "https://api.dane.gov.pl/1.4/resources/2/data/a%2Fb?q=a%26b",
  );
});
test("all documented endpoints get inputs for every path placeholder, including omissions in the source spec", () => {
  const spec = JSON.parse(
    readFileSync(new URL("../public/openapi.json", import.meta.url), "utf8"),
  );
  assert.equal(Object.keys(spec.paths).length, 20);
  for (const [path, entry] of Object.entries<any>(spec.paths)) {
    const parameters = pathParameters(path, entry.get);
    assert.equal(parameters.length, [...path.matchAll(/\{([^}]+)\}/g)].length);
    const values = Object.fromEntries(
      parameters.map((p) => [p.name, p.name === "extension" ? "csv" : "1"]),
    );
    assert.ok(
      buildEndpointUrl(path, values, "").startsWith(
        "https://api.dane.gov.pl/1.4/",
      ),
    );
  }
});
test("external source links cannot execute script or data URLs", () => {
  assert.equal(safeHref("javascript:alert(1)"), undefined);
  assert.equal(safeHref("data:text/html,x"), undefined);
  assert.equal(safeHref("https://dane.gov.pl/a"), "https://dane.gov.pl/a");
});
test("record links and hash routes survive Pages subdirectory hosting", () => {
  const url = itemUrl({ id: "123", type: "dataset", attributes: {} });
  const route = routeHref("item", { url });
  assert.equal(new URLSearchParams(route.split("?")[1]).get("url"), url);
  assert.equal(
    itemUrl({ id: "123", type: "unknown", attributes: {} }),
    undefined,
  );
});
test("search records normalize common types and unversioned links without altering raw responses", () => {
  const source = {
    data: [
      {
        id: "14475",
        type: "common",
        attributes: { model: "resource" },
        links: { self: "https://api.dane.gov.pl/resources/14475,transport" },
      },
    ],
  };
  const item = itemsOf(source)[0];
  assert.equal(item.type, "resource");
  assert.equal(source.data[0].type, "common");
  assert.equal(
    itemUrl(item),
    "https://api.dane.gov.pl/1.4/resources/14475,transport",
  );
});
test("opening related collections in the explorer preserves ID and filters", () => {
  const route = explorerRoute(
    "https://api.dane.gov.pl/1.4/datasets/12,example/resources?page=2&q=transport",
  );
  const params = new URLSearchParams(route.split("?")[1]);
  assert.equal(params.get("endpoint"), "/datasets/{id}/resources");
  assert.equal(params.get("id"), "12");
  assert.equal(params.get("query"), "page=2&q=transport");
});
