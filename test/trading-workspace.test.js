import test from "node:test";
import assert from "node:assert/strict";
import { parseReplayEvents } from "../src/trading-workspace.js";
import { createBootstrapContext } from "../src/index.js";
import { createI18n } from "../src/i18n.js";

test("paper replay JSONL parser preserves collection order", () => {
  const events = parseReplayEvents('{"kind":"signal","id":"a"}\n\n{"kind":"tick","price":"100"}');
  assert.deepEqual(events.map((event) => event.kind), ["signal", "tick"]);
});
test("paper replay rejects malformed data and unbounded streams", () => {
  assert.throws(() => parseReplayEvents("{nope}"), /line 1/);
  assert.throws(() => parseReplayEvents("[]"), /must be an object/);
  assert.throws(() => parseReplayEvents("{}\n".repeat(501)), /Maximum 500/);
  assert.throws(() => parseReplayEvents("a".repeat(60001)), /too large/);
});

test("paper trading capability survives the signed bootstrap context only when explicitly enabled", () => {
  const engine = { createCatalogSnapshot: () => [] };
  const context = (flag) => createBootstrapContext({ meta: { session: { role: "client", paper_trading_enabled: flag } } }, engine);
  assert.equal(context(true).session.paper_trading_enabled, true);
  assert.equal(context(false).session.paper_trading_enabled, false);
  assert.equal(context(undefined).session.paper_trading_enabled, false);
  assert.equal(context("true").session.paper_trading_enabled, false);
  assert.equal(createI18n("en_US").t("workspace.trading"), "Trading");
  assert.equal(createI18n("uk_UA").t("workspace.trading"), "Трейдинг");
});
