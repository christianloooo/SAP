import { test } from "node:test";
import assert from "node:assert/strict";
import { freshState } from "./data";
import {
  resources,
  defaultShortage,
  simulateResourceShortage,
  rateKey,
  resourceSkus,
} from "./resources";
import { simulateCascade } from "./cascade";
import { buildSupplyGraph, focusNetwork } from "./supplyNetwork";
import { answerQuestion } from "./assistant";

test("input price uplift is incremental, margin uses retail revenue, and gross profit reconciles", () => {
  const state = freshState(),
    before = JSON.stringify(state);
  const r = simulateResourceShortage(state, {
    ...defaultShortage,
    resource: "cotton",
    shortagePercent: 0,
    priceIncreasePercent: 20,
  });
  const cream = r.rows.find((r) => r.o.sku === "ERT-CRM-M")!;
  assert.ok(Math.abs(cream.addedPerUnit - 1.15 * 5.4 * 0.2) < 1e-10);
  assert.equal(cream.baseCost, 13.5);
  assert.ok(Math.abs(cream.scenarioCost - (13.5 + 1.15 * 5.4 * 0.2)) < 1e-10);
  assert.ok(
    Math.abs(
      cream.baseMargin - cream.scenarioMargin - (cream.addedPerUnit / 39) * 100,
    ) < 1e-10,
  );
  assert.ok(
    Math.abs(r.profitReduction - r.addedCost - r.deferredProfit) < 1e-8,
  );
  assert.equal(JSON.stringify(state), before);
});
test("zero shock preserves costs; full shortage has no completed-unit margin or input spend", () => {
  const zero = simulateResourceShortage(freshState(), {
    ...defaultShortage,
    shortagePercent: 0,
    priceIncreasePercent: 0,
    delayDays: 0,
  });
  assert.equal(zero.profitReduction, 0);
  assert.equal(zero.marginDrop, 0);
  const full = simulateResourceShortage(freshState(), {
    ...defaultShortage,
    shortagePercent: 100,
  });
  assert.equal(full.scenarioMargin, null);
  assert.equal(full.addedCost, 0);
  assert.equal(full.deferred, full.units);
  for (const value of [NaN, -1, 101])
    assert.throws(() =>
      simulateResourceShortage(freshState(), {
        ...defaultShortage,
        shortagePercent: value,
      }),
    );
});
test("edited purchase rates feed exact SKU costs and zero pass-through protects unit margin", () => {
  const cotton = resources.find((r) => r.id === "cotton")!,
    primary = cotton.contracts[0];
  const r = simulateResourceShortage(
    freshState(),
    { ...defaultShortage, resource: "cotton", shortagePercent: 0 },
    { [rateKey(cotton, primary)]: 10 },
  );
  assert.equal(r.rows.find((r) => r.o.sku === "ERT-CRM-M")!.rate, 10);
  assert.ok(
    Math.abs(
      r.rows.find((r) => r.o.sku === "ERT-CRM-M")!.baseCost -
        (13.5 + 1.15 * (10 - 5.4)),
    ) < 1e-10,
  );
  assert.equal(r.rows.find((r) => r.o.sku === "CSJ-IND-30")!.rate, 6.2);
  const absorbed = simulateResourceShortage(freshState(), {
    ...defaultShortage,
    shortagePercent: 0,
    passThroughPercent: 0,
  });
  assert.equal(absorbed.marginDrop, 0);
  assert.equal(absorbed.addedCost, 0);
  const shortageWithoutPassThrough = simulateResourceShortage(freshState(), {
    ...defaultShortage,
    passThroughPercent: 0,
  });
  assert.ok(Math.abs(shortageWithoutPassThrough.marginDrop!) < 1e-10);
});
test("material graph has exactly the eligible prominent cotton suppliers and fuel facility paths", () => {
  const g = buildSupplyGraph(freshState());
  const cotton = focusNetwork(
    g,
    "material:cotton",
    "All products",
    "downstream",
  );
  assert.deepEqual(
    cotton.nodes
      .filter((n) => n.kind === "supplier")
      .map((n) => n.name)
      .sort(),
    [
      "Coastal Textiles · Alternative",
      "Denim Works",
      "Pacific Apparel Co.",
    ].sort(),
  );
  const fuel = focusNetwork(g, "material:diesel", "All products", "downstream");
  assert.equal(fuel.skus.size, 6);
  assert.ok(fuel.nodes.some((n) => n.kind === "online"));
});
test("input shortage reduces and delays only affected replenishment and preserves daily stock conservation", () => {
  const state = freshState();
  const c = {
    supplier: "Pacific Apparel Co.",
    delayDays: 0,
    horizon: 45,
    demandPercent: 100,
    inboundWeeks: 4,
    response: "none" as const,
    sku: "All products",
  };
  const normal = simulateCascade(state, c);
  const shocked = simulateCascade(state, {
    ...c,
    resourceShock: {
      skus: resourceSkus(resources.find((r) => r.id === "cotton")!),
      supplyPercent: 75,
      delayDays: 7,
    },
  });
  const receipt = shocked.events.find(
    (e) => e.kind === "supplier-arrival" && e.sku === "ERT-CRM-M",
  )!;
  assert.equal(receipt.day, 28);
  assert.equal(receipt.quantity, 240);
  assert.deepEqual(
    shocked.events.filter((e) => e.sku === "MCR-NVY-L"),
    normal.events.filter((e) => e.sku === "MCR-NVY-L"),
  );
  for (const day of shocked.days)
    assert.ok(
      Math.abs(
        day.physicalStock +
          day.inTransit +
          day.fulfilled -
          shocked.initialUnits -
          day.supplierReceipts,
      ) < 1e-5,
    );
});
test("Joule uses applied fuel costs and clearly separates margin from deferred production", () => {
  const state = freshState();
  const answer = answerQuestion(
    "Explain shortage cost and margin impact",
    state,
    {
      name: "Diesel",
      skus: resourceSkus(resources.find((r) => r.id === "diesel")!),
      nodeId: "material:diesel",
      shortage: defaultShortage,
    },
  );
  const expected = simulateResourceShortage(state, defaultShortage);
  assert.match(answer.summary, /25% supply reduction/);
  assert.ok(answer.summary.includes(expected.baseMargin.toFixed(2)));
  assert.ok(answer.evidence.join(" ").includes("0.8 litre"));
  assert.ok(
    answer.evidence
      .join(" ")
      .includes("not assume those deferred sales are permanently lost"),
  );
});
