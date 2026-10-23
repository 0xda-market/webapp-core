// © 2026 aiaiaiai · aiaiaiai.org
// SPDX-License-Identifier: MIT

const COPY = Object.freeze({
  en: Object.freeze({
    title: "Trading Lab", description: "Paper simulation only. No funds or exchange orders.",
    events: "Historical event stream (JSONL)", sample: "Load synthetic example",
    startingCash: "Initial USDT", tradeNotional: "Trade USDT", fee: "Fee (bps)",
    slippage: "Slippage (bps)", allocation: "Max allocation", submit: "Run simulation",
    pending: "Running simulation…", equity: "Paper equity", pnl: "Net PnL",
    realized: "Realized PnL", fills: "Fills", rejects: "Rejected", hint: "Every signal fills only on a later quote, never retrospectively."
  }),
  uk: Object.freeze({
    title: "Trading Lab", description: "Лише симуляція. Без реальних коштів чи угод на біржі.",
    events: "Історичні події (JSONL)", sample: "Завантажити демонстраційний приклад",
    startingCash: "Стартові USDT", tradeNotional: "Обсяг угоди, USDT", fee: "Комісія (bps)",
    slippage: "Прослизання (bps)", allocation: "Макс. частка", submit: "Запустити симуляцію",
    pending: "Обчислення…", equity: "Умовний баланс", pnl: "Чистий PnL",
    realized: "Реалізований PnL", fills: "Виконано", rejects: "Відхилено", hint: "Сигнал виконується лише за наступною котировкою, не заднім числом."
  })
});
const DEMO = [
  { kind: "signal", id: "demo-buy", source: "demo", symbol: "BTCUSDT", side: "buy", received_at: "2026-10-23T10:00:00+00:00" },
  { kind: "tick", symbol: "BTCUSDT", price: "65000", received_at: "2026-10-23T10:00:01+00:00" },
  { kind: "signal", id: "demo-sell", source: "demo", symbol: "BTCUSDT", side: "sell", received_at: "2026-10-23T10:00:02+00:00" },
  { kind: "tick", symbol: "BTCUSDT", price: "66000", received_at: "2026-10-23T10:00:03+00:00" }
];

export function parseReplayEvents(jsonl) {
  if (typeof jsonl !== "string") throw new TypeError("JSONL must be a string");
  if (new TextEncoder().encode(jsonl).length > 60_000) throw new RangeError("JSONL is too large");
  const lines = jsonl.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length > 500) throw new RangeError("Maximum 500 events");
  return lines.map((line, index) => {
    let event;
    try { event = JSON.parse(line); }
    catch { throw new SyntaxError(`Invalid JSON at line ${index + 1}`); }
    if (!event || Array.isArray(event) || typeof event !== "object") throw new TypeError(`Line ${index + 1} must be an object`);
    return event;
  });
}

function element(document, tag, label, className) {
  const node = document.createElement(tag);
  if (label != null) node.textContent = label;
  if (className) node.className = className;
  return node;
}

export function mountTradingWorkspace({ document, transport, locale = "en_US" }) {
  if (!document?.createElement) throw new TypeError("document is required");
  if (typeof transport?.replayTrading !== "function") return null;
  const t = COPY[String(locale).toLowerCase().startsWith("uk") ? "uk" : "en"];
  const root = element(document, "section", null, "trading-workspace");
  root.hidden = true;
  const header = element(document, "header", null, "trading-header");
  header.append(element(document, "h2", t.title), element(document, "p", t.description));
  const form = element(document, "form", null, "trading-form");
  const dataLabel = element(document, "label", t.events);
  const data = element(document, "textarea");
  data.rows = 9;
  data.required = true;
  data.spellcheck = false;
  data.autocapitalize = "off";
  data.setAttribute("aria-label", t.events);
  dataLabel.append(data);
  const sample = element(document, "button", t.sample);
  sample.type = "button";
  sample.addEventListener("click", () => { data.value = DEMO.map((event) => JSON.stringify(event)).join("\n"); });
  const options = [
    ["starting_cash", t.startingCash, "1000"],
    ["trade_notional", t.tradeNotional, "100"],
    ["fee_bps", t.fee, "10"],
    ["slippage_bps", t.slippage, "5"],
    ["max_allocation", t.allocation, "0.25"]
  ];
  const inputs = Object.fromEntries(options.map(([name, label, value]) => {
    const field = element(document, "label", label);
    const input = element(document, "input");
    input.type = "text";
    input.inputMode = "decimal";
    input.value = value;
    input.required = true;
    field.append(input);
    form.append(field);
    return [name, input];
  }));
  const submit = element(document, "button", t.submit, "primary-action");
  submit.type = "submit";
  const status = element(document, "p", t.hint, "trading-status");
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  const result = element(document, "div", null, "trading-result");
  form.prepend(dataLabel, sample);
  form.append(submit);
  root.append(header, form, status, result);

  let inFlight = false;
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (inFlight) return;
    inFlight = true;
    submit.disabled = true;
    status.textContent = t.pending;
    result.replaceChildren();
    try {
      const events = parseReplayEvents(data.value);
      const opts = Object.fromEntries(Object.entries(inputs).map(([key, input]) => [key, input.value.trim()]));
      const report = await transport.replayTrading({ events, options: opts });
      const fields = [
        [t.equity, report.equity], [t.pnl, report.net_pnl],
        [t.realized, report.realized_pnl], [t.fills, report.fills?.length],
        [t.rejects, report.rejections?.length]
      ];
      for (const [name, value] of fields) {
        const line = element(document, "p", `${name}: ${String(value ?? "—")}`);
        result.append(line);
      }
      status.textContent = t.description;
    } catch (error) {
      status.textContent = String(error?.message || error);
    } finally {
      submit.disabled = false;
      inFlight = false;
    }
  });
  return { root };
}
