// Fixed public series only. No purchase rates or business records leave the application.
const series = [
  ["PCOTTINDUSDM", "Raw cotton", "US cents / lb", "IMF via FRED"],
  ["PWOOLCUSDM", "Coarse wool", "US cents / kg", "IMF via FRED"],
  ["GASDESW", "US on-highway diesel", "USD / US gallon", "EIA via FRED"],
  ["PNGASUSUSDM", "Henry Hub natural gas", "USD / MMBtu", "IMF via FRED"],
];
export function parseFredObservation(html) {
  const match = html.match(
    /(\d{4}-\d{2}-\d{2}|[A-Z][a-z]{2} \d{4}):\s*<span[^>]*class="series-meta-observation-value"[^>]*>\s*([\d,.]+)\s*<\/span>/,
  );
  if (!match || !Number.isFinite(Number(match[2].replaceAll(",", ""))))
    throw new Error(
      "Source observation format changed; last verified snapshot retained.",
    );
  return { period: match[1], value: Number(match[2].replaceAll(",", "")) };
}
let cached;
export function marketPlugin() {
  const install = (server) => {
    server.middlewares.use("/api/market", async (req, res) => {
      if (req.method !== "GET") {
        res.statusCode = 405;
        res.end();
        return;
      }
      if (!cached || Date.now() - cached.at > 300000) {
        const quotes = await Promise.all(
          series.map(async ([id, label, unit, source]) => {
            const sourceUrl = `https://fred.stlouisfed.org/series/${id}`;
            try {
              const response = await fetch(sourceUrl, {
                signal: AbortSignal.timeout(12000),
              });
              if (!response.ok)
                throw new Error(`Source returned HTTP ${response.status}`);
              return {
                series: id,
                label,
                unit,
                source,
                sourceUrl,
                ...parseFredObservation(await response.text()),
                retrievedAt: new Date().toISOString(),
                status: "retrieved",
              };
            } catch (e) {
              return {
                series: id,
                error:
                  e instanceof Error ? e.message : "Public source unavailable",
              };
            }
          }),
        );
        cached = { at: Date.now(), quotes };
      }
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Cache-Control", "no-store");
      res.end(JSON.stringify({ quotes: cached.quotes }));
    });
  };
  return {
    name: "retail-public-market-benchmarks",
    configureServer: install,
    configurePreviewServer: install,
  };
}
