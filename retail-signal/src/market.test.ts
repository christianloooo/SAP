import { test } from "node:test";
import assert from "node:assert/strict";
// @ts-expect-error Server-only module is intentionally outside the browser TypeScript project.
import { parseFredObservation } from "../server/market.mjs";
test("market parser preserves official date, period and numeric units without inventing a quote", () => {
  assert.deepEqual(
    parseFredObservation(
      '<p>2026-10-19: <span class="series-meta-observation-value">6.276</span></p>',
    ),
    { period: "2026-10-19", value: 6.276 },
  );
  assert.deepEqual(
    parseFredObservation(
      '<p>Sep 2026: <span class="series-meta-observation-value">1,482.37192</span></p>',
    ),
    { period: "Sep 2026", value: 1482.37192 },
  );
  assert.throws(() => parseFredObservation("<html>Access denied</html>"));
});
