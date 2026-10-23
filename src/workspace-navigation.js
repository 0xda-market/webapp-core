import { createI18n } from "./i18n.js";

const ROLE_SECTIONS = Object.freeze({
  client: Object.freeze(["market", "trading"]),
  broker: Object.freeze(["market", "trading", "listings"]),
  admin: Object.freeze(["market", "trading", "listings", "admin"])
});

const SECTION_ICONS = Object.freeze({
  market: "⌂",
  trading: "↗",
  listings: "≡",
  admin: "◇"
});

function element(document, tag, attributes = {}, text = null) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attributes)) {
    if (key === "className") node.className = value;
    else if (key === "type") node.type = value;
    else node.setAttribute(key, value);
  }
  if (text !== null) node.textContent = text;
  return node;
}

function defaultWorkspaceLabel(entry, i18n) {
  return entry.id === "admin" ? i18n.t("admin.title") : i18n.t(`workspace.${entry.id}`);
}

function workspaceTab(document, entry, i18n) {
  const label = entry.label || defaultWorkspaceLabel(entry, i18n);
  const button = element(document, "button", {
    type: "button",
    className: "workspace-tab",
    role: "tab",
    "data-workspace": entry.id,
    "aria-label": label,
    "aria-selected": "false"
  });
  const icon = element(document, "span", {
    className: "workspace-tab-icon",
    "data-workspace-icon": entry.id,
    "aria-hidden": "true"
  }, SECTION_ICONS[entry.id] || "·");
  const text = element(document, "span", {
    className: "workspace-tab-label"
  }, label);
  button.append(icon, text);
  return button;
}

export function workspaceSectionsForRole(role) {
  return [...(ROLE_SECTIONS[String(role || "client")] || ROLE_SECTIONS.client)];
}

export function mountWorkspaceNavigation({
  document,
  session,
  sections,
  locale = "en_US",
  initialSection = "market",
  selectionFeedback = () => {}
}) {
  if (!document?.createElement) throw new TypeError("document is required");
  if (!Array.isArray(sections)) throw new TypeError("workspace sections are required");

  const i18n = createI18n(locale);
  const allowed = new Set(workspaceSectionsForRole(session?.role));
  const entries = sections.filter((entry) => allowed.has(entry?.id) && entry?.root);
  if (entries.length === 0) throw new TypeError("at least one permitted workspace section is required");

  const root = element(document, "nav", {
    id: "workspace-navigation",
    className: "workspace-navigation",
    role: "tablist",
    "aria-label": i18n.t("workspace.label")
  });
  const buttons = new Map();
  let activeSection = null;

  function select(sectionId, { feedback = true } = {}) {
    const next = entries.find((entry) => entry.id === sectionId);
    if (!next) throw new RangeError(`workspace section is unavailable: ${sectionId}`);

    activeSection = next.id;
    for (const entry of entries) entry.root.hidden = entry.id !== activeSection;
    for (const [id, button] of buttons) button.setAttribute("aria-selected", String(id === activeSection));
    if (feedback) selectionFeedback();
    return activeSection;
  }

  for (const entry of entries) {
    const button = workspaceTab(document, entry, i18n);
    button.addEventListener("click", () => select(entry.id));
    buttons.set(entry.id, button);
    root.append(button);
  }

  (document.body || document.querySelector("main")).append(root);
  const requestedInitial = entries.some((entry) => entry.id === initialSection) ? initialSection : entries[0].id;
  select(requestedInitial, { feedback: false });

  return {
    root,
    select,
    activeSection: () => activeSection,
    sections: () => entries.map((entry) => entry.id)
  };
}
