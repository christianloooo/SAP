import { transferable } from "./planning";
import { demandFor, stockFor } from "./data";
import type { Opportunity, DemoState } from "./data";
export type ScenarioKind = "transfer" | "replenish" | "investigate";
export function simulate(
  o: Opportunity,
  state: DemoState,
  kind: ScenarioKind,
  quantity: number,
) {
  const source = state.inventory.find((i) => i.id === `${o.id}-source`)!;
  const maximum =
    kind === "transfer"
      ? transferable(state, source)
      : kind === "replenish" && o.id === "OPP-1042"
        ? 120
        : 0;
  const qty = kind === "investigate" ? 0 : Math.max(0, Math.floor(quantity));
  const gap = Math.max(0, demandFor(o, state) - stockFor(o, state));
  const valid =
    Number.isFinite(quantity) &&
    (kind === "investigate" || Number.isInteger(quantity)) &&
    qty <= maximum &&
    (kind === "investigate" || qty > 0);
  const covered = kind === "transfer" ? Math.min(qty, gap) : 0;
  return {
    qty,
    maximum,
    valid,
    gap,
    covered,
    cost:
      kind === "transfer" ? qty * 1.5 : kind === "replenish" ? qty * 14.5 : 0,
    days: kind === "transfer" ? 2 : kind === "replenish" ? 9 : 3,
    coverage: Math.min(
      100,
      Math.round(((stockFor(o, state) + covered) / demandFor(o, state)) * 100),
    ),
    remaining: Math.max(0, gap - covered),
    revenue: covered * o.price,
  };
}
export function executeTransfer(
  o: Opportunity,
  state: DemoState,
  quantity: number,
): DemoState {
  const result = simulate(o, state, "transfer", quantity);
  if (!result.valid)
    throw new Error(`Transfer must be between 1 and ${result.maximum} units.`);
  return {
    ...state,
    inventory: state.inventory.map((i) =>
      i.id === `${o.id}-source`
        ? { ...i, stock: i.stock - quantity }
        : i.id === `${o.id}-dest`
          ? { ...i, stock: i.stock + quantity }
          : i,
    ),
  };
}
export const conversion = (purchases: number, tries: number) =>
  tries > 0 ? Math.round((purchases / tries) * 1000) / 10 : 0;
export function priorityScore(o: Opportunity, state: DemoState) {
  return Math.round(
    Math.min(
      100,
      (1 - stockFor(o, state) / demandFor(o, state)) * 50 +
        o.growth * 0.7 +
        (o.lead > 14 ? 15 : 0),
    ),
  );
}
