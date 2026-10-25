import { resources } from "./resources";
import { opportunities, demandFor } from "./data";
import type { DemoState, Opportunity } from "./data";
import { locations, transferable, salesRisk, onlineDemand } from "./planning";
export type NetworkNodeKind =
  | "material"
  | "production"
  | "supplier"
  | "product"
  | "warehouse"
  | "store"
  | "online";
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
  kind:
    | "material"
    | "production"
    | "supply"
    | "allocation"
    | "rebalance"
    | "transfer";
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
      x: 272,
      y: 50 + index * 138,
    });
  });
  // Input specifications and purchase rates are illustrative procurement assumptions.
  const materials = resources;
  supplierNames.forEach((name, index) => {
    const related = supplierOpportunities(name);
    nodes.push({
      id: `production:${name}`,
      name:
        name === alternativeSupplier
          ? "Alternative production"
          : `${name.split(" ")[0]} production`,
      kind: "production",
      skus: related.map((o) => o.sku),
      detail: "Cut / sew / finish · illustrative",
      risk: false,
      x: 520,
      y: 50 + index * 138,
    });
    edges.push({
      id: `production:${name}`,
      from: `supplier:${name}`,
      to: `production:${name}`,
      skus: related.map((o) => o.sku),
      kind: "production",
      label:
        "Illustrative production relationship; lead time included in supplier lead",
      risk: false,
    });
  });
  materials.forEach((m, index) => {
    const related = opportunities.filter((o) =>
      m.categories.includes(o.category),
    );
    nodes.push({
      id: `material:${m.id}`,
      name: m.name,
      kind: "material",
      skus: related.map((o) => o.sku),
      detail: `Purchased per ${m.unit} · demo rates`,
      risk: false,
      x: 24,
      y: 40 + index * 112,
    });
    if (m.id === "diesel") {
      m.contracts.forEach((c) => {
        const skus = s.inventory
          .filter((i) => `location:${i.location}` === c.nodeId)
          .map((i) => i.sku);
        edges.push({
          id: `fuel:${c.nodeId}`,
          from: `material:${m.id}`,
          to: c.nodeId,
          skus,
          kind: "material",
          label: "Illustrative diesel dependency · 0.8 litre per new garment",
          risk: false,
        });
      });
      return;
    }
    supplierNames.forEach((name) => {
      const skus = supplierOpportunities(name)
        .filter((o) => m.categories.includes(o.category))
        .map((o) => o.sku);
      if (skus.length)
        edges.push({
          id: `${m.id}:${name}`,
          from: `material:${m.id}`,
          to: `supplier:${name}`,
          skus,
          kind: "material",
          label: "Illustrative material dependency; availability unverified",
          risk: false,
        });
    });
  });
  opportunities.forEach((o, index) => {
    nodes.push({
      id: `product:${o.sku}`,
      name: o.product,
      kind: "product",
      skus: [o.sku],
      detail: `${s.inventory.find((i) => i.id === `${o.id}-dest`)!.stock} on hand / ${demandFor(o, s)} demand · 7 days`,
      risk:
        s.inventory.find((i) => i.id === `${o.id}-dest`)!.stock <
        demandFor(o, s),
      x: 768,
      y: 40 + index * 112,
    });
    edges.push({
      id: `supply:${o.id}`,
      from: `production:${o.supplier}`,
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
    from: `production:${alternativeSupplier}`,
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
      x: l.kind === "Warehouse" ? 1016 : 1264,
      y:
        l.kind === "Warehouse"
          ? 126 + warehouses.indexOf(l) * 190
          : 30 + endpoints.indexOf(l) * 96,
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

export type NetworkDirection = "both" | "upstream" | "downstream";
/** Directional reachability retains the SKU carried along each path. */
export function focusNetwork(
  graph: SupplyGraph,
  nodeId: string,
  skuFilter = "All products",
  direction: NetworkDirection = "both",
) {
  const node = graph.nodes.find((n) => n.id === nodeId);
  const skus = new Set(
    (node?.skus || []).filter(
      (sku) => skuFilter === "All products" || sku === skuFilter,
    ),
  );
  const ids = new Set<string>(node ? [node.id] : []),
    edgeIds = new Set<string>();
  for (const sku of skus) {
    for (const upstream of direction === "both"
      ? [true, false]
      : [direction === "upstream"]) {
      const visited = new Set([nodeId]),
        queue = [nodeId];
      while (queue.length) {
        const id = queue.shift()!;
        for (const e of graph.edges) {
          if (!e.skus.includes(sku) || (upstream ? e.to : e.from) !== id)
            continue;
          const next = upstream ? e.from : e.to;
          edgeIds.add(e.id);
          ids.add(next);
          if (!visited.has(next)) {
            visited.add(next);
            queue.push(next);
          }
        }
      }
    }
  }
  return {
    nodes: graph.nodes.filter((n) => ids.has(n.id)),
    edges: graph.edges.filter((e) => edgeIds.has(e.id)),
    skus,
  };
}
export interface NetworkIssue {
  id: string;
  sku: string;
  title: string;
  evidence: string;
  severity: "Error" | "Warning" | "Information";
  source:
    | "Demand Intelligence"
    | "Inventory & Supply"
    | "SAP Workflow"
    | "Action Center";
  opportunity: Opportunity;
}
export function networkIssues(
  state: DemoState,
  skus: Set<string>,
): NetworkIssue[] {
  const issues: NetworkIssue[] = [];
  for (const o of opportunities.filter((o) => skus.has(o.sku))) {
    const dest = state.inventory.find((i) => i.id === `${o.id}-dest`)!;
    const gap = Math.max(0, demandFor(o, state) - dest.stock);
    if (gap)
      issues.push({
        id: `gap:${o.id}`,
        sku: o.sku,
        title: `${o.location}: ${gap} units uncovered`,
        evidence: `${dest.stock} on hand / ${demandFor(o, state)} units of 7-day demand. ${incomingUnits(state, dest.id)} units in open proposals or transit; not yet on hand.`,
        severity: "Error",
        source: "Inventory & Supply",
        opportunity: o,
      });
    if (o.risk !== "On schedule")
      issues.push({
        id: `supplier:${o.id}`,
        sku: o.sku,
        title: `${o.supplier}: ${o.risk}`,
        evidence: `${o.lead}-day supplier lead time; exceeds the 7-day demand window. Seeded supplier status.`,
        severity: "Warning",
        source: "Inventory & Supply",
        opportunity: o,
      });
    const rate = (o.purchases / o.tries) * 100;
    if (rate < o.baseline)
      issues.push({
        id: `conversion:${o.id}`,
        sku: o.sku,
        title: `Conversion ${(o.baseline - rate).toFixed(1)} pp below baseline`,
        evidence: `${o.purchases} purchases / ${o.tries} try-ons = ${rate.toFixed(1)}%; baseline ${o.baseline}%. ${o.oos} qualified out-of-stock sessions. Availability, fit and price require investigation.`,
        severity: "Warning",
        source: "Demand Intelligence",
        opportunity: o,
      });
    for (const t of state.transfers.filter(
      (t) => t.sku === o.sku && !["Received", "Cancelled"].includes(t.stage),
    ))
      issues.push({
        id: t.id,
        sku: o.sku,
        title: `${t.id}: ${t.stage}`,
        evidence: `${t.quantity} units ${t.stage === "In transit" ? "in transit" : "awaiting workflow execution"}; stock becomes sellable only on receipt.`,
        severity: "Information",
        source: "SAP Workflow",
        opportunity: o,
      });
    for (const a of state.actions.filter(
      (a) => a.opportunity === o.id && a.status === "Pending review",
    ))
      issues.push({
        id: a.id,
        sku: o.sku,
        title: a.type,
        evidence: `${a.owner}: ${a.detail}`,
        severity: "Information",
        source: "Action Center",
        opportunity: o,
      });
  }
  const online = state.inventory.find((i) => i.id === "online-west");
  if (online && skus.has(online.sku) && online.stock < onlineDemand(15, 7))
    issues.push({
      id: "online-gap",
      sku: online.sku,
      title: `Online West: ${onlineDemand(15, 7) - online.stock} units uncovered`,
      evidence: `${online.stock} sellable units; 15% conversion assumption on qualified sessions. Seven-day estimated sales foregone: ${salesRisk(onlineDemand(15, 7), online.stock, opportunities[0].price, 70).expected.toFixed(2)} CAD at 70% lost sales.`,
      severity: "Error",
      source: "Demand Intelligence",
      opportunity: opportunities[0],
    });
  return issues;
}
