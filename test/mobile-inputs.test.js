// © 2026 aiaiaiai · aiaiaiai.org
// SPDX-License-Identifier: MIT

import test from "node:test";
import assert from "node:assert/strict";
import { mountMobileInputVisibility } from "../src/index.js";

class EventSource {
  constructor() {
    this.listeners = new Map();
  }

  addEventListener(type, callback) {
    const callbacks = this.listeners.get(type) || new Set();
    callbacks.add(callback);
    this.listeners.set(type, callbacks);
  }

  removeEventListener(type, callback) {
    this.listeners.get(type)?.delete(callback);
  }

  dispatch(type, event = {}) {
    for (const callback of this.listeners.get(type) || []) callback(event);
  }
}

test("centers a focused field after the visual viewport shrinks for a mobile keyboard", () => {
  const document = new EventSource();
  const viewport = Object.assign(new EventSource(), { height: 800, offsetTop: 0 });
  const windowTarget = Object.assign(new EventSource(), {
    requestAnimationFrame(callback) { callback(); },
    scrollBy(options) { this.scrolls.push(options); },
    scrolls: []
  });
  const field = {
    matches(selector) { return selector.includes("input"); },
    getBoundingClientRect() { return { top: 600, bottom: 640 }; }
  };

  const mounted = mountMobileInputVisibility({ document, viewport, windowTarget });
  document.dispatch("focusin", { target: field });
  assert.equal(windowTarget.scrolls.length, 0);

  viewport.height = 400;
  viewport.dispatch("resize");
  assert.deepEqual(windowTarget.scrolls, [{ top: 420, left: 0, behavior: "smooth" }]);

  viewport.height = 300;
  viewport.dispatch("resize");
  viewport.dispatch("scroll");
  document.dispatch("focusin", { target: field });
  assert.equal(windowTarget.scrolls.length, 1, "one alignment per focus even during keyboard animation");

  document.dispatch("focusout", { target: field });
  viewport.dispatch("resize");
  assert.equal(windowTarget.scrolls.length, 1);

  document.dispatch("focusin", { target: field });
  assert.equal(windowTarget.scrolls.length, 2, "explicit new focus is allowed to align again");
  mounted.dispose();
});

test("falls back to scrollIntoView when VisualViewport is unavailable", () => {
  const document = new EventSource();
  const windowTarget = new EventSource();
  const calls = [];
  windowTarget.requestAnimationFrame = (callback) => callback();
  const field = {
    matches(selector) { return selector.includes("textarea"); },
    getBoundingClientRect() { return { top: 500, bottom: 560 }; },
    scrollIntoView(options) { calls.push(options); }
  };

  mountMobileInputVisibility({ document, viewport: null, windowTarget });
  document.dispatch("focusin", { target: field });

  assert.deepEqual(calls, [{ behavior: "smooth", block: "center", inline: "nearest" }]);
});

test("dismisses a focused field from a confirmation control above the keyboard", () => {
  const document = new EventSource();
  const viewport = Object.assign(new EventSource(), { height: 800, offsetTop: 0 });
  const windowTarget = Object.assign(new EventSource(), {
    innerHeight: 800,
    requestAnimationFrame(callback) { callback(); }
  });
  const confirmationControl = Object.assign(new EventSource(), { hidden: true, style: {} });
  let blurCount = 0;
  const field = {
    matches(selector) { return selector.includes("input"); },
    getBoundingClientRect() { return { top: 200, bottom: 240 }; },
    blur() { blurCount += 1; }
  };

  const mounted = mountMobileInputVisibility({
    document,
    viewport,
    windowTarget,
    confirmationControl
  });
  document.dispatch("focusin", { target: field });

  assert.equal(confirmationControl.hidden, false);
  assert.equal(confirmationControl.style.top, "800px");

  viewport.height = 420;
  viewport.dispatch("resize");
  assert.equal(confirmationControl.style.top, "420px");

  let focusPreserved = false;
  confirmationControl.dispatch("pointerdown", { preventDefault() { focusPreserved = true; } });
  assert.equal(focusPreserved, true);

  document.dispatch("focusout", { target: field }); // iOS can emit focusout before click
  confirmationControl.dispatch("click");
  assert.equal(blurCount, 1);
  assert.equal(confirmationControl.hidden, true);

  mounted.dispose();
});

test("confirmation only blurs the selected field, and later inputs can be focused", () => {
  const document = new EventSource();
  const viewport = Object.assign(new EventSource(), { height: 800, offsetTop: 0 });
  const windowTarget = Object.assign(new EventSource(), { requestAnimationFrame(callback) { callback(); } });
  const confirmationControl = Object.assign(new EventSource(), { hidden: true, style: {} });
  const blurs = [];
  const field = (name) => ({
    matches(selector) { return selector.includes("input"); },
    getBoundingClientRect() { return { top: 100, bottom: 140 }; },
    blur() { blurs.push(name); }
  });
  const first = field("first");
  const second = field("second");
  const mounted = mountMobileInputVisibility({ document, viewport, windowTarget, confirmationControl });

  document.dispatch("focusin", { target: first });
  confirmationControl.dispatch("pointerdown", { preventDefault() {} });
  confirmationControl.dispatch("click");
  assert.deepEqual(blurs, ["first"]);
  assert.equal(confirmationControl.hidden, true);

  document.dispatch("focusin", { target: second });
  assert.equal(confirmationControl.hidden, false);
  confirmationControl.dispatch("click");
  assert.deepEqual(blurs, ["first", "second"]);
  assert.equal(confirmationControl.hidden, true);
  mounted.dispose();
});
