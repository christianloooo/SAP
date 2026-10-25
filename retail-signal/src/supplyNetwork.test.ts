import { test } from "node:test";
import assert from "node:assert/strict";
import { freshState } from "./data";
import {
  buildSupplyGraph,
  traceNetwork,
  supplierImpact,
  proposalFor,
} from "./supplyNetwork";
import { proposeTransfer } from "./planning";
import { opportunities } from "./data";
test("all network links resolve to entities and preserve their SKU relationship", () => {
  const graph = buildSupplyGraph(freshState());
  const ids = new Set(graph.nodes.map((n) => n.id));
  for (const edge of graph.edges) {
    assert.ok(ids.has(edge.from));
    assert.ok(ids.has(edge.to));
    const a = graph.nodes.find((n) => n.id === edge.from)!,
      b = graph.nodes.find((n) => n.id === edge.to)!;
    for (const sku of edge.skus) {
      assert.ok(a.skus.includes(sku));
      assert.ok(b.skus.includes(sku));
    }
  }
});
test("supplier tracing cannot leak unrelated products through a shared distribution center", () => {
  const g = buildSupplyGraph(freshState());
  const traced = traceNetwork(g, "supplier:Pacific Apparel Co.");
  assert.equal(traced.skus.size, 3);
  assert.ok(traced.nodes.some((n) => n.name === "Vancouver Downtown"));
  assert.ok(!traced.nodes.some((n) => n.id === "product:CSJ-IND-30"));
  assert.ok(!traced.nodes.some((n) => n.name === "Denim Works"));
  const filtered = traceNetwork(g, "supplier:Pacific Apparel Co.", "ERT-CRM-M");
  assert.equal(filtered.skus.size, 1);
  assert.ok(filtered.nodes.some((n) => n.kind === "online"));
});
test("delay scenarios calculate incremental exposure without mutating inventory", () => {
  const s = freshState();
  const before = JSON.stringify(s);
  const baseline = supplierImpact("Pacific Apparel Co.", s, 0);
  const delayed = supplierImpact("Pacific Apparel Co.", s, 10);
  assert.equal(baseline.additionalLoss, 0);
  assert.ok(delayed.additionalLoss > 0);
  assert.equal(baseline.currentLoss, delayed.currentLoss);
  assert.equal(delayed.rows[0].lead, 31);
  assert.equal(JSON.stringify(s), before);
});
test("network responses respect stock already committed to proposals", () => {
  let s = freshState();
  assert.equal(proposalFor(opportunities[0], s).quantity, 40);
  s = proposeTransfer(s, "OPP-1042-source", "OPP-1042-dest", 40);
  assert.equal(proposalFor(opportunities[0], s).quantity, 0);
  const g = buildSupplyGraph(s);
  assert.ok(
    g.edges.some(
      (e) => e.kind === "transfer" && e.label === "40 units · Proposed",
    ),
  );
});
