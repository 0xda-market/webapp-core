import test from "node:test";
import assert from "node:assert/strict";
import { parseReplayEvents, mountTradingWorkspace, leaderQuery, formatPercent, formatAmount, formatDays } from "../src/trading-workspace.js";
import { FakeElement } from "./helpers.js";
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


const fakeDocument = { createElement: (tag) => new FakeElement(tag) };
const walk = (node, out = []) => { out.push(node); for (const child of node.children || []) walk(child, out); return out; };
const texts = (node) => walk(node).map((n) => n.textContent).filter(Boolean);

test("leaderboard query is limited to known read-only filters", () => {
  assert.deepEqual(leaderQuery(), { sort: "pnl_ratio", limit: "20" });
  assert.deepEqual(leaderQuery({ sort: "win_ratio", minLeadDays: "90", limit: 5 }), { sort: "win_ratio", limit: "5", min_lead_days: "90" });
  assert.throws(() => leaderQuery({ sort: "luck" }), /sort/);
  assert.throws(() => leaderQuery({ minLeadDays: "14" }), /track record/);
  assert.throws(() => leaderQuery({ limit: 21 }), /Limit/);
});

test("decimal strings are formatted without floating point drift", () => {
  assert.equal(formatPercent("1.6898"), "+168.98%");
  assert.equal(formatPercent("-0.0106"), "−1.06%");
  assert.equal(formatPercent("0.1"), "+10%");
  assert.equal(formatPercent("0"), "0%");
  assert.equal(formatPercent("NaN"), "—");
  assert.equal(formatAmount("48805.1105999999972258"), "48805.11");
  assert.equal(formatAmount("12.0"), "12");
  assert.equal(formatAmount("1e3"), "—");
});

test("decimal formatting rounds half away from zero and normalizes negative zero", () => {
  assert.equal(formatPercent("0.99999"), "+100%");
  assert.equal(formatPercent("0.123449"), "+12.34%");
  assert.equal(formatPercent("0.123450"), "+12.35%");
  assert.equal(formatPercent("-0.123450"), "−12.35%");
  assert.equal(formatPercent("-0.00001"), "0%");
  assert.equal(formatAmount("0.999"), "1");
  assert.equal(formatAmount("48805.115"), "48805.12");
  assert.equal(formatAmount("-12.005"), "-12.01");
  assert.equal(formatAmount("-0.001"), "0");
  assert.equal(formatAmount("-0"), "0");
});

test("lead days use locale plural forms", () => {
  assert.deepEqual([1, 2, 5, 21].map((n) => formatDays(n, "uk_UA")), ["1 день", "2 дні", "5 днів", "21 день"]);
  assert.deepEqual([1, 2, 5, 21].map((n) => formatDays(n, "en_US")), ["1 day", "2 days", "5 days", "21 days"]);
});

test("leaderboard is shown only when the transport supports it", () => {
  const replayOnly = mountTradingWorkspace({ document: fakeDocument, transport: { replayTrading() {} }, locale: "uk_UA" });
  assert.ok(!walk(replayOnly.root).some((node) => node.className === "trading-leaders"));
});

test("leaderboard renders ranked traders as text with honest capacity wording", async () => {
  const calls = [];
  const transport = {
    replayTrading() {},
    async tradingLeaders(query) {
      calls.push(query);
      return {
        data_version: "20261105150001",
        traders: [
          { nickname: "<img src=x onerror=alert(1)>", unique_code: "540D011FDACCB47A", pnl_ratio_90d: "1.6898", pnl_90d: "48805.11",
            margin_currency: "USDT", win_ratio: "0.6957", lead_days: 156, copy_traders: 999, max_copy_traders: 1000, has_capacity: true },
          { unique_code: "381749205163847291", pnl_ratio_90d: "-0.05", pnl_90d: "-12.5", win_ratio: "0.4", lead_days: 30,
            copy_traders: 10, max_copy_traders: 10, has_capacity: false },
          { unique_code: "213E8C92DC61EFAC", pnl_ratio_90d: "0.1", lead_days: 1 }
        ]
      };
    }
  };
  const { root } = mountTradingWorkspace({ document: fakeDocument, transport, locale: "uk_UA" });
  const section = walk(root).find((node) => node.className === "trading-leaders");
  const form = section.children.find((node) => node.tagName === "FORM");
  const [sortSelect, daysSelect] = walk(form).filter((node) => node.tagName === "SELECT");
  sortSelect.value = "win_ratio";
  daysSelect.value = "90";
  await form.dispatch("submit");
  assert.deepEqual(calls, [{ sort: "win_ratio", limit: "20", min_lead_days: "90" }]);
  const items = walk(section).filter((node) => node.className === "trading-leader");
  assert.equal(items.length, 3);
  const first = texts(items[0]).join(" | ");
  assert.match(first, /<img src=x onerror=alert\(1\)>/);
  assert.match(first, /\+168\.98%/);
  assert.match(first, /69\.57%/);
  assert.match(first, /999\/1000 · є вільні місця \(чи відкрите копіювання — невідомо\)/);
  assert.match(texts(items[1]).join(" | "), /381749205163847291.*−5%.*30 днів.*вільних місць немає/);
  assert.match(texts(items[2]).join(" | "), /1 день.*наявність місць невідома/);
  assert.match(first, /156 днів/);
  assert.ok(!walk(section).some((node) => "innerHTML" in node));
  assert.match(texts(section).join(" "), /не є порадою когось копіювати/);
  assert.match(texts(section).join(" "), /Знімок OKX: 20261105150001/);
});

test("leaderboard reports transport errors and allows a retry", async () => {
  let fail = true;
  const transport = { replayTrading() {}, async tradingLeaders() { if (fail) throw new Error("Trading Lab leaderboard is unavailable"); return { traders: [] }; } };
  const { root } = mountTradingWorkspace({ document: fakeDocument, transport, locale: "en_US" });
  const section = walk(root).find((node) => node.className === "trading-leaders");
  const form = section.children.find((node) => node.tagName === "FORM");
  const status = section.children.find((node) => node.className === "trading-status");
  await form.dispatch("submit");
  assert.equal(status.textContent, "Trading Lab leaderboard is unavailable");
  fail = false;
  await form.dispatch("submit");
  assert.equal(status.textContent, "No traders match these filters.");
});
