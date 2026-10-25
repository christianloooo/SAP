import type { Inventory, Opportunity, AuditAction } from "../data";
export type ConnectorState = "Simulated" | "Integration-ready" | "Connected";
export interface SAPInventoryAdapter {
  state: ConnectorState;
  readInventory(): Promise<Inventory[]>;
  proposeTransfer(request: {
    sku: string;
    source: string;
    destination: string;
    quantity: number;
  }): Promise<{ reference: string; status: "Proposed" }>;
}
export interface CustomerActivityAdapter {
  state: ConnectorState;
  readOpportunities(): Promise<Opportunity[]>;
}
export interface PlanningAdapter {
  state: ConnectorState;
  submitPlanningHandoff(action: AuditAction): Promise<{ reference: string }>;
}
/** Contracts only. Production adapters require a server-side authenticated SAP tenant and
 * authorization, idempotency keys, concurrency checks and API-specific entity mappings.
 * A browser-only demo must never store SAP credentials or claim a real transaction.
 */
export interface QualifiedEvent {
  sessionId: string;
  sku: string;
  channel: "store" | "online";
  kind: "try-on" | "purchase" | "search" | "out-of-stock";
  bot: boolean;
  timestamp: string;
}
export function qualifyEvents(
  events: QualifiedEvent[],
  from: string,
  to: string,
): QualifiedEvent[] {
  const seen = new Set<string>();
  return events.filter((e) => {
    if (e.bot || e.timestamp < from || e.timestamp > to) return false;
    const key = [e.channel, e.sessionId, e.sku, e.kind].join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
