import { test } from "node:test";
import assert from "node:assert/strict";
import { freshState } from "./data";
import { simulateCascade, cascadeNodeState } from "./cascade";
import type { CascadeConfig } from "./cascade";
import { proposeTransfer, advanceTransfer } from "./planning";
const config: CascadeConfig = {
  supplier: "Pacific Apparel Co.",
  delayDays: 10,
  horizon: 45,
  demandPercent: 100,
  inboundWeeks: 4,
  response: "none",
  sku: "All products",
};
test("delays shift the correct inbound receipts and propagate later shortages without changing unrelated SKUs", () => {
  const s = freshState(),
    before = JSON.stringify(s);
  const baseline = simulateCascade(s, { ...config, delayDays: 0 });
  const delayed = simulateCascade(s, config);
  assert.equal(
    baseline.events.find(
      (e) => e.kind === "supplier-arrival" && e.sku === "ERT-CRM-M",
    )!.day,
    21,
  );
  assert.equal(
    delayed.events.find(
      (e) => e.kind === "supplier-arrival" && e.sku === "ERT-CRM-M",
    )!.day,
    31,
  );
  assert.equal(
    baseline.days[22].records.find((r) => r.id === "OPP-1042-dest")!.unmet > 0,
    true,
  );
  assert.equal(
    baseline.days[23].records.find((r) => r.id === "OPP-1042-dest")!.unmet,
    0,
  );
  assert.ok(
    delayed.days[23].records.find((r) => r.id === "OPP-1042-dest")!.unmet > 0,
  );
  assert.ok(delayed.days[30].cumulativeLoss > baseline.days[30].cumulativeLoss);
  for (let day = 0; day <= 45; day++)
    assert.deepEqual(
      delayed.days[day].records.filter((r) => r.sku === "CSJ-IND-30"),
      baseline.days[day].records.filter((r) => r.sku === "CSJ-IND-30"),
    );
  assert.equal(JSON.stringify(s), before);
});
test("daily mass balance includes sales, supplier receipts and transit, with no negative stock", () => {
  for (const response of ["none", "rebalance", "alternative"] as const) {
    const run = simulateCascade(freshState(), { ...config, response });
    for (const d of run.days) {
      assert.ok(
        Math.abs(
          d.physicalStock +
            d.inTransit +
            d.fulfilled -
            run.initialUnits -
            d.supplierReceipts,
        ) < 1e-5,
        `Stock conservation failed on day ${d.day}`,
      );
      assert.ok(d.records.every((r) => r.stock >= -1e-8));
    }
  }
});
test("response transfers arrive after transit rather than instantly and additional supplier supply reaches downstream locations later", () => {
  const no = simulateCascade(freshState(), config),
    response = simulateCascade(freshState(), {
      ...config,
      response: "rebalance",
    });
  assert.equal(response.responseTransfers[0].arrivalDay, 3);
  assert.equal(
    response.days[1].records.find((r) => r.id === "OPP-1042-dest")!.stock,
    no.days[1].records.find((r) => r.id === "OPP-1042-dest")!.stock,
  );
  assert.ok(
    response.days[3].records.find((r) => r.id === "OPP-1042-dest")!.stock >
      no.days[3].records.find((r) => r.id === "OPP-1042-dest")!.stock,
  );
  const alt = simulateCascade(freshState(), {
    ...config,
    response: "alternative",
  });
  assert.equal(
    alt.events.find(
      (e) => e.kind === "supplier-arrival" && e.from?.startsWith("Coastal"),
    )!.day,
    9,
  );
  assert.ok(
    alt.events.some(
      (e) =>
        e.kind === "receipt" &&
        e.location === "Vancouver Downtown" &&
        e.day === 11,
    ),
  );
});
test("existing commitments cannot be double allocated and in-transit inventory is counted once", () => {
  let s = proposeTransfer(freshState(), "OPP-1042-source", "OPP-1042-dest", 40);
  assert.ok(
    !simulateCascade(s, {
      ...config,
      response: "rebalance",
    }).responseTransfers.some((t) => t.sku === "ERT-CRM-M"),
  );
  s = advanceTransfer(s, s.transfers[0].id, "Approved");
  s = advanceTransfer(s, s.transfers[0].id, "In transit");
  const run = simulateCascade(s, config);
  assert.equal(run.days[0].inTransit, 40);
  assert.equal(
    run.events.find((e) => e.kind === "receipt" && e.quantity === 40)!.day,
    2,
  );
  assert.ok(
    Math.abs(
      run.days[2].physicalStock +
        run.days[2].inTransit +
        run.days[2].fulfilled -
        run.initialUnits -
        run.days[2].supplierReceipts,
    ) < 1e-5,
  );
});
test("graph node summaries report projected shortages and warehouse dispatch constraints", () => {
  const run = simulateCascade(freshState(), config);
  const n = cascadeNodeState(
    run,
    1,
    { id: "location:Vancouver Downtown", kind: "store", skus: ["ERT-CRM-M"] },
    config.supplier,
    10,
  );
  assert.equal(n.risk, true);
  assert.equal(n.first, 1);
  assert.match(n.detail, /SHORTAGE/);
  assert.throws(() =>
    simulateCascade(freshState(), { ...config, horizon: NaN }),
  );
});
