// Explicit, read-only live smoke check. Not part of unit tests or CI.
const base = "https://api.sejm.gov.pl/eli";
const checks = [
  ["/acts", (b) => Array.isArray(b) && b.some((p) => p.code === "DU")],
  ["/types", Array.isArray],
  [
    "/acts/search?title=prawo%20budowlane&publisher=DU&limit=2&offset=2&sortBy=publisher&sortDir=desc",
    (b) => b.offset === 2 && b.items.length === 2,
  ],
  ["/acts/DU/1994/414", (b) => b.ELI === "DU/1994/414"],
  ["/acts/MP/1946/0270045", (b) => b.ELI === "MP/1946/0270045"],
  ["/acts/DU/1994/volumes", Array.isArray],
  ["/acts/DU/2020/2/references", (b) => b && typeof b === "object"],
  ["/acts/DU/2020/2/struct", Array.isArray],
  [
    "/acts/DU/2020/2/text.html/paragraf%3D2/ustep%3D1/punkt%3D3",
    (b) => typeof b === "string" && b.includes("kwalifikacje"),
  ],
];
for (const [path, validate] of checks) {
  try {
    const res = await fetch(base + path, {
      headers: {
        Origin: "https://kopecp.github.io",
        Accept: path.includes("text.html") ? "text/html" : "application/json",
      },
      signal: AbortSignal.timeout(25000),
    });
    const body = path.includes("text.html")
      ? await res.text()
      : await res.json();
    const cors = res.headers.get("access-control-allow-origin");
    const ok =
      res.ok &&
      validate(body) &&
      ["*", "https://kopecp.github.io"].includes(cors);
    console.log(JSON.stringify({ path, status: res.status, cors, ok }));
    if (!ok) process.exitCode = 1;
  } catch (error) {
    console.error(JSON.stringify({ path, error: error.message }));
    process.exitCode = 1;
  }
}
