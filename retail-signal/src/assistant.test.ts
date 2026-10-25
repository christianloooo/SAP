import { test } from "node:test";
import assert from "node:assert/strict";
import { answerQuestion } from "./assistant";
import { freshState } from "./data";
import { proposeTransfer } from "./planning";
import type { AssistantContext } from "./assistant";
const context: AssistantContext = { name: "Cream M", skus: ["ERT-CRM-M"] };
test("assistant respects explicit quantities and current commitments without changing state", () => {
  const s = freshState(),
    before = JSON.stringify(s);
  const valid = answerQuestion(
    "What happens if we transfer 20 units?",
    s,
    context,
  );
  assert.match(valid.summary, /20-unit transfer.*28 units on receipt/);
  assert.match(valid.evidence.join(" "), /\$30/);
  for (const quantity of [41, -1, 2.5, 0])
    assert.match(
      answerQuestion(`Transfer ${quantity} units`, s, context).summary,
      /not currently feasible/,
    );
  assert.equal(JSON.stringify(s), before);
  const committed = proposeTransfer(s, "OPP-1042-source", "OPP-1042-dest", 40);
  assert.match(
    answerQuestion("Transfer 20 units", committed, context).summary,
    /not currently feasible/,
  );
});
test("assistant does not invent alternative capacity for unrelated products", () => {
  const answer = answerQuestion("Why recommend this response?", freshState(), {
    name: "Denim Works",
    skus: ["CSJ-IND-30"],
  });
  assert.match(answer.evidence.join(" "), /No approved alternative capacity/);
  assert.ok(!answer.evidence.join(" ").includes("Coastal Textiles"));
});
test("delay questions take precedence over transfer words and use captured graph assumptions", () => {
  const answer = answerQuestion(
    "What if our supplier is delayed by 10 days and we transfer stock?",
    freshState(),
    {
      ...context,
      timeline: {
        supplier: "Pacific Apparel Co.",
        delayDays: 0,
        horizon: 45,
        demandPercent: 100,
        inboundWeeks: 4,
        response: "rebalance",
        sku: "ERT-CRM-M",
        day: 23,
        view: "delayed",
      },
    },
  );
  assert.match(answer.summary, /10 additional delay days: by day 23/);
  assert.match(answer.evidence.join(" "), /ERT-CRM-M on day 31/);
  assert.ok(!answer.summary.includes("transfer is feasible"));
});
