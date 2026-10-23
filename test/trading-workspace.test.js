import test from "node:test";
import assert from "node:assert/strict";
import { parseReplayEvents } from "../src/trading-workspace.js";

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
