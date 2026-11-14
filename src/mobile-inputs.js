// © 2026 aiaiaiai · aiaiaiai.org
// SPDX-License-Identifier: MIT

const TEXT_FIELD_SELECTOR = [
  'input:not([type="button"]):not([type="checkbox"]):not([type="hidden"]):not([type="radio"]):not([type="reset"]):not([type="submit"])',
  "textarea"
].join(", ");
const CONFIRMATION_CONTROL_SELECTOR = "[data-mobile-input-confirm]";

const mountedDocuments = new WeakMap();

function isTextField(node) {
  return typeof node?.matches === "function" && node.matches(TEXT_FIELD_SELECTOR);
}

function viewportBounds(viewport) {
  const height = Number(viewport?.height);
  const offsetTop = Number(viewport?.offsetTop || 0);
  if (!Number.isFinite(height) || height <= 0 || !Number.isFinite(offsetTop)) return null;
  return { top: offsetTop, bottom: offsetTop + height };
}

function inertController() {
  return Object.freeze({ dispose() {} });
}

export function mountMobileInputVisibility({
  document,
  viewport = globalThis.visualViewport,
  windowTarget = globalThis,
  confirmationControl = document?.querySelector?.(CONFIRMATION_CONTROL_SELECTOR),
  margin = 24
} = {}) {
  if (!document?.addEventListener) return inertController();
  const existing = mountedDocuments.get(document);
  if (existing) return existing;

  let activeField = null;
  let pressedField = null;
  let alignedForFocus = false;
  let scheduled = false;
  const requestFrame = typeof windowTarget?.requestAnimationFrame === "function"
    ? (callback) => windowTarget.requestAnimationFrame(callback)
    : (callback) => callback();

  function setConfirmationVisible(visible) {
    if (confirmationControl) confirmationControl.hidden = !visible;
  }

  function positionConfirmationControl(bounds) {
    if (!confirmationControl?.style) return;
    const fallbackBottom = Number(windowTarget?.innerHeight);
    const bottom = bounds?.bottom || (Number.isFinite(fallbackBottom) && fallbackBottom > 0 ? fallbackBottom : null);
    if (bottom) confirmationControl.style.top = `${Math.round(bottom)}px`;
  }

  function ensureVisible() {
    if (!activeField || alignedForFocus || typeof activeField.getBoundingClientRect !== "function") return;
    const bounds = viewportBounds(viewport);
    if (!bounds) {
      if (typeof activeField.scrollIntoView === "function") {
        alignedForFocus = true;
        activeField.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
      }
      return;
    }

    const rect = activeField.getBoundingClientRect();
    const safeTop = bounds.top + margin;
    const safeBottom = bounds.bottom - margin;
    if (rect.top >= safeTop && rect.bottom <= safeBottom) return;

    const fieldCenter = (rect.top + rect.bottom) / 2;
    const viewportCenter = (bounds.top + bounds.bottom) / 2;
    const top = fieldCenter - viewportCenter;
    if (!Number.isFinite(top) || Math.abs(top) < 1) return;

    if (typeof windowTarget?.scrollBy === "function") {
      alignedForFocus = true;
      windowTarget.scrollBy({ top, left: 0, behavior: "smooth" });
    } else if (typeof activeField.scrollIntoView === "function") {
      alignedForFocus = true;
      activeField.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    }
  }

  function scheduleVisibilityCheck() {
    if (scheduled) return;
    scheduled = true;
    requestFrame(() => {
      scheduled = false;
      positionConfirmationControl(viewportBounds(viewport));
      ensureVisible();
    });
  }

  function handleFocusIn(event) {
    if (!isTextField(event.target)) return;
    if (event.target !== activeField) {
      activeField = event.target;
      pressedField = null;
      alignedForFocus = false;
    }
    setConfirmationVisible(true);
    scheduleVisibilityCheck();
  }

  function handleFocusOut(event) {
    if (event.target !== activeField) return;
    activeField = null;
    alignedForFocus = false;
    setConfirmationVisible(false);
  }

  function preserveFieldFocus(event) {
    // Keep the field even if iOS emits focusout before the confirmation click.
    pressedField = activeField || (isTextField(document.activeElement) ? document.activeElement : null);
    event.preventDefault?.();
  }

  function dismissActiveField() {
    const field = activeField || pressedField || (isTextField(document.activeElement) ? document.activeElement : null);
    activeField = null;
    pressedField = null;
    alignedForFocus = false;
    setConfirmationVisible(false);
    field?.blur?.();
  }

  document.addEventListener("focusin", handleFocusIn);
  document.addEventListener("focusout", handleFocusOut);
  viewport?.addEventListener?.("resize", scheduleVisibilityCheck);
  viewport?.addEventListener?.("scroll", scheduleVisibilityCheck);
  windowTarget?.addEventListener?.("resize", scheduleVisibilityCheck);
  confirmationControl?.addEventListener?.("pointerdown", preserveFieldFocus);
  confirmationControl?.addEventListener?.("mousedown", preserveFieldFocus);
  confirmationControl?.addEventListener?.("click", dismissActiveField);
  setConfirmationVisible(false);

  const controller = Object.freeze({
    dispose() {
      document.removeEventListener?.("focusin", handleFocusIn);
      document.removeEventListener?.("focusout", handleFocusOut);
      viewport?.removeEventListener?.("resize", scheduleVisibilityCheck);
      viewport?.removeEventListener?.("scroll", scheduleVisibilityCheck);
      windowTarget?.removeEventListener?.("resize", scheduleVisibilityCheck);
      confirmationControl?.removeEventListener?.("pointerdown", preserveFieldFocus);
      confirmationControl?.removeEventListener?.("mousedown", preserveFieldFocus);
      confirmationControl?.removeEventListener?.("click", dismissActiveField);
      activeField = null;
      pressedField = null;
      alignedForFocus = false;
      setConfirmationVisible(false);
      mountedDocuments.delete(document);
    }
  });
  mountedDocuments.set(document, controller);
  return controller;
}
