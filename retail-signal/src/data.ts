import type { TransferOrder } from "./planning";
export type Page =
  | "Location Intelligence"
  | "Risk & Seasonality"
  | "SAP Workflow"
  | "Command Center"
  | "Opportunities"
  | "Demand Intelligence"
  | "Inventory & Supply"
  | "Action Center"
  | "Integrations"
  | "About Retail Signal";
export type Priority = "Critical" | "High" | "Medium";
export interface Opportunity {
  id: string;
  product: string;
  sku: string;
  size: string;
  color: string;
  category: string;
  location: string;
  priority: Priority;
  growth: number;
  demand: number;
  price: number;
  stock: number;
  tries: number;
  purchases: number;
  baseline: number;
  searches: number;
  oos: number;
  supplier: string;
  lead: number;
  risk: string;
  action: string;
  detected: string;
}
export interface Inventory {
  id: string;
  sku: string;
  location: string;
  type: "Store" | "Warehouse";
  stock: number;
  reserve: number;
  daily: number;
}
export interface AuditAction {
  id: string;
  opportunity: string;
  product: string;
  type: string;
  quantity: number;
  status: "Completed" | "Pending review" | "Proposed" | "Dismissed";
  owner: string;
  timestamp: string;
  detail: string;
}
export interface DemoState {
  inventory: Inventory[];
  actions: AuditAction[];
  spike: boolean;
  dismissed: string[];
  transfers: TransferOrder[];
}
export const opportunities: Opportunity[] = [
  {
    id: "OPP-1042",
    product: "Essential Ribbed Top",
    sku: "ERT-CRM-M",
    size: "M",
    color: "Cream",
    category: "Tops",
    location: "Vancouver Downtown",
    priority: "Critical",
    growth: 38,
    demand: 80,
    price: 39,
    stock: 8,
    tries: 240,
    purchases: 43,
    baseline: 32,
    searches: 486,
    oos: 162,
    supplier: "Pacific Apparel Co.",
    lead: 21,
    risk: "Lead time +7 days",
    action: "Transfer available stock",
    detected: "2026-10-23",
  },
  {
    id: "OPP-1041",
    product: "Classic Straight Jeans",
    sku: "CSJ-IND-30",
    size: "30",
    color: "Indigo",
    category: "Denim",
    location: "Toronto Queen Street",
    priority: "High",
    growth: 26,
    demand: 65,
    price: 89,
    stock: 12,
    tries: 180,
    purchases: 46,
    baseline: 31,
    searches: 320,
    oos: 94,
    supplier: "Denim Works",
    lead: 18,
    risk: "Shipment delayed",
    action: "Review replenishment",
    detected: "2026-10-22",
  },
  {
    id: "OPP-1040",
    product: "Everyday Cotton Shirt",
    sku: "ECS-WHT-L",
    size: "L",
    color: "White",
    category: "Tops",
    location: "Vancouver Downtown",
    priority: "High",
    growth: 24,
    demand: 52,
    price: 59,
    stock: 16,
    tries: 156,
    purchases: 38,
    baseline: 30,
    searches: 274,
    oos: 78,
    supplier: "Pacific Apparel Co.",
    lead: 21,
    risk: "Lead time +7 days",
    action: "Investigate conversion",
    detected: "2026-10-21",
  },
  {
    id: "OPP-1039",
    product: "Relaxed Linen Trousers",
    sku: "RLT-SND-M",
    size: "M",
    color: "Sand",
    category: "Bottoms",
    location: "Montreal Centre",
    priority: "High",
    growth: 31,
    demand: 44,
    price: 79,
    stock: 10,
    tries: 124,
    purchases: 36,
    baseline: 33,
    searches: 246,
    oos: 66,
    supplier: "Atelier Textile",
    lead: 12,
    risk: "On schedule",
    action: "Transfer available stock",
    detected: "2026-10-20",
  },
  {
    id: "OPP-1038",
    product: "Merino Crewneck",
    sku: "MCR-NVY-L",
    size: "L",
    color: "Navy",
    category: "Knitwear",
    location: "Toronto Queen Street",
    priority: "Medium",
    growth: 18,
    demand: 36,
    price: 119,
    stock: 22,
    tries: 96,
    purchases: 31,
    baseline: 34,
    searches: 192,
    oos: 42,
    supplier: "Northern Knit",
    lead: 14,
    risk: "On schedule",
    action: "Monitor demand",
    detected: "2026-10-19",
  },
  {
    id: "OPP-1037",
    product: "Essential Ribbed Top",
    sku: "ERT-BLK-S",
    size: "S",
    color: "Black",
    category: "Tops",
    location: "Montreal Centre",
    priority: "Medium",
    growth: 16,
    demand: 28,
    price: 39,
    stock: 18,
    tries: 110,
    purchases: 30,
    baseline: 32,
    searches: 168,
    oos: 35,
    supplier: "Pacific Apparel Co.",
    lead: 21,
    risk: "Lead time +7 days",
    action: "Monitor demand",
    detected: "2026-10-18",
  },
];
export const initialInventory: Inventory[] = opportunities.flatMap((o, i) => [
  {
    id: `${o.id}-dest`,
    sku: o.sku,
    location: o.location,
    type: "Store",
    stock: o.stock,
    reserve: 0,
    daily: Math.round((o.demand / 7) * 10) / 10,
  },
  {
    id: `${o.id}-source`,
    sku: o.sku,
    location:
      i === 0 || o.location.startsWith("Vancouver")
        ? "Burnaby Metrotown"
        : o.location.startsWith("Toronto")
          ? "Mississauga Square One"
          : "Laval Carrefour",
    type: "Store",
    stock: i === 0 ? 76 : 48,
    reserve: i === 0 ? 36 : 24,
    daily: 2.4,
  },
  {
    id: `${o.id}-wh`,
    sku: o.sku,
    location: o.location.startsWith("Toronto")
      ? "Ontario Distribution Center"
      : o.location.startsWith("Montreal")
        ? "Quebec Distribution Center"
        : "Western Distribution Center",
    type: "Warehouse",
    stock: i === 0 ? 24 : 32,
    reserve: i === 0 ? 16 : 12,
    daily: 4,
  },
]);
initialInventory.push({
  id: "online-west",
  sku: "ERT-CRM-M",
  location: "Online West Fulfillment",
  type: "Warehouse",
  stock: 0,
  reserve: 0,
  daily: 3.4,
});
export const freshState = (): DemoState => ({
  inventory: structuredClone(initialInventory),
  actions: [],
  spike: false,
  dismissed: [],
  transfers: [],
});
export const money = (n: number) =>
  new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format(n);
export const demandFor = (o: Opportunity, s: DemoState) =>
  o.demand + (s.spike && o.id === "OPP-1042" ? 24 : 0);
export const stockFor = (o: Opportunity, s: DemoState) =>
  s.inventory.find((i) => i.id === `${o.id}-dest`)!.stock;
export const gapFor = (o: Opportunity, s: DemoState) =>
  Math.max(0, demandFor(o, s) - stockFor(o, s));
