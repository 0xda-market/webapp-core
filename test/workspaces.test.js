import test from "node:test";
import assert from "node:assert/strict";
import {
  adminWorkspaceSummary,
  mountAdminWorkspace,
  mountWorkspaceNavigation,
  workspaceSectionsForRole
} from "../src/index.js";
import { FakeElement, bootstrapDocument, marketDocument } from "./helpers.js";

function catalog(role = "admin") {
  const document = bootstrapDocument({ role });
  return {
    products: document.data,
    count: document.data.length
  };
}

test("maps verified roles to the smallest permitted workspace set", () => {
  assert.deepEqual(workspaceSectionsForRole("client"), ["market", "trading"]);
  assert.deepEqual(workspaceSectionsForRole("broker"), ["market", "trading", "listings"]);
  assert.deepEqual(workspaceSectionsForRole("admin"), ["market", "trading", "listings", "admin"]);
  assert.deepEqual(workspaceSectionsForRole("unknown"), ["market", "trading"]);
});

test("summarizes the catalog without mutating it", () => {
  const source = catalog();
  source.products[1].attributes.price = null;
  assert.deepEqual(adminWorkspaceSummary(source), {
    products: 2,
    pricedProducts: 1,
    unpricedProducts: 1
  });
});

test("mounts the admin overview only for an administrator", () => {
  const document = marketDocument();
  const workspace = mountAdminWorkspace({
    document,
    catalog: catalog(),
    session: { role: "admin" }
  });

  assert.ok(workspace);
  assert.equal(document.body.children.at(-1), workspace.root);
  assert.equal(workspace.root.children[0].textContent, "Administration");
  assert.equal(workspace.root.children[2].children.length, 6);
  assert.equal(mountAdminWorkspace({
    document,
    catalog: catalog("broker"),
    session: { role: "broker" }
  }), null);
});

test("navigation exposes only permitted sections and switches visible roots", () => {
  const document = marketDocument();
  const market = new FakeElement("main");
  const listings = new FakeElement("section");
  const admin = new FakeElement("section");
  let feedback = 0;
  const navigation = mountWorkspaceNavigation({
    document,
    session: { role: "admin" },
    sections: [
      { id: "market", label: "Market", root: market },
      { id: "listings", label: "Listings", root: listings },
      { id: "admin", label: "Admin", root: admin }
    ],
    selectionFeedback: () => { feedback += 1; }
  });

  assert.deepEqual(navigation.sections(), ["market", "listings", "admin"]);
  assert.equal(navigation.activeSection(), "market");
  assert.equal(market.hidden, false);
  assert.equal(listings.hidden, true);
  assert.equal(admin.hidden, true);

  navigation.root.children[2].dispatch("click");
  assert.equal(navigation.activeSection(), "admin");
  assert.equal(market.hidden, true);
  assert.equal(admin.hidden, false);
  assert.equal(feedback, 1);
});
