import { opportunities, money, demandFor } from "./data";
import type { DemoState, Inventory } from "./data";
export interface RetailLocation {
  name: string;
  lat: number;
  lng: number;
  plant: string;
  storage: string;
  region: "West" | "Ontario" | "Quebec";
  kind: "Store" | "Warehouse" | "Online fulfillment";
}
export const locations: RetailLocation[] = [
  {
    name: "Vancouver Downtown",
    lat: 49.2827,
    lng: -123.1207,
    plant: "CA01",
    storage: "0001",
    region: "West",
    kind: "Store",
  },
  {
    name: "Burnaby Metrotown",
    lat: 49.2265,
    lng: -123.0016,
    plant: "CA02",
    storage: "0001",
    region: "West",
    kind: "Store",
  },
  {
    name: "Western Distribution Center",
    lat: 49.186,
    lng: -122.953,
    plant: "CA03",
    storage: "0001",
    region: "West",
    kind: "Warehouse",
  },
  {
    name: "Online West Fulfillment",
    lat: 49.171,
    lng: -123.063,
    plant: "CA04",
    storage: "WEB1",
    region: "West",
    kind: "Online fulfillment",
  },
  {
    name: "Toronto Queen Street",
    lat: 43.649,
    lng: -79.395,
    plant: "CA11",
    storage: "0001",
    region: "Ontario",
    kind: "Store",
  },
  {
    name: "Mississauga Square One",
    lat: 43.593,
    lng: -79.644,
    plant: "CA12",
    storage: "0001",
    region: "Ontario",
    kind: "Store",
  },
  {
    name: "Ontario Distribution Center",
    lat: 43.626,
    lng: -79.69,
    plant: "CA13",
    storage: "0001",
    region: "Ontario",
    kind: "Warehouse",
  },
  {
    name: "Montreal Centre",
    lat: 45.5017,
    lng: -73.5673,
    plant: "CA21",
    storage: "0001",
    region: "Quebec",
    kind: "Store",
  },
  {
    name: "Laval Carrefour",
    lat: 45.569,
    lng: -73.751,
    plant: "CA22",
    storage: "0001",
    region: "Quebec",
    kind: "Store",
  },
  {
    name: "Quebec Distribution Center",
    lat: 45.56,
    lng: -73.65,
    plant: "CA23",
    storage: "0001",
    region: "Quebec",
    kind: "Warehouse",
  },
];
export const locationFor = (name: string) =>
  locations.find((l) => l.name === name)!;
export type TransferStage =
  "Proposed" | "Approved" | "In transit" | "Received" | "Cancelled";
export interface TransferOrder {
  id: string;
  sku: string;
  product: string;
  sourceId: string;
  destinationId: string;
  quantity: number;
  stage: TransferStage;
  createdAt: string;
  events: { stage: TransferStage; timestamp: string }[];
  channel: "Store" | "Online";
}
export const committed = (s: DemoState, id: string) =>
  s.transfers
    .filter(
      (t) =>
        t.sourceId === id && (t.stage === "Proposed" || t.stage === "Approved"),
    )
    .reduce((n, t) => n + t.quantity, 0);
export const transferable = (s: DemoState, i: Inventory) =>
  Math.max(0, i.stock - i.reserve - committed(s, i.id));
export function distanceKm(a: RetailLocation, b: RetailLocation) {
  const rad = (x: number) => (x * Math.PI) / 180;
  const p = rad(b.lat - a.lat),
    q = rad(b.lng - a.lng);
  const h =
    Math.sin(p / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(q / 2) ** 2;
  return (
    Math.round(6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)) * 10) / 10
  );
}
export function candidates(s: DemoState, destinationId: string) {
  const dest = s.inventory.find((i) => i.id === destinationId);
  if (!dest) return [];
  return s.inventory
    .filter(
      (i) =>
        i.sku === dest.sku &&
        i.id !== dest.id &&
        i.reserve > 0 &&
        transferable(s, i) > 0 &&
        locationFor(i.location),
    )
    .map((i) => ({
      record: i,
      available: transferable(s, i),
      distance: distanceKm(locationFor(i.location), locationFor(dest.location)),
    }))
    .sort((a, b) => a.distance - b.distance);
}
export function proposeTransfer(
  s: DemoState,
  sourceId: string,
  destinationId: string,
  quantity: number,
): DemoState {
  const source = s.inventory.find((i) => i.id === sourceId),
    dest = s.inventory.find((i) => i.id === destinationId);
  if (
    !source ||
    !dest ||
    source.id === dest.id ||
    source.sku !== dest.sku ||
    !Number.isInteger(quantity) ||
    quantity < 1 ||
    quantity > transferable(s, source)
  )
    throw new Error(
      "Transfer exceeds available stock or has an invalid source, destination, SKU or quantity.",
    );
  const now = new Date().toISOString();
  const id = `DEMO-STO-${Date.now()}-${s.transfers.length + 1}`;
  const order: TransferOrder = {
    id,
    sku: source.sku,
    product: opportunities.find((o) => o.sku === source.sku)!.product,
    sourceId,
    destinationId,
    quantity,
    stage: "Proposed",
    createdAt: now,
    events: [{ stage: "Proposed", timestamp: now }],
    channel: dest.id === "online-west" ? "Online" : "Store",
  };
  return {
    ...s,
    transfers: [order, ...s.transfers],
    actions: [
      {
        id: `${id}-proposed`,
        opportunity: opportunities.find((o) => o.sku === source.sku)!.id,
        product: order.product,
        type: "S/4HANA transfer proposal",
        quantity,
        status: "Proposed",
        owner: "Alex Morgan",
        timestamp: now,
        detail: `${id}: ${source.location} → ${dest.location}. Demo proposal; stock reserved, no SAP transaction sent.`,
      },
      ...s.actions,
    ],
  };
}
export function advanceTransfer(
  s: DemoState,
  id: string,
  target: TransferStage,
): DemoState {
  const t = s.transfers.find((t) => t.id === id);
  if (!t) throw new Error("Transfer not found.");
  const allowed: Record<TransferStage, TransferStage[]> = {
    Proposed: ["Approved", "Cancelled"],
    Approved: ["In transit", "Cancelled"],
    "In transit": ["Received"],
    Received: [],
    Cancelled: [],
  };
  if (!allowed[t.stage].includes(target))
    throw new Error("Invalid or repeated workflow transition.");
  const src = s.inventory.find((i) => i.id === t.sourceId)!,
    dest = s.inventory.find((i) => i.id === t.destinationId)!;
  if (target === "In transit" && src.stock - src.reserve < t.quantity)
    throw new Error("Source reserve would be breached.");
  const now = new Date().toISOString();
  const inventory = s.inventory.map((i) =>
    i.id === src.id && target === "In transit"
      ? { ...i, stock: i.stock - t.quantity }
      : i.id === dest.id && target === "Received"
        ? { ...i, stock: i.stock + t.quantity }
        : i,
  );
  return {
    ...s,
    inventory,
    transfers: s.transfers.map((x) =>
      x.id === id
        ? {
            ...x,
            stage: target,
            events: [...x.events, { stage: target, timestamp: now }],
          }
        : x,
    ),
    actions: [
      {
        id: `${id}-${target}`,
        opportunity: opportunities.find((o) => o.sku === t.sku)!.id,
        product: t.product,
        type:
          target === "In transit"
            ? "Simulated goods issue"
            : target === "Received"
              ? "Simulated goods receipt"
              : `Transfer ${target.toLowerCase()}`,
        quantity: t.quantity,
        status:
          target === "Received"
            ? "Completed"
            : target === "Cancelled"
              ? "Dismissed"
              : "Proposed",
        owner: "Alex Morgan",
        timestamp: now,
        detail: `${id}: ${src.location} → ${dest.location}. ${target === "Received" ? "Destination stock and Commerce availability updated." : target === "In transit" ? "Source stock decreased; quantity held in transit." : "No physical stock movement."}`,
      },
      ...s.actions,
    ],
  };
}
export const inTransitUnits = (s: DemoState) =>
  s.transfers
    .filter((t) => t.stage === "In transit")
    .reduce((n, t) => n + t.quantity, 0);
export function stockTransportDraft(t: TransferOrder, s: DemoState) {
  const source = locationFor(
      s.inventory.find((i) => i.id === t.sourceId)!.location,
    ),
    dest = locationFor(
      s.inventory.find((i) => i.id === t.destinationId)!.location,
    );
  return {
    integrationMode: "DEMO_DRAFT_NOT_SENT",
    correlationId: t.id,
    targetProduct: "SAP S/4HANA",
    service:
      "/sap/opu/odata4/sap/api_stocktransportorder/srvd_a2x/sap/stocktransportorder/0001/StockTransportOrder",
    mappingRequiresTenantValidation: true,
    body: {
      StockTransportOrderType: "UB",
      CompanyCode: "CA00",
      PurchasingOrganization: "CA00",
      PurchasingGroup: "001",
      SupplyingPlant: source.plant,
      DocumentCurrency: "CAD",
      _StockTransportOrderItem: [
        {
          StockTransportOrderItem: "00010",
          Product: t.sku,
          Plant: dest.plant,
          StorageLocation: dest.storage,
          OrderQuantity: t.quantity,
          OrderQuantityUnit: "EA",
          OrderQuantityUnitISOCode: "PCE",
        },
      ],
    },
  };
}
export const onlineSessions = 162;
export function onlineDemand(conversionRate: number, horizon: number) {
  return Math.floor(
    (((onlineSessions * Math.max(0, Math.min(100, conversionRate))) / 100) *
      horizon) /
      7,
  );
}
export function salesRisk(
  demand: number,
  stock: number,
  price: number,
  lossRate: number,
) {
  const units = Math.max(0, Math.ceil(demand) - stock);
  const gross = units * price;
  return {
    units,
    gross,
    expected: (gross * Math.max(0, Math.min(100, lossRate))) / 100,
  };
}
export function storeRisks(s: DemoState, horizon: number, lossRate: number) {
  return opportunities.map((o) => {
    const record = s.inventory.find((i) => i.id === `${o.id}-dest`)!;
    return {
      o,
      record,
      ...salesRisk(
        (demandFor(o, s) * horizon) / 7,
        record.stock,
        o.price,
        lossRate,
      ),
    };
  });
}
export const monthlyHistory: Record<string, number[]> = {
  Tops: [70, 68, 95, 118, 142, 155, 148, 138, 125, 110, 104, 92],
  Denim: [105, 98, 110, 103, 91, 80, 78, 122, 147, 132, 118, 125],
  Bottoms: [28, 30, 62, 115, 168, 190, 205, 172, 105, 60, 35, 32],
  Knitwear: [175, 150, 112, 65, 38, 22, 18, 29, 75, 145, 205, 230],
};
export const months = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
export function seasonalProfile(category: string) {
  const values = monthlyHistory[category] || monthlyHistory.Tops;
  const avg = values.reduce((a, b) => a + b, 0) / 12;
  const seasons = [
    { name: "Winter", indexes: [11, 0, 1] },
    { name: "Spring", indexes: [2, 3, 4] },
    { name: "Summer", indexes: [5, 6, 7] },
    { name: "Autumn", indexes: [8, 9, 10] },
  ].map((s) => ({ ...s, total: s.indexes.reduce((n, i) => n + values[i], 0) }));
  return {
    chart: values.map((units, i) => ({
      month: months[i],
      units,
      index: Math.round((units / avg) * 100),
    })),
    peak: months[values.indexOf(Math.max(...values))],
    low: months[values.indexOf(Math.min(...values))],
    bestSeason: [...seasons].sort((a, b) => b.total - a.total)[0].name,
    worstSeason: [...seasons].sort((a, b) => a.total - b.total)[0].name,
    average: avg,
  };
}
export function downloadJson(name: string, data: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
export const describeRisk = (r: ReturnType<typeof salesRisk>) =>
  `${money(r.expected)} estimated sales foregone (${r.units} uncovered units)`;
