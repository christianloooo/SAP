# SAP Retail Signal

A working SAP Fiori Morning Horizon competition concept connecting in-store intent, digital demand, inventory and supplier constraints to a coordinated response. All enterprise data and SAP execution are simulated; real basemap tiles are used for location exploration.

## Run and verify

Node.js 22+:

```sh
npm install
npm run dev
```

Production build: `npm run build`. Serve that build with `npx vite preview --port 4173`. Run `npm test` for analytical and workflow invariants. Always browser-test the **production build**, because tree shaking differs from the development server.

## Main experiences

- **Command Center:** opportunity search, location/priority/date filters, KPIs, charts, CSV export, guided demo and demand spike.
- **Opportunity Decision Center:** fitting-room and digital evidence, supplier constraints, what-if comparison, no-action sales exposure and stock transport proposal creation.
- **Location Intelligence:** interactive map, regional focus, product selection, shortage-only view, store/warehouse/online fulfillment pins, source recommendations, reserve-aware quantities and Google Maps directions links.
- **Risk & Seasonality:** no-action versus transfer comparison, configurable 7/14/30-day horizon, lost-sale assumption, online conversion assumption, online availability, risk register and monthly category seasonality.
- **SAP Workflow:** proposal → approval → goods issue → goods receipt. Includes plant/storage/material mappings, document draft export, stage constraints and business event history.
- **Inventory & Supply:** shared stock balances, supplier constraints and dependent opportunities.
- **Action Center:** event audit history across stock and review decisions.
- **Integrations:** demo SAP responsibilities, proposed architecture and official documentation; no credential or tenant setup is required.

## How the three recommendations connect

Fitting-room activity and online interest attach to the same product SKU and location opportunity. Inventory and supplier records determine feasible responses. A planner compares actions, creates a stock transport proposal and follows its execution. Receipt changes stock, coverage, sales exposure and online sellable availability throughout the application.

The opportunity set, demand acceleration and demand scenarios are seeded, not discovered by a live ingestion engine. Calculations are transparent; no statistical AI confidence is claimed.

## SAP products and business workflow

The demo assigns specific responsibilities to existing SAP products:

| Product                          | Implemented demonstration / handoff                                                                                                                                           |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SAP Customer Activity Repository | Seeded omnichannel activity and inventory context. No CAR API connected.                                                                                                      |
| SAP S/4HANA                      | Executable local stock transport lifecycle; supplying/receiving plant, storage location and material mappings; dedicated Stock Transport Order OData V4 mapping draft export. |
| SAP Commerce Cloud               | Online fulfillment sellable stock changes only after goods receipt. The availability view uses the same stock records as other pages. No OCC API connected.                   |
| SAP Integrated Business Planning | Seasonal planning analysis and downloadable monthly demand/seasonal-index handoff. No IBP key figures updated.                                                                |
| SAP BTP / Integration Suite      | Proposed orchestration boundary. Server-side authenticated adapters remain future work.                                                                                       |
| SAP Joule                        | Deterministic contextual assistant substitute; no live Joule connection.                                                                                                      |

`DEMO-STO-*` references are **local proposal identifiers**, never real SAP document numbers. Source commitments prevent double allocation while proposals await execution. Goods issue subtracts source stock and adds an in-transit balance. Goods receipt removes in-transit units and adds destination stock. Cancelling before dispatch releases commitments. Repeated or out-of-order transitions are rejected.

The exported S/4HANA JSON includes a dedicated V4 service path and illustrative UB document type, company code, organization, plants, storage and unit mappings. It is a **mapping draft, not a validated API request**. Validate supported release, document type and organizational/master data in the target tenant. It is not sent by this frontend. Do not substitute a generic Purchase Order API without checking stock transport support.

## Demo map

The map uses OpenStreetMap with Leaflet and requires no API key, billing or connection setup. Facility coordinates and plant codes are illustrative. Map alerts and routes use shared demo stock; this is not GPS shipment tracking. Source selection ranks eligible same-SKU locations by straight-line distance, with reserves and existing commitments excluded. Dashed links are proposed transfer connections, not road geometry or traffic-based travel estimates. Driving directions open separately in Google Maps.

## Scenario formulas

- **Try-on conversion:** purchases / fitting-room interactions × 100.
- **Uncovered demand:** max(0, scenario units − destination on-hand stock).
- **Gross retail exposure:** uncovered units × retail price.
- **Estimated sales foregone:** gross exposure × user-selected lost-sale fraction (default 70%). This fraction represents a scenario assumption about unfulfilled demand that becomes a lost sale.
- **Risk horizon:** seven-day demand scaled linearly by horizon / 7; no additional supply or changing daily demand assumed.
- **Online demand:** floor(162 qualified weekly out-of-stock sessions × conversion assumption × horizon / 7). Default conversion assumption: 15%. Repeat visits are not automatically purchases.
- **Transferable quantity:** source on-hand − protected reserve − quantities committed to Proposed/Approved transfers. In-transit quantities have already left source stock.
- **Coverage:** (destination stock + simulated feasible transfer) / scenario demand, capped at 100%.
- **Transfer cost / lead time:** CAD 1.50/unit; two-day local transit assumption. Map distances are geometric, not priced route calculations.
- **Priority:** seeded Critical/High/Medium category, then a rule-based score using uncovered proportion, demand growth and supplier lead time. No trained ranking model.
- **Seasonal index:** sample monthly units / average monthly units × 100. Best/quietest season uses summed monthly values. Northern Hemisphere winter = Dec/Jan/Feb. One illustrative 2025 year is not statistically reliable historical seasonality.

Store and online scenarios are shown separately. No cross-channel customer identity deduplication is claimed; do not sum channel exposures as a validated overall revenue forecast. Pending incoming transfers do not reduce current stockout risk until receipt, but are excluded when recommending additional quantities.

### Examples

**Store:** Essential Ribbed Top M has 8 units at Vancouver against 80 seven-day scenario units. Burnaby has 76 units with a 36-unit protected reserve, allowing 40 units to transfer. Initial gross exposure is 72 × CAD 39 = CAD 2,808. At the 70% lost-sale assumption, estimated sales foregone is CAD 1,965.60. Receiving 40 units brings Vancouver to 48 and reduces modeled foregone sales to CAD 873.60. Transfer cost: CAD 60.

**Online:** 162 qualified OOS sessions × 15% assumed conversion = 24 modeled purchase units after flooring. With zero online stock, gross exposure is CAD 936 and modeled foregone sales at 70% is CAD 655.20. Receiving 24 units makes the demo online quantity available and reduces this seven-day scenario risk to zero. This is an estimate, not measured recovered sales.

**Seasonality:** the sample knitwear profile peaks in December and is lowest in July; the sample linen/bottoms profile peaks in July. The seasonal analysis does not silently alter the seven-day opportunity demand assumptions.

## Code organization

- `src/data.ts`: shared typed products/opportunities/inventory/audit state and seeded records.
- `src/analytics.ts`: scenario feasibility, coverage, cost, conversion and scoring.
- `src/planning.ts`: geolocations, source candidates, reserve commitments, transfer state machine, risk formulas, seasonal history and S/4HANA draft mapping.
- `src/components/RetailMap.tsx`: Leaflet/OSM risk markers, proposed routes and map error handling.
- `src/components/PlanningViews.tsx`: map workbench, loss scenarios, online fulfillment, seasonality and workflow.
- `src/services/sapAdapters.ts`: future API contracts and example bot/session event qualification helper.
- `src/App.tsx`: application navigation, decision workflow, browser persistence, assistant and existing analytical views.
- `src/*.test.ts`: stock conservation including transit, double-allocation prevention, invalid transitions, reserve protection, online loss calculations and seasonal results.

Demo state persists in localStorage and migrates earlier stock records by ID. Reset restores business data. There is no backend or multi-user transaction consistency.

## Official references

- [SAP Stock Transport Order OData V4 API](https://help.sap.com/docs/SAP_S4HANA_CLOUD/bb9f1469daf04bd894ab2167f8132a1a/807b2c79e22c4ef7a4c30c928bb3344e.html)
- [Stock transport item properties](https://help.sap.com/docs/SAP_S4HANA_CLOUD/bb9f1469daf04bd894ab2167f8132a1a/00599a1898a74e53aa5b76653aae9591.html)
- [SAP Commerce Cloud stock management](https://help.sap.com/docs/SAP_COMMERCE_CLOUD_PUBLIC_CLOUD/7e47d40a176d48ba914b50957d003804/8aef948986691014bd5bbb9f2ecfb33f.html)
- [SAP IBP seasonality curves](https://help.sap.com/docs/SAP_INTEGRATED_BUSINESS_PLANNING/c1fb60cb1e9c49d99ada277ae57e9e6c/3a61edd4126342c1a298594a1df95578.html)
- [SAP Customer Activity Repository](https://help.sap.com/docs/CARAB/e95c8443f589486bbfec99331049704a/95c8fc53f8149438e10000000a44176d.html)
- [SAP Fiori analytical list page](https://experience.sap.com/fiori-design-web/analytical-list-page/)

## Three-minute demonstration

1. Open Location Intelligence. Select Vancouver Downtown / Essential Ribbed Top M. Explain the red shortage pin, no-action risk and 40 available units at Burnaby.
2. Create the proposal. In SAP Workflow, approve it, post demo goods issue and then goods receipt. Show stock held in transit between those steps.
3. Open Risk & Seasonality. Compare the updated no-action exposure with the remaining response options.
4. Reset demo, then propose online replenishment from the Commerce section. Complete its workflow and show online stock moving from 0 to 24 and modeled loss from CAD 655 to CAD 0.
5. Show the sample knitwear and linen seasonal profiles, then export an IBP planning handoff or inspect the S/4HANA mapping draft.

No live SAP transaction, validated demand forecast, actual recovered revenue, production deployment with customer data or measured ROI is claimed.

## Visual supply-chain explorer

Inventory & Supply now opens with an interactive relationship graph: suppliers → product/SKU dependencies → distribution centers → stores and online fulfillment. Select a node to trace connected entities without leaking unrelated SKU dependencies through shared warehouses. Search companies or locations, filter product scope, isolate supplier risks, toggle rebalance links, pan/zoom or expand the network.

The inspector shows affected products, facilities, current scenario exposure and feasible responses. The advanced timeline controls model incremental exposure during an extended lead time, with explicit linear-demand and 70% lost-sale assumptions. It does not modify supplier records. Create reserve-aware transfer proposals directly from the graph, compare the configured alternative supplier, or request a supplier review in Action Center. Proposed/approved/in-transit/received demo transfers appear as separate network links.

This is a light SAP Fiori-style dependency explorer built from the app's shared demo data, not a Bloomberg connection or news feed. Modeled supplier and distribution links are labeled separately from actual demo transfer-order records. The graph model and dependency tracing are in `src/supplyNetwork.ts`; the interface is in `src/components/SupplyNetwork.tsx`.

## Downstream time propagation

The relationship explorer now includes a day-by-day, deterministic supply simulation (`src/cascade.ts`). Use the day slider directly above the graph to see projected stock, shortages and dispatch constraints on each node. Select original supplier timing, delay without additional action, or delay with a response. The controls below the graph add playback, a 30/45/60-day horizon, demand changes, supplier delay and inbound-cover assumptions. The inspector shows first shortage days, future arrivals, recovery events and projected on-hand/incoming stock. Clicking downstream nodes preserves the active disruption scenario.

Each day processes transit receipts, scheduled supplier arrivals, warehouse dispatches, then consumer demand. A single **hypothetical** primary replenishment order of four weeks of original SKU demand is assumed at each supplier's current lead time; the selected supplier's delay shifts only its receipts. Warehouse allocations preserve safety reserves and use a stated destination-store → online → source-store priority. Shipments take two days. Source stores continue selling their own local demand, so rebalancing can shift future risk back to the source. The alternative response adds the configured 120 cream-M units at day 9; it does not invent alternatives for other products. Existing proposed transfers remain reserved, approved transfers dispatch on day 1, and already in-transit quantities arrive on day 2 without being counted twice.

Compare cumulative estimated sales foregone against original supplier timing and against a response. Daily unfulfilled demand is treated as lost rather than backordered; its retail value is multiplied by the explicit 70% lost-sale assumption. Store, source-store and online demand are treated as independent. This is not a validated forecast, and hypothetical inbound orders are not real SAP purchase orders. Seasonality, traffic, promotions and stochastic uncertainty are not applied. Visual risk-only/search filters do not change the simulated product scope. Previewing time and responses never mutates saved business records; creating a proposal still uses today's real demo balances and the existing approval/issue/receipt workflow.

For example, Pacific Apparel's normal modeled warehouse receipt is day 21 and downstream transit takes two further days. A 10-day disruption shifts that receipt to day 31. On day 23, original timing can cover Vancouver's daily demand while the delayed scenario still has unfulfilled demand. The graph shows that distinction and the event trail explains the arrivals and shortages behind it.

Tests verify daily conservation (`physical stock + in transit + cumulative fulfilled demand = starting units + supplier receipts`), nonnegative inventory, isolation of unrelated suppliers/SKUs, delayed downstream receipts, existing commitments and comparison responses.


## Supply intelligence: SPLC-inspired relationship analysis

The network uses Bloomberg SPLC's selected-entity, upstream/downstream relationship exploration as an interaction reference, adapted to apparel operations. It uses our seeded retail records, with no Bloomberg data or Terminal connection. Reference: [Bloomberg's description of SPLC and exposure analysis](https://professional.content.cirrus.bloomberg.com/professional2023/insights/financial-services/integrated-earnings-tools-a-guide-for-equity-analysts-2/).

- Six connected tiers: material inputs → suppliers → production → SKU → distribution → stores / online fulfillment. Shared cotton and trims create cross-product dependencies. Materials and production are illustrative relationships, not verified bills of materials, material stock, or capacity records. Supplier lead times already include production; no additional material or production delays are added to the simulation.
- Select an entity, trace upstream or downstream, isolate its web, search by name/SKU, or inspect direct relationships and follow the next counterparty. Traversal carries the SKU along each path so shared facilities do not invent dependencies on unrelated suppliers.
- Current records are the default graph view. The day slider enables projected colors; the simulator compares original timing, delay without action, and delay with response. Saved records and projections remain separate.
- Connected exceptions show exact inventory gaps, open incoming quantities, conversion differences in percentage points, supplier lead-time warnings, online availability, pending reviews, and active workflow stages. These use the same state as Demand Intelligence, Inventory & Supply, Action Center, and SAP Workflow. Operational exceptions are demo business conditions, not live integration errors.
- Direct relationships retain SKU scope, lead times, available rebalance quantities, transfer stages, and an explicit illustrative label where appropriate. Create a reserve-aware transfer from the inspector, or review the linked opportunity before committing.

### Contextual Joule experience

The persistent **Ask Joule** entry point opens a contextual assistant with evidence, calculations, assumptions, and an opportunity-review action. The network also has **Ask Joule about this network**. Its context follows the selected entity, SKU scope, supplier, graph day, demand multiplier, inbound assumptions, and response. Historical messages retain their original context label.

The assistant is deterministic and has no live SAP Joule or external model connection. It handles explicit transfer quantities (including infeasible and fractional requests), respects existing commitments and reserves, and computes delay answers with the same daily cascade engine as the graph. Alternative capacity is offered only for the modeled cream-M SKU. Explanations never execute transfers or approval steps.

### Focused demonstration (about 2–3 minutes)

1. Open **Inventory & Supply** and expand the network. Select **Cotton yarn** to see shared material dependencies; select **Pacific Apparel Co.** to inspect its production, products and downstream facilities. Try **Upstream dependencies**, then **Upstream + downstream**.
2. Read **Evidence behind the risk**: cream-M has 8 on hand against 80 units of seven-day demand, 17.9% fitting-room conversion against a 32% baseline, and 162 qualified out-of-stock sessions. Distinguish material assumptions from operational records.
3. Move the graph to day 23 with Pacific's additional 10-day delay. Ask Joule about the network, then ask **Supplier delayed by 10 days**. It explains the selected scope, day-31 warehouse receipt, two-day downstream transit, and estimated exposure assumptions.
4. Propose the **40-unit transfer** from Burnaby. In SAP Workflow, approve, issue and receive. Return to the network: Vancouver has 48 units on hand and a 32-unit remaining seven-day gap. Proposing alone never increases sellable stock.

Validation: unit tests cover graph endpoint integrity, multi-tier directional isolation, commitment/receipt exceptions, explicit assistant quantities, SKU-specific alternative capacity, and shared timeline assumptions, in addition to the existing inventory conservation and cascade tests. Run `npm test` (or `node --import tsx --test src/*.test.ts` where CLI IPC sockets are restricted), then `npm run build`. Browser-check the production build with `npx vite preview --host 127.0.0.1 --port 4173`.

## Material procurement and resource shortages

Select **Cotton fabric** in the network to open a supply description, its prominent counterparties, editable **CAD per yard** purchase rates, modeled monthly quantities/spend, and a recent public market reference. Click a counterparty to highlight its network. Cotton shows Pacific Apparel, Denim Works and the approved Coastal alternative; the alternative has no current monthly commitment. Linen, wool and trims have their own physical units and counterparties. Diesel is measured in litres at distribution facilities; natural gas is measured in MMBtu at production suppliers.

Purchase rates, consumption coefficients and monthly procurement quantities are illustrative demo assumptions, not actual invoices. Rate edits persist under `retail-procurement-rates-v1` in localStorage. They adjust the embedded baseline input cost and the incremental shock cost. No private procurement records are sent to market-data providers.

### Public market retrieval

The app automatically retrieves allowlisted public FRED series through `/api/market` when Inventory & Supply mounts; **Refresh market data** checks again. The same endpoint works in Vite development and `vite preview`, with a five-minute server cache and source timeouts. Sources:

- [IMF global raw cotton via FRED](https://fred.stlouisfed.org/series/PCOTTINDUSDM), US cents/lb, monthly.
- [IMF coarse wool via FRED](https://fred.stlouisfed.org/series/PWOOLCUSDM), US cents/kg, monthly; a broad proxy, not a Merino-yarn quote.
- [EIA US on-highway diesel via FRED](https://fred.stlouisfed.org/series/GASDESW), USD/US gallon, weekly, including taxes.
- [IMF US Henry Hub natural gas via FRED](https://fred.stlouisfed.org/series/PNGASUSUSDM), USD/MMBtu, monthly.

Every observation shows its reference period, retrieval timestamp, units and linked source. A published monthly observation is not an intraday quote. On source or parser failure, retain the dated October 24, 2026 verified snapshot (or an earlier successful response) and display the failure. There is no fabricated live quote for linen or elastane/trims. Raw-commodity and US fuel benchmarks are never substituted for finished-fabric CAD purchase rates; no automatic FX, grade or unit conversion is claimed.

The endpoint lives in `server/market.mjs` as a Vite plugin. A deployment serving only `dist/` must provide an equivalent same-origin endpoint for refreshing; otherwise the UI explicitly falls back to dated references. No Bloomberg feed, API credentials or commercial data entitlement is used.

### Shortage simulation and Joule

Choose **Simulate shortage**, select an input, enter the supply reduction, independent input-price increase, additional delivery delay, supplier pass-through and a 30/45/60-day horizon, then **Run shortage simulation**. Red graph outlines trace the affected input, production/transport relationships, SKUs and facilities. **Clear shortage scenario** removes the preview. Draft edits apply only after Run; purchase-rate changes recalculate the active economics immediately.

Two explicitly separate analyses use the same resource selection:

1. **New-production cost cohort:** planned units = ceil(seven-day store demand × horizon/7) per SKU. Completed units = floor(planned units × available-supply fraction); the remainder is deferred within this planning cohort. Online demand is excluded from this cost cohort. Added cost per completed garment = physical input per garment × current CAD input rate × price increase × supplier pass-through. Existing input costs are already embedded in finished-goods cost; only the uplift is added. Freight baseline is CAD 1.50/garment. Retail prices stay fixed. Gross margin = (retail price − landed unit cost)/retail price; weighted margin comparisons use the same completed SKU mix. Zero completed revenue makes the percentage undefined. Gross profit reduction = added costs + baseline gross profit on deferred units. Deferred production is not automatically treated as permanently lost sales.
2. **Downstream stock simulation:** starting stock, reservations and existing transit remain intact. Only the hypothetical new replenishment is reduced and delayed for affected SKUs. Alternatives share the resource constraint; choosing another producer does not automatically remove a common energy shortage. The daily conservation invariant is preserved. Timeline sales foregone is a separate retail revenue estimate using the existing 70% lost-sale assumption; do not add it to the cost-cohort gross profit reduction.

Physical input requirements are seeded assumptions: cotton fabric 1.15 yards/top or 1.6 yards/denim garment; linen 1.8 yards/trouser; wool 0.4 kg/crewneck; trims 0.05 kg/garment; transport fuel 0.8 litres/garment; process gas 0.12 MMBtu/garment. Shortfall maps 1:1 to reduced new production; no statistical demand, commodity-price elasticity or validated factory capacity is claimed.

**Ask Joule: cost & margin impact** uses the applied resource shock, edited purchase rates, physical input quantities, public reference and active graph day. It explains exact per-garment calculations, weighted margin erosion in percentage points, deferred production, downstream risk and suggested inventory/contract reviews. It does not place purchases or execute transfers.

Demo: inspect Cotton fabric and its CAD/yard costs; simulate a diesel or natural-gas shortage; inspect red paths and the unit-cost/margin table; ask Joule to explain the same result; clear the preview and demonstrate that saved stock is unchanged.


## Demo interface cleanup

The network uses the same light surfaces, blue selection accents and semantic amber/red states as the rest of the SAP-style application. Current-record and projected views share this styling, including the expanded graph, timeline controls, legend and shortage highlights.

Connection setup, Google Maps credentials and configurable SAP tenant links have been removed from the demo interface. The map uses OpenStreetMap directly. Existing SAP architecture explanations and simulated transaction workflows remain available.

Day and scenario selection live once, above the graph. Advanced controls retain supplier delay, demand/horizon assumptions, response selection, playback, impact charts and event explanations. The duplicate inspector delay slider and lower day/scenario selectors have been removed. Supplier dependencies are inspected through the graph; the separate duplicate supplier drilldown has been removed, while the commercial-terms table remains because it adds finished-garment costs and capacity. Material purchase rates, resource shortages, stock projections, inventory records and approval workflows remain distinct functional views.
