export interface MarketQuote {
  series: string;
  label: string;
  value: number;
  unit: string;
  period: string;
  source: string;
  sourceUrl: string;
  retrievedAt: string;
  status: "retrieved" | "snapshot";
  error?: string;
}
export const marketSnapshots: MarketQuote[] = [
  {
    series: "PCOTTINDUSDM",
    label: "Raw cotton",
    value: 95.84048,
    unit: "US cents / lb",
    period: "Sep 2026",
    source: "IMF via FRED",
    sourceUrl: "https://fred.stlouisfed.org/series/PCOTTINDUSDM",
    retrievedAt: "2026-10-24",
    status: "snapshot",
  },
  {
    series: "PWOOLCUSDM",
    label: "Coarse wool",
    value: 1482.37192,
    unit: "US cents / kg",
    period: "Sep 2026",
    source: "IMF via FRED",
    sourceUrl: "https://fred.stlouisfed.org/series/PWOOLCUSDM",
    retrievedAt: "2026-10-24",
    status: "snapshot",
  },
  {
    series: "GASDESW",
    label: "US on-highway diesel",
    value: 6.276,
    unit: "USD / US gallon",
    period: "2026-10-19",
    source: "EIA via FRED",
    sourceUrl: "https://fred.stlouisfed.org/series/GASDESW",
    retrievedAt: "2026-10-24",
    status: "snapshot",
  },
  {
    series: "PNGASUSUSDM",
    label: "Henry Hub natural gas",
    value: 2.95381,
    unit: "USD / MMBtu",
    period: "Sep 2026",
    source: "IMF via FRED",
    sourceUrl: "https://fred.stlouisfed.org/series/PNGASUSUSDM",
    retrievedAt: "2026-10-24",
    status: "snapshot",
  },
];
