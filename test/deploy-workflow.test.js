// © 2026 aiaiaiai · aiaiaiai.org
// SPDX-License-Identifier: MIT
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const workflow = readFileSync(
  new URL("../.github/workflows/deploy-development.yml", import.meta.url),
  "utf8"
);
const ci = readFileSync(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8");

test("deployment is manual, master-only and exact-head CI gated", () => {
  const triggers = workflow.split("\npermissions:", 1)[0];
  assert.match(triggers, /^  workflow_dispatch:/m);
  assert.doesNotMatch(triggers, /^  (pull_request|push|schedule):/m);
  assert.match(workflow, /refs\/heads\/master/);
  assert.match(workflow, /head_sha=\$GITHUB_SHA/);
  assert.match(workflow, /\.event == "push"/);
  assert.match(ci, /  push:\n    branches: \[master\]/);
});

test("deployment produces immutable GHCR image and delegates activation to infra", () => {
  assert.match(workflow, /docker\/build-push-action@v6/);
  assert.match(workflow, /webapp-core@\$DIGEST/);
  assert.match(workflow, /market-webapp-development/);
  assert.match(workflow, /secrets.INFRA_DEPLOY_TOKEN/);
  assert.match(workflow, /deploy-workload/);
  assert.match(workflow, /conclusion.*success/);
  assert.doesNotMatch(workflow, /SSH_(HOST|USER|PRIVATE_KEY|PORT|DEPLOYMENT_PATH)/);
  assert.doesNotMatch(workflow, /\bscp\b|\bssh\s+-/);
});

test("all WebApp runtimes agree on canonical isolated test port", () => {
  for (const file of ["../Dockerfile", "../deploy/nginx.conf", "../deploy/compose.yaml", "../deploy/deploy.sh"]) {
    const source = readFileSync(new URL(file, import.meta.url), "utf8");
    assert.match(source, /1703/);
    assert.doesNotMatch(source, /8080/);
  }
});
