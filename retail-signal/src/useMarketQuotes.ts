import { useState, useCallback, useEffect } from "react";
import { marketSnapshots } from "./market";
import type { MarketQuote } from "./market";
export function useMarketQuotes() {
  const [quotes, setQuotes] = useState<MarketQuote[]>(marketSnapshots);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/market", {
        signal: AbortSignal.timeout(15000),
        cache: "no-store",
      });
      if (
        !response.ok ||
        !response.headers.get("content-type")?.includes("application/json")
      )
        throw new Error("Market service unavailable on this host.");
      const data = await response.json();
      if (!Array.isArray(data.quotes))
        throw new Error("Market service returned an invalid response.");
      setQuotes((current) =>
        current.map((old) => {
          const q = data.quotes.find(
            (q: Partial<MarketQuote>) => q.series === old.series,
          );
          if (
            q &&
            typeof q.value === "number" &&
            Number.isFinite(q.value) &&
            q.value > 0 &&
            typeof q.period === "string" &&
            typeof q.retrievedAt === "string" &&
            !Number.isNaN(Date.parse(q.retrievedAt)) &&
            q.status === "retrieved"
          )
            return {
              ...old,
              value: q.value,
              period: q.period,
              retrievedAt: q.retrievedAt,
              status: "retrieved",
              error: undefined,
            };
          return { ...old, error: q?.error || "No new observation received." };
        }),
      );
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Unable to retrieve public market data.",
      );
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  return { quotes, loading, error, refresh };
}
