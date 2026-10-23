// Explicit live smoke check; never run as part of ordinary unit tests or CI.
const base = "https://api.dane.gov.pl/1.4";
const paths = [
  "/datasets?per_page=1&include=institution",
  "/datasets?per_page=1&q=transport&format=csv&has_high_value_data=true",
  "/resources?per_page=1&sort=-modified",
  "/institutions?per_page=1&sort=-modified",
  "/showcases?per_page=1&page=1",
  "/histories?per_page=1&sort=-change_timestamp",
  "/search?per_page=1&q=transport",
  "/dga-aggregated",
  "/reports/brokenlinks",
  "/reports/brokenlinks/data?per_page=1",
];
const pending = [...paths];
const results = [];
async function worker() {
  while (pending.length) {
    const path = pending.shift();
    try {
      const res = await fetch(base + path, {
        signal: AbortSignal.timeout(25000),
      });
      const data = await res.json();
      const row = Array.isArray(data.data) ? data.data[0] : data.data;
      const result = {
        path,
        status: res.status,
        count: data.meta?.count,
        id: row?.id,
        type: row?.type,
        errors: data.errors,
      };
      results.push(result);
      console.log(JSON.stringify(result));
    } catch (e) {
      console.log(JSON.stringify({ path, error: e.message }));
      results.push({ path, error: e.message });
    }
  }
}
await Promise.all([worker(), worker()]);
if (results.some((r) => r.error || r.status >= 400)) process.exitCode = 1;
