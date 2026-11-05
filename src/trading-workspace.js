// © 2026 aiaiaiai · aiaiaiai.org
// SPDX-License-Identifier: MIT

const COPY = Object.freeze({
  en: Object.freeze({
    title: "Trading Lab", description: "Paper simulation only. No funds or exchange orders.",
    events: "Historical event stream (JSONL)", sample: "Load synthetic example",
    startingCash: "Initial USDT", tradeNotional: "Trade USDT", fee: "Fee (bps)",
    slippage: "Slippage (bps)", allocation: "Max allocation", submit: "Run simulation",
    pending: "Running simulation…", equity: "Paper equity", pnl: "Net PnL",
    realized: "Realized PnL", fills: "Fills", rejects: "Rejected", hint: "Every signal fills only on a later quote, never retrospectively.",
    leaders: "OKX lead traders", leadersHint: "Public OKX ranking for research. Past 90-day results are survivorship-biased and are not a recommendation to copy anyone.",
    sort: "Sort by", minLeadDays: "Minimum track record", anyDays: "Any", dayForms: { one: "day", other: "days" }, load: "Load ranking", loading: "Loading ranking…",
    sorts: { pnl_ratio: "90-day return", pnl: "90-day PnL", win_ratio: "Win ratio", aum: "Assets under management", overview: "OKX overview" },
    ret90: "90-day return", pnl90: "90-day PnL", winRatio: "Win ratio", leadDays: "Leading for", copiers: "Copiers",
    capacity: "has free slots (copying availability unknown)", full: "no free slots", capacityUnknown: "free slots unknown", snapshot: "OKX snapshot", empty: "No traders match these filters."
  }),
  uk: Object.freeze({
    title: "Trading Lab", description: "Лише симуляція. Без реальних коштів чи угод на біржі.",
    events: "Історичні події (JSONL)", sample: "Завантажити демонстраційний приклад",
    startingCash: "Стартові USDT", tradeNotional: "Обсяг угоди, USDT", fee: "Комісія (bps)",
    slippage: "Прослизання (bps)", allocation: "Макс. частка", submit: "Запустити симуляцію",
    pending: "Обчислення…", equity: "Умовний баланс", pnl: "Чистий PnL",
    realized: "Реалізований PnL", fills: "Виконано", rejects: "Відхилено", hint: "Сигнал виконується лише за наступною котировкою, не заднім числом.",
    leaders: "Лідери OKX", leadersHint: "Публічний рейтинг OKX для дослідження. Результати за 90 днів мають ефект виживання й не є порадою когось копіювати.",
    sort: "Сортувати за", minLeadDays: "Мінімальний стаж", anyDays: "Будь-який", dayForms: { one: "день", few: "дні", many: "днів", other: "дня" }, load: "Завантажити рейтинг", loading: "Завантаження рейтингу…",
    sorts: { pnl_ratio: "Дохідність за 90 днів", pnl: "PnL за 90 днів", win_ratio: "Частка прибуткових", aum: "Активи в управлінні", overview: "Огляд OKX" },
    ret90: "Дохідність за 90 днів", pnl90: "PnL за 90 днів", winRatio: "Частка прибуткових", leadDays: "Веде угоди", copiers: "Копіювальники",
    capacity: "є вільні місця (чи відкрите копіювання — невідомо)", full: "вільних місць немає", capacityUnknown: "наявність місць невідома", snapshot: "Знімок OKX", empty: "Немає трейдерів за цими фільтрами."
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

const SORTS = Object.freeze(["pnl_ratio", "pnl", "win_ratio", "aum", "overview"]);
const LEAD_DAYS = Object.freeze(["", "7", "30", "90", "180"]);
const DECIMAL = /^-?\d+(\.\d+)?$/;

// Read-only leaderboard query; the bot and Trading Lab validate it again.
export function leaderQuery({ sort = "pnl_ratio", minLeadDays = "", limit = 20 } = {}) {
  if (!SORTS.includes(sort)) throw new RangeError("Unsupported sort");
  if (!LEAD_DAYS.includes(String(minLeadDays))) throw new RangeError("Unsupported minimum track record");
  if (!Number.isInteger(limit) || limit < 1 || limit > 20) throw new RangeError("Limit must be between 1 and 20");
  const query = { sort, limit: String(limit) };
  if (minLeadDays !== "") query.min_lead_days = String(minLeadDays);
  return query;
}

// Rounds a decimal string half away from zero to `places` decimals using BigInt, never floats.
// `shift` multiplies by 10^shift first (2 turns a ratio into percent). Returns null for non-decimal input.
function roundDecimal(value, places, shift = 0) {
  const text = String(value ?? "");
  if (!DECIMAL.test(text)) return null;
  const negative = text.startsWith("-");
  const [whole, fraction = ""] = text.replace("-", "").split(".");
  const scale = fraction.length - shift;
  let units = BigInt(`${whole}${fraction}`);
  if (scale > places) {
    const divisor = 10n ** BigInt(scale - places);
    units = (units + divisor / 2n) / divisor;
  } else {
    units *= 10n ** BigInt(places - scale);
  }
  let digits = units.toString().padStart(places + 1, "0");
  let result = places ? `${digits.slice(0, -places)}.${digits.slice(-places)}`.replace(/\.?0+$/, "") : digits;
  if (units === 0n) return "0";
  return negative ? `-${result}` : result;
}

// "1.6898" -> "+168.98%", rounded half away from zero to 2 decimals.
export function formatPercent(ratio) {
  const value = roundDecimal(ratio, 2, 2);
  if (value === null) return "—";
  if (value === "0") return "0%";
  return value.startsWith("-") ? `−${value.slice(1)}%` : `+${value}%`;
}

// Amount rounded half away from zero to 2 decimals; negative zero becomes "0".
export function formatAmount(amount) {
  const value = roundDecimal(amount, 2);
  return value === null ? "—" : value;
}

export function formatDays(count, locale = "en_US") {
  const t = COPY[String(locale).toLowerCase().startsWith("uk") ? "uk" : "en"];
  const form = new Intl.PluralRules(t === COPY.uk ? "uk" : "en").select(count);
  return `${count} ${t.dayForms[form] || t.dayForms.other}`;
}

function capacityText(trader, t) {
  if (trader.has_capacity === true) return t.capacity;
  if (trader.has_capacity === false) return t.full;
  return t.capacityUnknown;
}

function mountLeaderboard(document, transport, t, locale) {
  const section = element(document, "section", null, "trading-leaders");
  section.append(element(document, "h3", t.leaders), element(document, "p", t.leadersHint, "trading-hint"));
  const form = element(document, "form", null, "trading-form");
  const select = (label, values, text) => {
    const field = element(document, "label", label);
    const input = element(document, "select");
    for (const value of values) {
      const option = element(document, "option", text(value));
      option.value = value;
      input.append(option);
    }
    input.value = values[0];
    field.append(input);
    form.append(field);
    return input;
  };
  const sort = select(t.sort, SORTS, (value) => t.sorts[value]);
  const minLeadDays = select(t.minLeadDays, LEAD_DAYS, (value) => (value ? formatDays(Number(value), locale) : t.anyDays));
  const submit = element(document, "button", t.load, "primary-action");
  submit.type = "submit";
  form.append(submit);
  const status = element(document, "p", null, "trading-status");
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  const list = element(document, "ol", null, "trading-leader-list");
  section.append(form, status, list);

  let inFlight = false;
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (inFlight) return;
    inFlight = true;
    submit.disabled = true;
    status.textContent = t.loading;
    list.replaceChildren();
    try {
      // The UI always asks for the first page of 20 (leaderQuery's default limit); hosts may pass a smaller limit.
      const page = await transport.tradingLeaders(leaderQuery({ sort: sort.value, minLeadDays: minLeadDays.value }));
      const traders = Array.isArray(page?.traders) ? page.traders : [];
      for (const trader of traders) {
        const item = element(document, "li", null, "trading-leader");
        item.append(
          element(document, "strong", String(trader.nickname || trader.unique_code || "—")),
          element(document, "p", `${t.ret90}: ${formatPercent(trader.pnl_ratio_90d)} · ${t.pnl90}: ${formatAmount(trader.pnl_90d)} ${trader.margin_currency || "USDT"}`),
          element(document, "p", `${t.winRatio}: ${formatPercent(trader.win_ratio).replace("+", "")} · ${t.leadDays}: ${Number.isInteger(trader.lead_days) ? formatDays(trader.lead_days, locale) : "—"}`),
          element(document, "p", `${t.copiers}: ${trader.copy_traders ?? "—"}/${trader.max_copy_traders ?? "—"} · ${capacityText(trader, t)}`)
        );
        list.append(item);
      }
      status.textContent = traders.length ? `${t.snapshot}: ${String(page.data_version || "—")}` : t.empty;
    } catch (error) {
      // Host transports return user-safe messages (the bot passes only short validation text); shown as text only.
      status.textContent = String(error?.message || error);
    } finally {
      submit.disabled = false;
      inFlight = false;
    }
  });
  return section;
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
  root.append(header);
  if (typeof transport.tradingLeaders === "function") root.append(mountLeaderboard(document, transport, t, locale));
  root.append(form, status, result);

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
