import { writeFile } from "node:fs/promises";

const source = "https://api.dane.gov.pl/spec/1.4";
const response = await fetch(source, { signal: AbortSignal.timeout(30000) });
if (!response.ok) throw new Error(`Spec download failed: ${response.status}`);
const spec = await response.json();
if (!spec.openapi || !spec.paths || !spec.paths["/datasets"])
  throw new Error("Unexpected OpenAPI document");
await writeFile(
  new URL("../public/openapi.json", import.meta.url),
  JSON.stringify(spec, null, 2) + "\n",
);
console.log(
  `Saved ${Object.keys(spec.paths).length} paths from ${source}. Review the diff before publishing.`,
);
