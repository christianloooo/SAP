import { opportunities, demandFor } from "./data";
import type { DemoState } from "./data";
export interface ResourceContract {
  counterparty: string;
  nodeId: string;
  rate: number;
  monthlyQuantity: number;
  status: "Current" | "Approved alternative";
}
export interface SupplyResource {
  id: string;
  name: string;
  description: string;
  unit: string;
  categories: string[];
  benchmark?: string;
  benchmarkNote: string;
  contracts: ResourceContract[];
}
const contract = (
  counterparty: string,
  rate: number,
  monthlyQuantity: number,
  status: ResourceContract["status"] = "Current",
): ResourceContract => ({
  counterparty,
  nodeId: `supplier:${counterparty}`,
  rate,
  monthlyQuantity,
  status,
});
export const resources: SupplyResource[] = [
  {
    id: "cotton",
    name: "Cotton fabric",
    unit: "yard",
    categories: ["Tops", "Denim"],
    description:
      "Finished cotton fabric for ribbed tops, woven shirts and denim. Fabric construction and finishing vary by supplier; rates are illustrative landed material costs, not real invoices.",
    benchmark: "PCOTTINDUSDM",
    benchmarkNote:
      "Raw cotton index in US cents/lb. A directional input benchmark, not a finished-fabric quote or a CAD/yard conversion.",
    contracts: [
      contract("Pacific Apparel Co.", 5.4, 4200),
      contract("Denim Works", 6.2, 1600),
      contract(
        "Coastal Textiles · Alternative",
        6.1,
        0,
        "Approved alternative",
      ),
    ],
  },
  {
    id: "stretch",
    name: "Elastane & trims",
    unit: "kg",
    categories: ["Tops", "Denim", "Bottoms"],
    description:
      "Stretch fiber, sewing and finishing trims allocated to apparel production. Seeded procurement assumptions; specification changes require supplier validation.",
    benchmarkNote:
      "No comparable public elastane-and-trims price feed is configured. Request a like-for-like vendor quote; no cotton-price substitution is made.",
    contracts: [
      contract("Pacific Apparel Co.", 12, 180),
      contract("Denim Works", 14, 100),
      contract("Atelier Textile", 13, 90),
      contract(
        "Coastal Textiles · Alternative",
        12.8,
        0,
        "Approved alternative",
      ),
    ],
  },
  {
    id: "linen",
    name: "Linen fabric",
    unit: "yard",
    categories: ["Bottoms"],
    description:
      "Woven linen fabric used by Atelier Textile for sand-colored trousers. Cost per finished yard includes the demo finishing assumption.",
    benchmarkNote:
      "No comparable public finished-linen price feed is configured. Purchase rate below is an editable demo assumption, not a market quote.",
    contracts: [contract("Atelier Textile", 8.6, 2400)],
  },
  {
    id: "wool",
    name: "Merino wool yarn",
    unit: "kg",
    categories: ["Knitwear"],
    description:
      "Spun wool yarn for Northern Knit's crewnecks. Merino grade, micron count and processing are not represented by a coarse-wool benchmark.",
    benchmark: "PWOOLCUSDM",
    benchmarkNote:
      "Coarse raw-wool index in US cents/kg; a broad wool-market proxy, not a Merino-yarn quote.",
    contracts: [contract("Northern Knit", 22, 650)],
  },
  {
    id: "diesel",
    name: "Diesel / transport fuel",
    unit: "litre",
    categories: ["Tops", "Denim", "Bottoms", "Knitwear"],
    description:
      "Road-transport fuel allocated to inbound distribution. Fuel constraints affect all modeled SKU lanes. Facility rates are illustrative delivered fuel charges, not freight-company invoices.",
    benchmark: "GASDESW",
    benchmarkNote:
      "US national on-highway pump diesel, USD/US gallon including taxes. Canadian contracts, geography and taxes differ; no automatic currency conversion is assumed.",
    contracts: [
      {
        counterparty: "Western Distribution Center",
        nodeId: "location:Western Distribution Center",
        rate: 1.85,
        monthlyQuantity: 4800,
        status: "Current",
      },
      {
        counterparty: "Ontario Distribution Center",
        nodeId: "location:Ontario Distribution Center",
        rate: 1.91,
        monthlyQuantity: 4100,
        status: "Current",
      },
      {
        counterparty: "Quebec Distribution Center",
        nodeId: "location:Quebec Distribution Center",
        rate: 1.88,
        monthlyQuantity: 3200,
        status: "Current",
      },
    ],
  },
  {
    id: "gas",
    name: "Natural gas / production energy",
    unit: "MMBtu",
    categories: ["Tops", "Denim", "Bottoms", "Knitwear"],
    description:
      "Process heat for dyeing, drying and finishing. Energy availability is modeled as a constraint on new production, without reducing existing finished stock.",
    benchmark: "PNGASUSUSDM",
    benchmarkNote:
      "US Henry Hub natural-gas benchmark, USD/MMBtu. Delivered Canadian production-energy contracts include different transport, currency and other charges.",
    contracts: [
      contract("Pacific Apparel Co.", 5.8, 2600),
      contract("Denim Works", 6.1, 1800),
      contract("Atelier Textile", 5.9, 1200),
      contract("Northern Knit", 6, 950),
      contract(
        "Coastal Textiles · Alternative",
        6.2,
        0,
        "Approved alternative",
      ),
    ],
  },
];
export type PurchaseRates = Record<string, number>;
export const rateKey = (r: SupplyResource, c: ResourceContract) =>
  `${r.id}:${c.counterparty}`;
export const purchaseRate = (
  r: SupplyResource,
  c: ResourceContract,
  rates: PurchaseRates,
) => rates[rateKey(r, c)] ?? c.rate;
export const resourceSkus = (r: SupplyResource) =>
  opportunities
    .filter((o) => r.categories.includes(o.category))
    .map((o) => o.sku);
export function readPurchaseRates(): PurchaseRates {
  try {
    const data = JSON.parse(
      localStorage.getItem("retail-procurement-rates-v1") || "{}",
    );
    if (!data || typeof data !== "object" || Array.isArray(data)) return {};
    return Object.fromEntries(
      Object.entries(data)
        .filter(
          ([key, value]) =>
            resources.some((r) =>
              r.contracts.some((c) => rateKey(r, c) === key),
            ) &&
            typeof value === "number" &&
            Number.isFinite(value) &&
            value > 0 &&
            value <= 100000,
        )
        .map(([key, value]) => [key, Number(value)]),
    );
  } catch {
    return {};
  }
}
export interface ShortageConfig {
  resource: string;
  shortagePercent: number;
  priceIncreasePercent: number;
  delayDays: number;
  horizon: number;
  passThroughPercent: number;
}
export const defaultShortage: ShortageConfig = {
  resource: "diesel",
  shortagePercent: 25,
  priceIncreasePercent: 30,
  delayDays: 7,
  horizon: 30,
  passThroughPercent: 100,
};
const baseFinishedCost: Record<string, number> = {
  "Pacific Apparel Co.": 12,
  "Denim Works": 28,
  "Atelier Textile": 24,
  "Northern Knit": 38,
};
/** Illustrative physical input requirements per finished garment. */
export function inputPerGarment(resource: string, sku: string) {
  const o = opportunities.find((o) => o.sku === sku)!;
  if (resource === "diesel") return 0.8;
  if (resource === "gas") return 0.12;
  if (resource === "wool") return 0.4;
  if (resource === "stretch") return 0.05;
  if (resource === "linen") return 1.8;
  return o.category === "Denim" ? 1.6 : 1.15;
}
export function simulateResourceShortage(
  state: DemoState,
  config: ShortageConfig,
  rates: PurchaseRates = {},
) {
  const resource = resources.find((r) => r.id === config.resource);
  if (
    !resource ||
    ![
      config.shortagePercent,
      config.priceIncreasePercent,
      config.delayDays,
      config.horizon,
      config.passThroughPercent,
    ].every(Number.isFinite) ||
    config.shortagePercent < 0 ||
    config.shortagePercent > 100 ||
    config.priceIncreasePercent < 0 ||
    config.priceIncreasePercent > 300 ||
    !Number.isInteger(config.delayDays) ||
    config.delayDays < 0 ||
    config.delayDays > 30 ||
    ![30, 45, 60].includes(config.horizon) ||
    config.passThroughPercent < 0 ||
    config.passThroughPercent > 100
  )
    throw new Error("Invalid shortage assumptions.");
  const rows = opportunities
    .filter((o) => resource.categories.includes(o.category))
    .map((o) => {
      const wh = state.inventory.find((i) => i.id === `${o.id}-wh`)!;
      const contract = resource.contracts.find(
        (c) =>
          c.counterparty ===
          (resource.id === "diesel" ? wh.location : o.supplier),
      )!;
      const rate = purchaseRate(resource, contract, rates);
      if (!Number.isFinite(rate) || rate <= 0)
        throw new Error("Purchase rate must be positive.");
      const input = inputPerGarment(resource.id, o.sku);
      const units = Math.ceil((demandFor(o, state) * config.horizon) / 7);
      const completed = Math.floor(units * (1 - config.shortagePercent / 100));
      const deferred = units - completed;
      // Current input is already included in the finished-goods cost. Only its incremental uplift is added.
      const addedPerUnit =
        (((input * rate * config.priceIncreasePercent) / 100) *
          config.passThroughPercent) /
        100;
      const baselineAdjustment = resources
        .filter((r) => r.categories.includes(o.category))
        .reduce((sum, r) => {
          const c = r.contracts.find(
            (c) =>
              c.counterparty === (r.id === "diesel" ? wh.location : o.supplier),
          );
          return (
            sum +
            (c
              ? inputPerGarment(r.id, o.sku) *
                (purchaseRate(r, c, rates) - c.rate)
              : 0)
          );
        }, 0);
      const baseCost = baseFinishedCost[o.supplier] + 1.5 + baselineAdjustment;
      const baseProfitPerUnit = o.price - baseCost;
      const scenarioCost = baseCost + addedPerUnit;
      return {
        o,
        rate,
        input,
        units,
        completed,
        deferred,
        addedPerUnit,
        baseCost,
        scenarioCost,
        baseMargin: (baseProfitPerUnit / o.price) * 100,
        scenarioMargin: ((o.price - scenarioCost) / o.price) * 100,
        baseRevenue: units * o.price,
        scenarioRevenue: completed * o.price,
        baseProfit: units * baseProfitPerUnit,
        scenarioProfit: completed * (o.price - scenarioCost),
        addedCost: completed * addedPerUnit,
        deferredProfit: deferred * baseProfitPerUnit,
      };
    });
  const sum = (
    key:
      | "baseRevenue"
      | "scenarioRevenue"
      | "baseProfit"
      | "scenarioProfit"
      | "addedCost"
      | "deferredProfit"
      | "deferred"
      | "units",
  ) => rows.reduce((s, r) => s + r[key], 0);
  // Compare the same completed SKU mix so deferred-unit rounding does not masquerade as cost-driven margin erosion.
  const baseMargin =
    sum("scenarioRevenue") > 0
      ? (rows.reduce((n, r) => n + r.completed * (r.o.price - r.baseCost), 0) /
          sum("scenarioRevenue")) *
        100
      : (sum("baseProfit") / sum("baseRevenue")) * 100;
  const scenarioMargin =
    sum("scenarioRevenue") > 0
      ? (sum("scenarioProfit") / sum("scenarioRevenue")) * 100
      : null;
  return {
    resource,
    config,
    rows,
    addedCost: sum("addedCost"),
    deferredProfit: sum("deferredProfit"),
    profitReduction: sum("baseProfit") - sum("scenarioProfit"),
    deferred: sum("deferred"),
    units: sum("units"),
    baseMargin,
    scenarioMargin,
    marginDrop: scenarioMargin === null ? null : baseMargin - scenarioMargin,
  };
}
