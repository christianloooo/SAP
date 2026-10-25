import { opportunities, demandFor } from "./data";
import type { DemoState } from "./data";
import { onlineDemand, transferable } from "./planning";
export type CascadeResponse = "none" | "rebalance" | "alternative";
export interface CascadeConfig {
  supplier: string;
  delayDays: number;
  horizon: number;
  demandPercent: number;
  inboundWeeks: number;
  response: CascadeResponse;
  sku: string;
  resourceShock?: { skus: string[]; supplyPercent: number; delayDays: number };
}
export interface CascadeEvent {
  day: number;
  kind:
    | "supplier-arrival"
    | "dispatch"
    | "receipt"
    | "shortage"
    | "recovery"
    | "capacity";
  sku: string;
  location: string;
  from?: string;
  quantity: number;
  message: string;
}
export interface ProjectedRecord {
  id: string;
  sku: string;
  location: string;
  stock: number;
  available: number;
  unmet: number;
  cumulativeUnmet: number;
  firstShortage: number | null;
  firstCapacity: number | null;
  inbound: number;
}
export interface CascadeDay {
  day: number;
  records: ProjectedRecord[];
  inTransit: number;
  fulfilled: number;
  unmet: number;
  loss: number;
  cumulativeLoss: number;
  cumulativeUnmet: number;
  supplierReceipts: number;
  physicalStock: number;
}
export interface CascadeRun {
  days: CascadeDay[];
  events: CascadeEvent[];
  initialUnits: number;
  responseCost: number;
  responseTransfers: {
    sku: string;
    source: string;
    destination: string;
    quantity: number;
    arrivalDay: number;
  }[];
}
const precision = (n: number) => Math.round(n * 1e8) / 1e8;
export function simulateCascade(
  state: DemoState,
  config: CascadeConfig,
): CascadeRun {
  if (
    !Number.isInteger(config.horizon) ||
    config.horizon < 7 ||
    config.horizon > 90 ||
    !Number.isInteger(config.delayDays) ||
    config.delayDays < 0 ||
    config.delayDays > 45 ||
    !Number.isFinite(config.demandPercent) ||
    config.demandPercent < 10 ||
    config.demandPercent > 300 ||
    !Number.isFinite(config.inboundWeeks) ||
    config.inboundWeeks < 1 ||
    config.inboundWeeks > 12
  )
    throw new Error("Invalid timeline assumptions.");
  const shock = config.resourceShock;
  if (
    shock &&
    (!Number.isFinite(shock.supplyPercent) ||
      shock.supplyPercent < 0 ||
      shock.supplyPercent > 100 ||
      !Number.isInteger(shock.delayDays) ||
      shock.delayDays < 0 ||
      shock.delayDays > 30)
  )
    throw new Error("Invalid resource shock.");
  const products = opportunities.filter(
    (o) => config.sku === "All products" || o.sku === config.sku,
  );
  const skus = new Set(products.map((o) => o.sku));
  const records = state.inventory
    .filter((i) => skus.has(i.sku))
    .map((i) => ({ ...i }));
  const productFor = (sku: string) => products.find((o) => o.sku === sku)!;
  const byId = new Map(records.map((i) => [i.id, i]));
  const holds = new Map(records.map((i) => [i.id, 0]));
  const stages = state.transfers.filter((t) => skus.has(t.sku));
  stages
    .filter((t) => t.stage === "Proposed" || t.stage === "Approved")
    .forEach((t) =>
      holds.set(t.sourceId, (holds.get(t.sourceId) || 0) + t.quantity),
    );
  interface Shipment {
    source: string;
    destination: string;
    quantity: number;
    arrival: number;
    sku: string;
  }
  const transit: Shipment[] = stages
    .filter((t) => t.stage === "In transit")
    .map((t) => ({
      source: t.sourceId,
      destination: t.destinationId,
      quantity: t.quantity,
      arrival: 2,
      sku: t.sku,
    }));
  const initialUnits =
    records.reduce((n, i) => n + i.stock, 0) +
    transit.reduce((n, t) => n + t.quantity, 0);
  const events: CascadeEvent[] = [];
  const days: CascadeDay[] = [];
  const first = new Map<string, number>();
  const capacity = new Map<string, number>();
  const cumulative = new Map(records.map((i) => [i.id, 0]));
  let supplierReceipts = 0,
    fulfilled = 0,
    loss = 0,
    totalUnmet = 0,
    responseCost = 0;
  const impacted = (sku: string) =>
    productFor(sku).supplier === config.supplier;
  const responseTransfers: CascadeRun["responseTransfers"] = [];
  const free = (id: string) => {
    const i = byId.get(id)!;
    return Math.max(0, i.stock - i.reserve - (holds.get(id) || 0));
  };
  const send = (
    source: string,
    destination: string,
    quantity: number,
    day: number,
    reason: string,
  ) => {
    if (quantity <= 1e-9) return;
    const a = byId.get(source)!,
      b = byId.get(destination)!;
    a.stock = precision(a.stock - quantity);
    transit.push({
      source,
      destination,
      quantity,
      arrival: day + 2,
      sku: a.sku,
    });
    events.push({
      day,
      kind: "dispatch",
      sku: a.sku,
      location: b.location,
      from: a.location,
      quantity,
      message: `${reason}: ${precision(quantity)} units dispatched; arrive day ${day + 2}.`,
    });
  };
  const outstanding = (id: string) =>
    transit
      .filter((t) => t.destination === id)
      .reduce((n, t) => n + t.quantity, 0);
  const snapshot = (day: number, unmetById: Map<string, number>) => {
    days.push({
      day,
      records: records.map((i) => ({
        id: i.id,
        sku: i.sku,
        location: i.location,
        stock: precision(i.stock),
        available: precision(free(i.id)),
        unmet: precision(unmetById.get(i.id) || 0),
        cumulativeUnmet: precision(cumulative.get(i.id) || 0),
        firstShortage: first.get(i.id) ?? null,
        firstCapacity: capacity.get(i.id) ?? null,
        inbound: precision(outstanding(i.id)),
      })),
      inTransit: precision(transit.reduce((n, t) => n + t.quantity, 0)),
      fulfilled: precision(fulfilled),
      unmet: precision([...unmetById.values()].reduce((a, b) => a + b, 0)),
      loss: precision(loss),
      cumulativeLoss: precision(loss),
      cumulativeUnmet: precision(totalUnmet),
      supplierReceipts: precision(supplierReceipts),
      physicalStock: precision(records.reduce((n, i) => n + i.stock, 0)),
    });
  };
  snapshot(0, new Map());
  for (let day = 1; day <= config.horizon; day++) {
    for (let j = transit.length - 1; j >= 0; j--) {
      const t = transit[j];
      if (t.arrival > day) continue;
      const dest = byId.get(t.destination)!;
      dest.stock = precision(dest.stock + t.quantity);
      events.push({
        day,
        kind: "receipt",
        sku: t.sku,
        location: dest.location,
        from: byId.get(t.source)?.location,
        quantity: t.quantity,
        message: `${precision(t.quantity)} units received and available for sale.`,
      });
      transit.splice(j, 1);
    }
    for (const o of products) {
      const inputAffected = shock?.skus.includes(o.sku) || false;
      const inputDelay = inputAffected ? shock!.delayDays : 0;
      const primaryDay =
        o.lead + (impacted(o.sku) ? config.delayDays : 0) + inputDelay;
      const alternative =
        config.response === "alternative" &&
        impacted(o.sku) &&
        o.id === "OPP-1042" &&
        day === 9 + inputDelay;
      const primary = day === primaryDay;
      if (!primary && !alternative) continue;
      const wh = byId.get(`${o.id}-wh`)!;
      const plannedQuantity = alternative
        ? 120
        : Math.ceil(o.demand * config.inboundWeeks);
      const quantity = inputAffected
        ? Math.floor((plannedQuantity * shock!.supplyPercent) / 100)
        : plannedQuantity;
      if (quantity === 0) continue;
      wh.stock += quantity;
      supplierReceipts += quantity;
      if (alternative) responseCost += quantity * 14.5;
      events.push({
        day,
        kind: "supplier-arrival",
        sku: o.sku,
        location: wh.location,
        from: alternative ? "Coastal Textiles · Alternative" : o.supplier,
        quantity,
        message: `${alternative ? "Alternative order" : "Assumed primary replenishment"}: ${quantity} units reach distribution on day ${day}.${inputAffected ? ` Input shock: ${shock!.supplyPercent}% of planned supply, +${inputDelay} days.` : ""}`,
      });
    }
    if (day === 1) {
      for (const t of stages.filter((t) => t.stage === "Approved")) {
        holds.set(
          t.sourceId,
          Math.max(0, (holds.get(t.sourceId) || 0) - t.quantity),
        );
        const qty = Math.min(t.quantity, free(t.sourceId));
        send(
          t.sourceId,
          t.destinationId,
          qty,
          day,
          "Existing approved transfer",
        );
      }
      if (config.response === "rebalance") {
        for (const o of products.filter((o) => impacted(o.sku))) {
          const src = byId.get(`${o.id}-source`)!,
            dest = byId.get(`${o.id}-dest`)!;
          const incoming = stages
            .filter(
              (t) =>
                t.destinationId === dest.id &&
                !["Received", "Cancelled"].includes(t.stage),
            )
            .reduce((n, t) => n + t.quantity, 0);
          const quantity = Math.min(
            40,
            transferable(
              state,
              state.inventory.find((i) => i.id === src.id)!,
            ),
            free(src.id),
            Math.max(
              0,
              (demandFor(o, state) * config.demandPercent) / 100 -
                dest.stock -
                incoming,
            ),
          );
          if (quantity > 0) {
            send(src.id, dest.id, quantity, day, "Scenario response transfer");
            responseCost += quantity * 1.5;
            responseTransfers.push({
              sku: o.sku,
              source: src.location,
              destination: dest.location,
              quantity,
              arrivalDay: 3,
            });
          }
        }
      }
    }
    // Allocation is deterministic: destination store, online, then source-store local cover.
    for (const o of products) {
      const wh = byId.get(`${o.id}-wh`)!;
      const dest = byId.get(`${o.id}-dest`)!;
      const src = byId.get(`${o.id}-source`)!;
      const online = byId.get("online-west");
      const endpoints = [dest, ...(online?.sku === o.sku ? [online] : []), src];
      for (const endpoint of endpoints) {
        const daily =
          ((endpoint.id === dest.id
            ? demandFor(o, state) / 7
            : endpoint.id === "online-west"
              ? onlineDemand(15, 7) / 7
              : endpoint.daily) *
            config.demandPercent) /
          100;
        const target = Math.max(endpoint.reserve, daily * 7);
        const need = Math.max(
          0,
          target -
            endpoint.stock -
            outstanding(endpoint.id) -
            (holds.get(endpoint.id) || 0),
        );
        send(
          wh.id,
          endpoint.id,
          Math.min(free(wh.id), need),
          day,
          "Warehouse allocation",
        );
      }
      if (free(wh.id) <= 1e-8 && !capacity.has(wh.id)) {
        capacity.set(wh.id, day);
        events.push({
          day,
          kind: "capacity",
          sku: o.sku,
          location: wh.location,
          quantity: 0,
          message: "No dispatchable stock above the warehouse safety reserve.",
        });
      }
    }
    const shortages = new Map<string, number>();
    for (const i of records.filter((i) => !i.id.endsWith("-wh"))) {
      const o = productFor(i.sku);
      const daily =
        ((i.id.endsWith("-dest")
          ? demandFor(o, state) / 7
          : i.id === "online-west"
            ? onlineDemand(15, 7) / 7
            : i.daily) *
          config.demandPercent) /
        100;
      const sold = Math.min(
        daily,
        Math.max(0, i.stock - (holds.get(i.id) || 0)),
      );
      i.stock = precision(i.stock - sold);
      fulfilled += sold;
      const unmet = Math.max(0, daily - sold);
      shortages.set(i.id, unmet);
      cumulative.set(i.id, (cumulative.get(i.id) || 0) + unmet);
      totalUnmet += unmet;
      loss += unmet * o.price * 0.7;
      if (unmet > 1e-8 && !first.has(i.id)) {
        first.set(i.id, day);
        events.push({
          day,
          kind: "shortage",
          sku: i.sku,
          location: i.location,
          quantity: unmet,
          message: `First unfulfilled daily demand on day ${day}.`,
        });
      }
      if (
        unmet <= 1e-8 &&
        (days[days.length - 1].records.find((r) => r.id === i.id)?.unmet || 0) >
          1e-8
      )
        events.push({
          day,
          kind: "recovery",
          sku: i.sku,
          location: i.location,
          quantity: i.stock,
          message: "Daily demand is fully covered again after supply arrives.",
        });
    }
    snapshot(day, shortages);
  }
  return {
    days,
    events: events.sort((a, b) => a.day - b.day),
    initialUnits,
    responseCost,
    responseTransfers,
  };
}
export function cascadeNodeState(
  run: CascadeRun,
  day: number,
  node: { id: string; kind: string; skus: string[] },
  supplier: string,
  delayDays: number,
) {
  const point = run.days[Math.min(day, run.days.length - 1)];
  const relevant = point.records.filter(
    (r) =>
      node.skus.includes(r.sku) &&
      (node.kind === "product" || node.id === `location:${r.location}`),
  );
  if (node.kind === "supplier") {
    const arrivals = run.events.filter(
      (e) => e.kind === "supplier-arrival" && `supplier:${e.from}` === node.id,
    );
    const next = arrivals.find((e) => e.day > day);
    const delayed = node.id === `supplier:${supplier}` && delayDays > 0;
    return {
      risk: delayed && (!arrivals.length || !!next),
      detail: next
        ? `Next receipt day ${next.day}${delayed ? " · delayed" : ""}`
        : arrivals.length
          ? "Replenishment reached distribution"
          : "No inbound in this horizon",
      first: null,
      stock: 0,
    };
  }
  const risk =
    relevant.some((r) => r.unmet > 1e-8) ||
    (node.kind === "warehouse" && relevant.some((r) => r.available <= 1e-8));
  const firsts = relevant
    .map((r) => {
      const final = run.days[run.days.length - 1].records.find(
        (x) => x.id === r.id,
      )!;
      return node.kind === "warehouse"
        ? final.firstCapacity
        : final.firstShortage;
    })
    .filter((d): d is number => d !== null);
  const first = firsts.length ? Math.min(...firsts) : null;
  const stock = relevant.reduce((n, r) => n + r.stock, 0);
  const unmet = relevant.reduce((n, r) => n + r.unmet, 0);
  return {
    risk,
    detail:
      node.kind === "product"
        ? `Day ${day}: ${unmet.toFixed(1)} units short today`
        : node.kind === "warehouse"
          ? `${relevant.reduce((n, r) => n + r.available, 0).toFixed(1)} dispatchable · day ${day}`
          : `${stock.toFixed(1)} on hand${unmet > 1e-8 ? " · SHORTAGE" : ""}`,
    first,
    stock,
  };
}
