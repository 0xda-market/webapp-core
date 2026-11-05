export class FakeElement {
  constructor(tagName = "div") {
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.listeners = new Map();
    this.attributes = {};
    this.dataset = {};
    this.textContent = "";
    this.value = "";
    this.checked = false;
    this.disabled = false;
    this.hidden = false;
  }

  append(...nodes) { this.children.push(...nodes); }
  prepend(...nodes) { this.children.unshift(...nodes); }
  before(...nodes) { this.beforeNodes = [...(this.beforeNodes || []), ...nodes]; }
  add(node) { this.append(node); }
  replaceChildren(...nodes) { this.children = [...nodes]; }
  setAttribute(key, value) { this.attributes[key] = String(value); }
  addEventListener(type, callback) { this.listeners.set(type, callback); }
  dispatch(type, event = {}) { return this.listeners.get(type)?.({ currentTarget: this, preventDefault() {}, ...event }); }
  showModal() { this.open = true; }
  close() { this.open = false; }
  reset() { this.value = ""; this.checked = false; for (const child of this.children) child.reset?.(); }
}

export function marketDocument() {
  const ids = [
    "checkout-action", "category", "close-dialog", "checkout-dialog", "dialog-category", "dialog-name",
    "dialog-price", "dialog-status", "home", "next", "previous", "products", "search", "snapshot", "status"
  ];
  const elements = Object.fromEntries(ids.map((id) => [id, new FakeElement(id === "category" ? "select" : "div")]));
  elements["checkout-action"].before = (...nodes) => elements["checkout-dialog"].append(...nodes);
  const main = new FakeElement("main");
  const body = new FakeElement("body");
  return {
    elements,
    main,
    body,
    createElement(tag) { return new FakeElement(tag); },
    querySelector(selector) {
      if (selector === "main") return main;
      if (selector.startsWith("#")) return elements[selector.slice(1)] || null;
      return null;
    }
  };
}

export function bootstrapDocument({ role = "broker", subject = "subject-a", environment = "development", count = 2 } = {}) {
  return {
    data: Array.from({ length: count }, (_, index) => ({
      type: "product",
      id: `product_${index + 1}`,
      attributes: {
        name: `Product ${index + 1}`,
        button_label: `Product ${index + 1}`,
        metadata: { category: index % 2 ? "crypto" : "digital" },
        price: { amount: String(index + 1), currency: "USDT" }
      }
    })),
    meta: {
      schema_version: 1,
      snapshot_id: "snapshot-1",
      generated_at: "2026-08-01T12:00:00Z",
      complete: true,
      pagination: "client",
      currency: "USDT",
      locale: "uk_UA",
      session: { role, status: "active", subject, environment },
      currencies: [
        { type: "currency", id: "usdt", attributes: { code: "USDT" } },
        { type: "currency", id: "uah", attributes: { short_name: "UAH" } }
      ]
    }
  };
}
