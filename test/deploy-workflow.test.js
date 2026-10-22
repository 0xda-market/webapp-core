import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const workflow = readFileSync(
  new URL("../.github/workflows/deploy-development.yml", import.meta.url),
  "utf8"
);

test("deployment requires explicit workflow dispatch, never a PR merge", () => {
  const triggers = workflow.split("\npermissions:", 1)[0];
  assert.match(triggers, /^  workflow_dispatch:/m);
  assert.doesNotMatch(triggers, /^  (pull_request|push|schedule):/m);
  assert.doesNotMatch(workflow, /github\.event\.pull_request/);
});

test("both scp and ssh use only the configured private key", () => {
  for (const command of ["scp", "ssh"]) {
    const line = workflow.split("\n").find((item) => item.trim().startsWith(command + " -i "));
    assert.ok(line, `missing explicit ${command} identity`);
    assert.match(line, /-i "\$HOME\/\.ssh\/id_ed25519"/);
    assert.match(line, /-o IdentitiesOnly=yes/);
    assert.match(line, /-o IdentityAgent=none/);
    assert.match(line, /-o BatchMode=yes/);
    assert.match(line, /"\$SSH_PORT"/);
  }
});

test("deployment port follows environment variables with legacy fallback", () => {
  assert.match(workflow, /SSH_PORT: \$\{\{ vars\.SSH_PORT \|\| '22022' \}\}/);
});
