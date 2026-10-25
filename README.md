<p align="center">
  <img src="https://raw.githubusercontent.com/0xda-market/.github/master/profile/assets/0xda-market.gif" alt="0xda-market animated logo" width="256">
</p>

# 0xda-market WebApp Core

Host-agnostic marketplace UI, catalog state and interaction package.

`webapp-core` owns reusable catalog, pagination, checkout, broker listing and shared presentation flows. It does not own authentication, messenger SDKs, signed session payloads, backend APIs or channel deployment entry points.

## Integration

A host imports `mountMarketApp` and supplies:

- `host`: locale, viewport, viewport events and feedback;
- `transport`: bootstrap, checkout and role-specific resource operations;
- `document`: the host browser document.

The catalog and checkout engine is bundled and exported by this repository. A host may still pass a compatible `engine` explicitly for testing or staged migration.

```js
const app = await mountMarketApp({ host, transport, document });
const { catalog, locale, session, currencies } = app.context();
```

`transport.bootstrap()` returns the complete `{ data, meta }` document. Resource operations return their `data` resource. Broker hosts pass the explicit context and transport to `mountBrokerWorkspace`; listings are durable core resources, not browser-local drafts. Users with role `admin` mount the same broker workspace.

Production adapters belong to their channel repositories:

- Telegram: [`0xda-market/telegram-bot`](https://github.com/0xda-market/telegram-bot);
- website/browser: the website host repository;
- future messengers: their integration repositories.

This package contains no `Telegram.WebApp`, `initData`, Telegram endpoint, OAuth or browser-session implementation.

## Mobile form behavior

Every quantity, amount, client-price and catalog-position field uses a native numeric input contract with a decimal or integer mobile keyboard as appropriate. Text identifiers such as SKU and locale remain text fields.

`mountMarketApp` also installs one delegated focus-visibility handler for the complete shared surface. It follows `VisualViewport` resize and scroll events while a field is focused, then centers an obscured field inside the visible viewport as the on-screen keyboard opens. Hosts without `VisualViewport` support fall back to `scrollIntoView`; Telegram-specific viewport state remains outside this package.

A host may expose one `[data-mobile-input-confirm]` button as a keyboard accessory. The shared handler keeps it anchored to the bottom-right edge of the visible viewport while any input or textarea is focused. Activating it only blurs the active field and closes the on-screen keyboard; it never submits a form or starts a transport operation. Copy and visual presentation remain host-owned.

## Marketplace checkout

The buyer selects a product and an explicit quantity. The shared checkout calls:

- `quote({ sku, quantity, locale })`;
- `acceptQuote({ quoteId })`;
- `refreshOrder({ orderId })`.

The backend quote is authoritative for product availability, final client price and inventory reservation. The shared UI preserves the requested quantity throughout quote, acceptance and refresh states, disables quantity changes after reservation, and renders the returned total and expiration. It does not select a broker or calculate supply economics.

Quote acceptance may return an order with `status: "payment_pending"`. The UI renders the authoritative payment amount, currency and expiration from `order.attributes.payment`, keeps the order refreshable and makes no payment-success claim of its own. There is intentionally no browser payment-confirmation transport operation: payment confirmation belongs to a trusted backend or operator adapter.

After trusted confirmation, a refresh may return `accepted`, `pending`, `succeeded` or `failed` according to the provider-neutral fulfillment lifecycle. Inventory remains reserved while payment is pending and becomes sold only when core reports confirmation.

A product may remain in the complete catalog while unavailable. Hosts should preserve the backend `price: null` response so the card remains visible but cannot start checkout when no eligible broker liquidity exists.

## Localization

The shared WebApp owns all reusable interface copy. It currently ships complete `en_US` and `uk_UA` presentation for:

- market loading, search, categories, pagination and quantity-aware checkout;
- payment-pending checkout state and authoritative payment terms;
- broker listings and inventory balances;
- allocated broker orders and their lifecycle steps;
- role navigation;
- administration overview;
- product creation, editing and localization;
- revisioned price administration.

`host.locale()` is normalized before bootstrap. Ukrainian Telegram language codes such as `uk` and `uk-UA` resolve to `uk_UA`; unsupported locales fall back to `en_US`. Product names continue to come from core product localizations. Stable category identifiers such as `telegram_premium`, `telegram_stars` and `crypto_asset` remain unchanged in transport and storage while `createI18n(...).category(...)` renders human-readable labels.

A host must pass the resolved locale into role-specific workspace mounts. Channel-specific static shell text should be neutral or updated before bootstrap so users do not see an English loading flash.

## Role workspaces

Workspace visibility derives only from the verified session supplied by the host:

| Role | Sections |
| --- | --- |
| `client` | Market, Trading (when the trusted host enables paper simulation) |
| `broker` | Market, Trading (when enabled), Listings |
| `admin` | Market, Trading (when enabled), Listings, Administration |

`mountWorkspaceNavigation` controls section visibility without interpreting channel authentication. `mountAdminWorkspace` composes isolated administrator capabilities rather than creating one privileged catch-all surface.

Administrator editors are ordered as Prices, Products, Add product, then Localizations. Frequent pricing review and catalog maintenance therefore stay ahead of the less common product-creation flow, while localization remains visibly independent from locale-neutral product state.

## Products and localizations

An administrator host may supply:

- `createAdminProduct({ sku, attributes, localization })`;
- `listAdminProducts({ locale })`;
- `updateAdminProduct({ sku, version, attributes })`;
- `saveAdminProductLocalization({ sku, locale, fullName, buttonLabel, version? })`.

`mountAdminCreateProduct` creates one product and its initial localization. The shared controller always submits `status: "inactive"`; activation remains a separate reviewed edit after pricing and broker supply are ready. SKU creation is one-way in this surface and cannot silently mutate an existing product.

`createAdminCatalogController` keeps locale-neutral product versions independent from localization versions. `mountAdminProducts` exposes short name, status, position, marketability, metadata and localized copy. It never edits SKU or price state. Stale writes remain server-defined concurrency errors and are surfaced to the user without browser-side retries.

## Broker listings and inventory

Broker listing transport remains:

- `listBrokerListings()`;
- `createBrokerListing({ sku, quantity, priceAmount, currency })`;
- `updateBrokerListing({ listingId, quantity, priceAmount, currency, version })`;
- `withdrawBrokerListing({ listingId, version })`.

The workspace treats `quantity` as total committed inventory and renders the backend-owned `available_quantity`, `reserved_quantity` and `sold_quantity` balances. It does not derive or mutate those balances locally. Existing hosts that have not yet adopted the extended response remain readable with `available = quantity` and zero reserved/sold balances.

Each listing is one operational card: product and status, supply price, the four balances grouped as the single server-owned equation they are, then the edit and withdraw actions.

## Allocated broker orders

A broker or administrator host may supply:

- `listBrokerOrders()`;
- `acceptBrokerOrder({ orderId, version })`;
- `completeBrokerOrder({ orderId, version })`.

`mountBrokerOrders` presents each allocated order as a lifecycle — requested, accepted, payment, fulfillment, completion — rather than a flat list of buttons. `orderLifecycle(order)` derives those step states from the reported order, order status and payment status; it never advances an order. An action is rendered only where the server contract permits the next transition, so payment confirmation, which belongs to a trusted backend or operator adapter, is shown as the awaited step instead of a disabled control.

## Section markup contract

`webapp-core` owns section structure, field order and row and card composition; hosts own material, layout and motion. [`docs/fluid-markup-contract.md`](docs/fluid-markup-contract.md) is the contract a host may style against: class names, `data-*` state and element order for workspace navigation, the administration rail, price rows, the product editor flow, listing inventory cards and the order lifecycle rail. It changes transport operations, role authorization, write ownership, pending-state behavior and server authority in no way.

## Price proposals, application and history

An administrator host may supply:

- `getAdminPriceProposal({ locale })`;
- `applyAdminPrices({ revision, prices })`;
- `listAdminPriceHistory({ limit })`.

`createAdminPricingController` preserves the proposal revision and submits only fields changed since the proposal loaded. The changed subset is validated and appended as one atomic batch; unchanged or currently unpriced catalog rows do not block it. `mountAdminPrices` saves that batch on the first explicit submit, then reloads the authoritative proposal and append-only history. A concurrent application remains a server-defined `concurrency_conflict`; the browser does not retry or merge stale values.

Every asynchronous write makes its complete owning section inert, exposes `aria-busy=true`, and keeps localized loading copy visible until the transport settles. This applies to checkout POST actions, broker listing mutations, product creation and editing, localization writes, and price application; one pending write cannot be submitted twice or mixed with another action in the same section.

## Payment-aware delivery sequence

The implemented marketplace path is now:

1. administrator creates and localizes an inactive product;
2. administrator reviews activation and applies client pricing;
3. broker publishes finite supply and sees available, reserved and sold balances;
4. client requests a quantity-aware quote backed by a backend reservation;
5. client accepts the quote and receives a `payment_pending` order while inventory stays reserved;
6. a trusted server or operator confirms payment outside browser authority;
7. core commits inventory and starts provider-neutral fulfillment;
8. the client refreshes the same order through pending, success or failure states.

A real payment rail remains a separate adapter. Wallet addresses, payment intents, blockchain or acquiring callbacks, refunds, disputes, settlement and broker payouts must not be inferred or implemented in browser state.

Remaining operational capabilities are delivered separately: user administration, order history, admin-wide listing visibility, manual fulfillment operations, financial ledger, refunds/disputes, then automated settlement.

Each capability must introduce or reuse an explicit provider-neutral core API, a host transport operation and focused UI tests. Provider-specific financial state must not leak into reusable workspaces.

## Repository boundaries

- [`core`](https://github.com/0xda-market/core) owns products, users, roles, currencies, listings, reservations, quotes, orders, pricing, payment state and settlement contracts.
- `webapp-core` owns browser-native state and reusable interaction flows.
- each host owns its SDK, authentication, transport, HTML/CSS shell and deployment.

Hosts must consume an immutable commit or released package version. Mutable default-branch module URLs are not a supported production contract.

## Deployment

`webapp-core` has one **manual development deployment**, implemented by
`.github/workflows/deploy-development.yml`. Its `master` SHA must have a successful
push-triggered Full CI run before the workflow will publish an immutable
`ghcr.io/0xda-market/webapp-core@sha256:…` image. This image is activated
through the `market-webapp-development` workload in
[`aiaiaiai-org/infra`](https://github.com/aiaiaiai-org/infra); the producer
checks the exact infra run's activation/health result.

The `development` GitHub Environment requires a single producer secret:
`INFRA_DEPLOY_TOKEN` (fine-grained access to `aiaiaiai-org/infra`:
**Contents: read/write** for `repository_dispatch`, **Actions: read** for
workflow results/artifacts). VPS `SSH_*` settings belong to infra and
are no longer read from this repository's deployment workflow.

The private nginx service uses the canonical test port `1703` on `nilx-edge`
and alias `market-webapp-development`. It does not add public ingress and is separate
from the Telegram bot's imported shared UI. The Telegram Mini App deliberately
pins a specific `webapp-core` commit in its host adapter; coordinate that pin
before deploying a complete Market stack.

Deployment is never triggered by a PR, merge, or CI completion. Production
activation is not available here.

## Validation

```sh
npm run check
npm test
```

## Paper trading workspace

Hosts with a trusted `replayTrading({ events, options })` transport method can mount `mountTradingWorkspace({ document, transport, locale })` as a `trading` workspace tab for all user roles. The shared UI owns the JSONL input, risk options and paper equity/PnL display; the host owns Telegram authentication and the private RPC to Trading Lab. No exchange order or wallet operation is exposed.
