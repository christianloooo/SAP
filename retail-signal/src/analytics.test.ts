import { test } from "node:test";
import assert from "node:assert/strict";
import { freshState, opportunities } from "./data";
import { executeTransfer, simulate } from "./analytics";
test("transfer conserves stock, respects reserves and updates coverage", () => {
  const s = freshState(),
    o = opportunities[0];
  const before = s.inventory.reduce((n, i) => n + i.stock, 0);
  const next = executeTransfer(o, s, 40);
  assert.equal(next.inventory[0].stock, 48);
  assert.equal(next.inventory[1].stock, 36);
  assert.equal(
    next.inventory.reduce((n, i) => n + i.stock, 0),
    before,
  );
  assert.equal(simulate(o, next, "transfer", 40).maximum, 0);
  assert.equal(simulate(o, next, "transfer", 1).valid, false);
  assert.equal(simulate(o, s, "transfer", 40).coverage, 60);
  assert.throws(() => executeTransfer(o, s, 41));
  assert.equal(s.inventory[0].stock, 8);
});
test("supplier arrival outside seven-day window is excluded from demand coverage", () => {
  const r = simulate(opportunities[0], freshState(), "replenish", 120);
  assert.equal(r.days, 9);
  assert.equal(r.covered, 0);
  assert.equal(r.cost, 1740);
  assert.equal(r.remaining, 72);
});
test("fractional and invalid transfer quantities cannot mutate inventory", () => {
  const s = freshState(),
    o = opportunities[0];
  for (const qty of [1.5, -1, 0, NaN, Infinity])
    assert.throws(() => executeTransfer(o, s, qty));
});
