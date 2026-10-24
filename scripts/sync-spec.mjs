import { writeFile } from "node:fs/promises";

const eli = process.argv.includes("--eli");
const source = eli
  ? "https://api.sejm.gov.pl/eli/openapi/"
  : "https://api.dane.gov.pl/spec/1.4";
const response = await fetch(source, {
  signal: AbortSignal.timeout(30000),
  headers: { Accept: "application/json" },
});
if (!response.ok) throw new Error(`Spec download failed: ${response.status}`);
const spec = await response.json();
if (
  !spec.openapi ||
  !spec.paths ||
  !spec.paths[eli ? "/acts/search" : "/datasets"]
)
  throw new Error("Unexpected OpenAPI document");
await writeFile(
  new URL(
    eli ? "../public/eli-openapi.json" : "../public/openapi.json",
    import.meta.url,
  ),
  JSON.stringify(spec, null, 2) + "\n",
);
console.log(
  `Saved ${Object.keys(spec.paths).length} paths from ${source}. Review the diff before publishing.`,
);
