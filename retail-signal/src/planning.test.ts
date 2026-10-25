import { test } from "node:test";
import assert from "node:assert/strict";
import { freshState } from "./data";
import {
  proposeTransfer,
  advanceTransfer,
  transferable,
  inTransitUnits,
  onlineDemand,
  salesRisk,
  seasonalProfile,
  candidates,
  stockTransportDraft,
} from "./planning";
const total = (s: ReturnType<typeof freshState>) =>
  s.inventory.reduce((n, i) => n + i.stock, 0) + inTransitUnits(s);
test("proposal commits stock, issue moves it into transit, receipt conserves total stock and restores sellability", () => {
  const original = freshState(),
    sum = total(original);
  let s = proposeTransfer(original, "OPP-1042-source", "OPP-1042-dest", 40);
  const id = s.transfers[0].id;
  assert.equal(s.inventory[0].stock, 8);
  assert.equal(transferable(s, s.inventory[1]), 0);
  assert.equal(total(s), sum);
  assert.throws(() => proposeTransfer(s, "OPP-1042-source", "online-west", 1));
  assert.throws(() => advanceTransfer(s, id, "Received"));
  s = advanceTransfer(s, id, "Approved");
  s = advanceTransfer(s, id, "In transit");
  assert.equal(s.inventory[1].stock, 36);
  assert.equal(s.inventory[0].stock, 8);
  assert.equal(inTransitUnits(s), 40);
  assert.equal(total(s), sum);
  s = advanceTransfer(s, id, "Received");
  assert.equal(s.inventory[0].stock, 48);
  assert.equal(inTransitUnits(s), 0);
  assert.equal(total(s), sum);
  assert.throws(() => advanceTransfer(s, id, "Received"));
  assert.equal(s.transfers[0].events.length, 4);
  assert.equal(original.inventory[0].stock, 8);
});
test("cancelling releases commitments and mismatched SKUs cannot be transferred", () => {
  let s = proposeTransfer(freshState(), "OPP-1042-source", "online-west", 24);
  assert.equal(transferable(s, s.inventory[1]), 16);
  s = advanceTransfer(s, s.transfers[0].id, "Cancelled");
  assert.equal(transferable(s, s.inventory[1]), 40);
  assert.throws(() =>
    proposeTransfer(s, "OPP-1042-source", "OPP-1041-dest", 2),
  );
  assert.throws(() =>
    proposeTransfer(s, "OPP-1042-source", "online-west", 1.5),
  );
});
test("online risk decreases only when goods receipt makes units sellable", () => {
  let s = freshState();
  const getStock = () => s.inventory.find((i) => i.id === "online-west")!.stock;
  assert.equal(onlineDemand(15, 7), 24);
  const before = salesRisk(24, getStock(), 39, 70);
  assert.equal(before.gross, 936);
  assert.equal(Math.round(before.expected), 655);
  s = proposeTransfer(s, "OPP-1042-source", "online-west", 24);
  const id = s.transfers[0].id;
  s = advanceTransfer(s, id, "Approved");
  s = advanceTransfer(s, id, "In transit");
  assert.equal(getStock(), 0);
  s = advanceTransfer(s, id, "Received");
  assert.equal(getStock(), 24);
  assert.equal(salesRisk(24, getStock(), 39, 70).expected, 0);
  assert.equal(
    stockTransportDraft(s.transfers[0], s).body._StockTransportOrderItem[0]
      .Plant,
    "CA04",
  );
});
test("seasonality is calculated from the seeded monthly history, not identical across categories", () => {
  assert.equal(seasonalProfile("Knitwear").peak, "Dec");
  assert.equal(seasonalProfile("Knitwear").bestSeason, "Winter");
  assert.equal(seasonalProfile("Bottoms").bestSeason, "Summer");
  assert.equal(seasonalProfile("Bottoms").peak, "Jul");
  assert.equal(
    candidates(freshState(), "OPP-1042-dest")[0].record.location,
    "Burnaby Metrotown",
  );
  assert.equal(salesRisk(10, 20, 39, 70).expected, 0);
});
