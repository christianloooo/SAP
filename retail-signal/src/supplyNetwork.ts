import { opportunities, demandFor } from "./data";
import type { DemoState, Opportunity } from "./data";
import { locations, transferable, salesRisk, onlineDemand } from "./planning";
export type NetworkNodeKind =
  "supplier" | "product" | "warehouse" | "store" | "online";
export interface SupplyNode {
  id: string;
  name: string;
  kind: NetworkNodeKind;
  skus: string[];
  detail: string;
  risk: boolean;
  x: number;
  y: number;
}
export interface SupplyEdge {
  id: string;
  from: string;
  to: string;
  skus: string[];
  kind: "supply" | "allocation" | "rebalance" | "transfer";
  label: string;
  risk: boolean;
}
export interface SupplyGraph {
  nodes: SupplyNode[];
  edges: SupplyEdge[];
}
export const alternativeSupplier = "Coastal Textiles · Alternative";
export const supplierNames = [
  ...new Set(opportunities.map((o) => o.supplier)),
  alternativeSupplier,
];
export function supplierOpportunities(name: string) {
  return name === alternativeSupplier
    ? [opportunities[0]]
    : opportunities.filter((o) => o.supplier === name);
}
export function buildSupplyGraph(s: DemoState): SupplyGraph {
  const nodes: SupplyNode[] = [],
    edges: SupplyEdge[] = [];
  supplierNames.forEach((name, index) => {
    const related = supplierOpportunities(name);
    const lead =
      name === alternativeSupplier
        ? 9
        : Math.max(...related.map((o) => o.lead));
    nodes.push({
      id: `supplier:${name}`,
      name,
      kind: "supplier",
      skus: related.map((o) => o.sku),
      detail:
        name === alternativeSupplier
          ? "Approved alternative · 9 days"
          : `${lead}-day lead time · ${related.length} SKUs`,
      risk:
        name !== alternativeSupplier &&
        related.some((o) => o.risk !== "On schedule"),
      x: 24,
      y: 76 + index * 111,
    });
  });
  opportunities.forEach((o, index) => {
    nodes.push({
      id: `product:${o.sku}`,
      name: o.product,
      kind: "product",
      skus: [o.sku],
      detail: `${o.color} · ${o.size} · ${o.sku}`,
      risk: o.risk !== "On schedule",
      x: 304,
      y: 48 + index * 98,
    });
    edges.push({
      id: `supply:${o.id}`,
      from: `supplier:${o.supplier}`,
      to: `product:${o.sku}`,
      skus: [o.sku],
      kind: "supply",
      label: `${o.lead} days`,
      risk: o.risk !== "On schedule",
    });
    const wh = s.inventory.find((i) => i.id === `${o.id}-wh`)!;
    const src = s.inventory.find((i) => i.id === `${o.id}-source`)!;
    edges.push(
      {
        id: `warehouse:${o.id}`,
        from: `product:${o.sku}`,
        to: `location:${wh.location}`,
        skus: [o.sku],
        kind: "allocation",
        label: "Inventory dependency",
        risk: false,
      },
      {
        id: `dest:${o.id}`,
        from: `location:${wh.location}`,
        to: `location:${o.location}`,
        skus: [o.sku],
        kind: "allocation",
        label: "Modeled fulfillment link",
        risk: false,
      },
      {
        id: `source:${o.id}`,
        from: `location:${wh.location}`,
        to: `location:${src.location}`,
        skus: [o.sku],
        kind: "allocation",
        label: "Modeled fulfillment link",
        risk: false,
      },
      {
        id: `rebalance:${o.id}`,
        from: `location:${src.location}`,
        to: `location:${o.location}`,
        skus: [o.sku],
        kind: "rebalance",
        label: `${transferable(s, src)} units available`,
        risk: false,
      },
    );
  });
  edges.push({
    id: "supply:alternative",
    from: `supplier:${alternativeSupplier}`,
    to: `product:${opportunities[0].sku}`,
    skus: [opportunities[0].sku],
    kind: "supply",
    label: "9 days · alternative",
    risk: false,
  });
  const warehouses = locations.filter((l) => l.kind === "Warehouse"),
    endpoints = locations.filter((l) => l.kind !== "Warehouse");
  [...warehouses, ...endpoints].forEach((l) => {
    const records = s.inventory.filter((i) => i.location === l.name);
    const related = opportunities.filter((o) =>
      records.some((i) => i.sku === o.sku),
    );
    const shortage =
      related
        .filter((o) => o.location === l.name)
        .reduce(
          (n, o) =>
            n +
            Math.max(
              0,
              demandFor(o, s) - records.find((i) => i.sku === o.sku)!.stock,
            ),
          0,
        ) +
      (l.kind === "Online fulfillment"
        ? Math.max(0, onlineDemand(15, 7) - records[0].stock)
        : 0);
    const available = records
      .filter((i) => i.reserve > 0)
      .reduce((n, i) => n + transferable(s, i), 0);
    nodes.push({
      id: `location:${l.name}`,
      name: l.name,
      kind:
        l.kind === "Warehouse"
          ? "warehouse"
          : l.kind === "Online fulfillment"
            ? "online"
            : "store",
      skus: records.map((i) => i.sku),
      detail: shortage
        ? `${shortage} units uncovered · ${l.plant}`
        : available
          ? `${available} transferable units · ${l.plant}`
          : `Protected stock · ${l.plant}`,
      risk: shortage > 0,
      x: l.kind === "Warehouse" ? 592 : 884,
      y:
        l.kind === "Warehouse"
          ? 126 + warehouses.indexOf(l) * 190
          : 30 + endpoints.indexOf(l) * 88,
    });
  });
  edges.push({
    id: "online:fulfillment",
    from: "location:Western Distribution Center",
    to: "location:Online West Fulfillment",
    skus: [opportunities[0].sku],
    kind: "allocation",
    label: "Online fulfillment",
    risk: false,
  });
  s.transfers
    .filter((t) => t.stage !== "Cancelled")
    .forEach((t) => {
      const src = s.inventory.find((i) => i.id === t.sourceId)!,
        dest = s.inventory.find((i) => i.id === t.destinationId)!;
      edges.push({
        id: `transfer:${t.id}`,
        from: `location:${src.location}`,
        to: `location:${dest.location}`,
        skus: [t.sku],
        kind: "transfer",
        label: `${t.quantity} units · ${t.stage}`,
        risk: false,
      });
    });
  return { nodes, edges };
}
/** Trace by SKU to avoid inventing supplier dependencies through a shared warehouse. */
export function traceNetwork(
  graph: SupplyGraph,
  nodeId: string,
  skuFilter = "All products",
) {
  const node = graph.nodes.find((n) => n.id === nodeId);
  const skus = new Set(
    (node?.skus || opportunities.map((o) => o.sku)).filter(
      (sku) => skuFilter === "All products" || sku === skuFilter,
    ),
  );
  const edges = graph.edges.filter((e) => e.skus.some((sku) => skus.has(sku)));
  const ids = new Set(edges.flatMap((e) => [e.from, e.to]));
  if (node) ids.add(node.id);
  return { nodes: graph.nodes.filter((n) => ids.has(n.id)), edges, skus };
}
export function supplierImpact(name: string, s: DemoState, extraDays: number) {
  const related = supplierOpportunities(name);
  const rows = related.map((o) => {
    const stock = s.inventory.find((i) => i.id === `${o.id}-dest`)!.stock;
    const lead = name === alternativeSupplier ? 9 : o.lead;
    const current = salesRisk(demandFor(o, s), stock, o.price, 70);
    const baseline = salesRisk(
      (demandFor(o, s) * lead) / 7,
      stock,
      o.price,
      70,
    );
    const delayed = salesRisk(
      (demandFor(o, s) * (lead + extraDays)) / 7,
      stock,
      o.price,
      70,
    );
    return {
      o,
      stock,
      lead: lead + extraDays,
      currentLoss: current.expected,
      additionalLoss: Math.max(0, delayed.expected - baseline.expected),
    };
  });
  return {
    rows,
    locations: [...new Set(related.map((o) => o.location))],
    currentLoss: rows.reduce((n, r) => n + r.currentLoss, 0),
    additionalLoss: rows.reduce((n, r) => n + r.additionalLoss, 0),
  };
}
export function incomingUnits(s: DemoState, destinationId: string) {
  return s.transfers
    .filter(
      (t) =>
        t.destinationId === destinationId &&
        !["Received", "Cancelled"].includes(t.stage),
    )
    .reduce((n, t) => n + t.quantity, 0);
}
export function proposalFor(o: Opportunity, s: DemoState) {
  const dest = s.inventory.find((i) => i.id === `${o.id}-dest`)!;
  const source = s.inventory.find((i) => i.id === `${o.id}-source`)!;
  const gap = Math.max(
    0,
    demandFor(o, s) - dest.stock - incomingUnits(s, dest.id),
  );
  return {
    source,
    destination: dest,
    quantity: Math.min(40, transferable(s, source), gap),
  };
}
