import { useState, useMemo, useEffect } from "react";
import {
  Button,
  Icon,
  Input,
  Select,
  Option,
  MessageStrip,
} from "@ui5/webcomponents-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
} from "recharts";
import { opportunities, money, demandFor } from "../data";
import type { DemoState, Opportunity } from "../data";
import {
  locations,
  locationFor,
  candidates,
  transferable,
  proposeTransfer,
  advanceTransfer,
  stockTransportDraft,
  onlineDemand,
  salesRisk,
  storeRisks,
  seasonalProfile,
  downloadJson,
} from "../planning";
import type { TransferStage } from "../planning";
import type { Connections } from "../connections";
import { saveConnections } from "../connections";
import RetailMap from "./RetailMap";
import type { MapPoint } from "./RetailMap";
interface SharedProps {
  state: DemoState;
  onState: (s: DemoState) => void;
  notify: (message: string) => void;
}
function Metric({
  label,
  value,
  note,
  tone = "",
}: {
  label: string;
  value: string | number;
  note: string;
  tone?: string;
}) {
  return (
    <div className="kpi">
      <span className="kpi-label">{label}</span>
      <strong className={`kpi-value planning-metric ${tone}`}>{value}</strong>
      <small className="muted">{note}</small>
    </div>
  );
}
function Card({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h3>{title}</h3>
          {description && <p>{description}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}
export function LocationIntelligence({
  state,
  onState,
  notify,
  connections,
  onWorkflow,
  onConnections,
  onOpportunity,
}: {
  connections: Connections;
  onWorkflow: () => void;
  onConnections: () => void;
  onOpportunity: (o: Opportunity) => void;
} & SharedProps) {
  const [region, setRegion] = useState("West");
  const [location, setLocation] = useState("Vancouver Downtown");
  const [sku, setSku] = useState("ERT-CRM-M");
  const [sourceId, setSourceId] = useState("");
  const [quantity, setQuantity] = useState(40);
  const [onlyIssues, setOnlyIssues] = useState(false);
  const riskRows = storeRisks(state, 7, 70);
  const online = state.inventory.find((i) => i.id === "online-west")!;
  const onlineRisk = salesRisk(onlineDemand(15, 7), online.stock, 39, 70);
  const nodes = useMemo(
    () =>
      locations
        .filter(
          (l) =>
            (region === "Canada" || l.region === region) &&
            state.inventory.some((i) => i.location === l.name && i.sku === sku),
        )
        .map((l) => {
          const rows = riskRows.filter(
            (r) => r.record.location === l.name && r.o.sku === sku,
          );
          const shortage =
            rows.reduce((n, r) => n + r.units, 0) +
            (l.name === online.location && sku === online.sku
              ? onlineRisk.units
              : 0);
          const available = state.inventory
            .filter((i) => i.location === l.name && i.sku === sku)
            .reduce((n, i) => n + transferable(state, i), 0);
          const expected =
            rows.reduce((n, r) => n + r.expected, 0) +
            (l.name === online.location && sku === online.sku
              ? onlineRisk.expected
              : 0);
          return {
            location: l,
            severity:
              shortage > 0
                ? "shortage"
                : available > 0
                  ? "available"
                  : "balanced",
            label:
              shortage > 0
                ? `${shortage} units uncovered · ${money(expected)} scenario sales foregone`
                : `${available} transferable units`,
            shortage,
            available,
            expected,
          };
        })
        .filter((p) => !onlyIssues || p.shortage > 0),
    [state, region, onlyIssues, sku],
  );
  const destination = state.inventory.find(
    (i) => i.location === location && i.sku === sku,
  );
  const suggestions = destination ? candidates(state, destination.id) : [];
  const source =
    suggestions.find((c) => c.record.id === sourceId) || suggestions[0];
  const destinationLoc = locationFor(location);
  const incoming = destination
    ? state.transfers
        .filter(
          (t) =>
            t.destinationId === destination.id &&
            !["Received", "Cancelled"].includes(t.stage),
        )
        .reduce((n, t) => n + t.quantity, 0)
    : 0;
  const destinationGap = Math.max(
    0,
    (destination
      ? location === "Online West Fulfillment"
        ? onlineRisk.units
        : riskRows.find((r) => r.record.id === destination.id)?.units || 0
      : 0) - incoming,
  );
  const risk = destination
    ? salesRisk(
        location === "Online West Fulfillment"
          ? onlineDemand(15, 7)
          : demandFor(
              opportunities.find((o) => o.sku === sku)!,
              state,
            ),
        destination.stock,
        opportunities.find((o) => o.sku === sku)!.price,
        70,
      )
    : null;
  useEffect(() => {
    setQuantity(Math.min(40, source?.available || 0, destinationGap));
  }, [destination?.id, source?.record.id, source?.available, destinationGap]);
  const selectLocation = (name: string) => {
    setLocation(name);
    setSourceId("");
    const record = state.inventory.find((i) => i.location === name);
    if (record) setSku(record.sku);
  };
  const route =
    source && destinationLoc
      ? ([locationFor(source.record.location), destinationLoc] as [
          ReturnType<typeof locationFor>,
          ReturnType<typeof locationFor>,
        ])
      : undefined;
  return (
    <>
      <div className="planning-topline">
        <MessageStrip hideCloseButton design="Information">
          Explore demonstration locations, identify shortages and create a stock
          transport proposal. Location pins represent sample facilities, not
          live devices.
        </MessageStrip>
        <Button icon="settings" onClick={onConnections}>
          Map connection
        </Button>
      </div>
      <div className="geo-toolbar">
        <label>
          Region
          <Select
            accessibleName="Map region"
            onChange={(e) => {
              const r = e.detail.selectedOption.textContent!;
              setRegion(r);
              selectLocation(
                r === "Ontario"
                  ? "Toronto Queen Street"
                  : r === "Quebec"
                    ? "Montreal Centre"
                    : "Vancouver Downtown",
              );
            }}
          >
            {["West", "Ontario", "Quebec", "Canada"].map((r) => (
              <Option selected={region === r} key={r}>
                {r}
              </Option>
            ))}
          </Select>
        </label>
        <label>
          Focus location
          <Select
            accessibleName="Focus location"
            onChange={(e) =>
              selectLocation(e.detail.selectedOption.textContent!)
            }
          >
            {locations
              .filter((l) => region === "Canada" || l.region === region)
              .map((l) => (
                <Option selected={l.name === location} key={l.name}>
                  {l.name}
                </Option>
              ))}
          </Select>
        </label>
        <label>
          Product / SKU
          <Select
            accessibleName="Map product"
            onChange={(e) => {
              setSku(e.detail.selectedOption.getAttribute("data-sku")!);
              setSourceId("");
            }}
          >
            {opportunities.map((o) => (
              <Option key={o.sku} data-sku={o.sku} selected={o.sku === sku}>
                {o.product} · {o.size}
              </Option>
            ))}
          </Select>
        </label>
        <Button
          design={onlyIssues ? "Emphasized" : "Default"}
          icon="alert"
          onClick={() => setOnlyIssues(!onlyIssues)}
        >
          {onlyIssues ? "Show all locations" : "Only shortages"}
        </Button>
      </div>
      <div className="geo-grid">
        <RetailMap
          points={nodes as MapPoint[]}
          route={route}
          connections={connections}
          onSelect={selectLocation}
        />
        <Card
          title={location}
          description={`${destinationLoc.plant} / ${destinationLoc.storage} · ${destinationLoc.kind}`}
        >
          {destination && risk ? (
            <>
              <div className="location-risk">
                <span>IF NO ACTION · NEXT 7 DAYS</span>
                <strong>{money(risk.expected)}</strong>
                <p>Estimated sales foregone · {risk.units} units uncovered</p>
                <small>
                  70% lost-sale assumption; scenario, not measured revenue.
                </small>
              </div>
              <div className="stock-facts">
                <span>
                  On hand <strong>{destination.stock} units</strong>
                </span>
                <span>
                  Committed incoming{" "}
                  <strong>
                    {state.transfers
                      .filter(
                        (t) =>
                          t.destinationId === destination.id &&
                          !["Received", "Cancelled"].includes(t.stage),
                      )
                      .reduce((n, t) => n + t.quantity, 0)}{" "}
                    units
                  </strong>
                </span>
              </div>
              {source ? (
                <div className="route-proposal">
                  <h4>Recommended stock source</h4>
                  <p>
                    <Icon name="shipping-status" />
                    {source.record.location} → {location}
                  </p>
                  <label>
                    Available source
                    <Select
                      accessibleName="Transfer source"
                      onChange={(e) => {
                        setSourceId(
                          e.detail.selectedOption.getAttribute("data-id")!,
                        );
                      }}
                    >
                      {suggestions.map((c) => (
                        <Option
                          key={c.record.id}
                          data-id={c.record.id}
                          selected={source.record.id === c.record.id}
                        >
                          {c.record.location} · {c.available} units ·{" "}
                          {c.distance} km
                        </Option>
                      ))}
                    </Select>
                  </label>
                  <small>
                    {source.distance} km straight-line estimate · reserve and
                    existing commitments protected
                  </small>
                  <label>
                    Quantity
                    <Input
                      type="Number"
                      accessibleName="Map transfer quantity"
                      value={String(quantity)}
                      onInput={(e) => setQuantity(Number(e.target.value))}
                    />
                  </label>
                  <p className="muted">
                    Up to {Math.min(source.available, destinationGap)} units
                    address this gap. Proposed transit:{" "}
                    {destinationLoc.region ===
                    locationFor(source.record.location).region
                      ? "2"
                      : "5"}{" "}
                    days (demo).
                  </p>
                  <Button
                    design="Emphasized"
                    disabled={
                      !Number.isInteger(quantity) ||
                      quantity < 1 ||
                      quantity > source.available ||
                      quantity > destinationGap ||
                      destinationGap === 0
                    }
                    onClick={() => {
                      try {
                        const next = proposeTransfer(
                          state,
                          source.record.id,
                          destination.id,
                          quantity,
                        );
                        onState(next);
                        notify(
                          "Transfer proposal created. Continue in SAP Workflow.",
                        );
                        onWorkflow();
                      } catch (e) {
                        notify((e as Error).message);
                      }
                    }}
                  >
                    Create transfer proposal
                  </Button>
                  <a
                    target="_blank"
                    rel="noreferrer"
                    href={`https://www.google.com/maps/dir/?api=1&origin=${source.record.location ? `${route![0].lat},${route![0].lng}` : ""}&destination=${destinationLoc.lat},${destinationLoc.lng}&travelmode=driving`}
                  >
                    View driving directions in Google Maps ↗
                  </a>
                </div>
              ) : (
                <div className="route-proposal">
                  <h4>
                    {risk.units
                      ? "No uncommitted surplus is available"
                      : "Demand is covered"}
                  </h4>
                  <p>
                    {risk.units
                      ? "Review replenishment or wait for committed stock to arrive."
                      : "Keep protected stock in place and monitor demand."}
                  </p>
                  <Button onClick={onWorkflow}>Review pending transfers</Button>
                </div>
              )}
              <div className="location-drilldown">
                <Button
                  design="Transparent"
                  onClick={() =>
                    onOpportunity(opportunities.find((o) => o.sku === sku)!)
                  }
                >
                  Open underlying opportunity
                </Button>
              </div>
            </>
          ) : (
            <div className="empty">
              <h3>No demand record for this selection</h3>
              <p>Select a stocked SKU or a destination with a shortage.</p>
            </div>
          )}
        </Card>
      </div>
      <Card
        title="Areas requiring attention"
        description="Map alerts are calculated from shared stock records. Incoming proposals are not counted as stock received."
      >
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Location</th>
                <th>Issue / availability</th>
                <th>Estimated foregone sales</th>
                <th>Suggested response</th>
              </tr>
            </thead>
            <tbody>
              {nodes.map((n) => (
                <tr key={n.location.name}>
                  <td>
                    <button
                      className="text-link"
                      onClick={() => selectLocation(n.location.name)}
                    >
                      {n.location.name}
                    </button>
                    <small>
                      {n.location.plant} · {n.location.kind}
                    </small>
                  </td>
                  <td>
                    <span
                      className={n.shortage ? "negative-text" : "positive-text"}
                    >
                      {n.shortage
                        ? `${n.shortage} units uncovered`
                        : `${n.available} transferable units`}
                    </span>
                  </td>
                  <td>
                    {money(n.expected)}
                    <small>7 days · 70% assumption</small>
                  </td>
                  <td>
                    {n.shortage
                      ? "Evaluate nearby surplus and replenishment"
                      : "Protect reserve; release surplus if needed"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
export function RiskSeasonality({
  state,
  onState,
  notify,
  onWorkflow,
  onOpportunity,
}: {
  onWorkflow: () => void;
  onOpportunity: (o: Opportunity) => void;
} & SharedProps) {
  const [horizon, setHorizon] = useState(7);
  const [lossRate, setLossRate] = useState(70);
  const [conversion, setConversion] = useState(15);
  const [selectedSku, setSelectedSku] = useState(opportunities[0].sku);
  const [category, setCategory] = useState("Knitwear");
  const o = opportunities.find((o) => o.sku === selectedSku)!;
  const record = state.inventory.find((i) => i.id === `${o.id}-dest`)!;
  const risk = salesRisk(
    (demandFor(o, state) * horizon) / 7,
    record.stock,
    o.price,
    lossRate,
  );
  const source = candidates(state, record.id)[0];
  const incoming = state.transfers
    .filter(
      (t) =>
        t.destinationId === record.id &&
        !["Received", "Cancelled"].includes(t.stage),
    )
    .reduce((n, t) => n + t.quantity, 0);
  const qty = source
    ? Math.min(source.available, Math.max(0, risk.units - incoming))
    : 0;
  const actionRisk = salesRisk(
    (demandFor(o, state) * horizon) / 7,
    record.stock + qty,
    o.price,
    lossRate,
  );
  const benefit = risk.expected - actionRisk.expected;
  const season = seasonalProfile(category);
  const online = state.inventory.find((i) => i.id === "online-west")!;
  const webDemand = onlineDemand(conversion, horizon);
  const webRisk = salesRisk(webDemand, online.stock, 39, lossRate);
  const onlineSource = candidates(state, online.id)[0];
  const pendingWeb = state.transfers.some(
    (t) =>
      t.destinationId === online.id &&
      !["Received", "Cancelled"].includes(t.stage),
  );
  const rows = storeRisks(state, horizon, lossRate);
  return (
    <>
      <MessageStrip design="Information" hideCloseButton>
        Sales exposure is an assumption-based scenario, not a prediction or
        measured loss. Online and store demand are shown separately; no
        cross-channel customer deduplication is claimed.
      </MessageStrip>
      <div className="risk-controls">
        <label>
          Horizon
          <Select
            accessibleName="Risk horizon"
            onChange={(e) =>
              setHorizon(
                Number(e.detail.selectedOption.getAttribute("data-days")),
              )
            }
          >
            {[7, 14, 30].map((d) => (
              <Option data-days={d} selected={horizon === d} key={d}>
                {d} days
              </Option>
            ))}
          </Select>
        </label>
        <label>
          Uncovered demand that becomes a lost sale <strong>{lossRate}%</strong>
          <input
            aria-label="Lost sale assumption"
            type="range"
            min="0"
            max="100"
            value={lossRate}
            onChange={(e) => setLossRate(Number(e.target.value))}
          />
        </label>
        <label>
          Product
          <Select
            accessibleName="Risk product"
            onChange={(e) =>
              setSelectedSku(e.detail.selectedOption.getAttribute("data-sku")!)
            }
          >
            {opportunities.map((o) => (
              <Option
                key={o.sku}
                data-sku={o.sku}
                selected={o.sku === selectedSku}
              >
                {o.product} · {o.size}
              </Option>
            ))}
          </Select>
        </label>
      </div>
      <div className="risk-comparison">
        <Card
          title="If you do nothing"
          description={`${o.product} · ${o.location} · ${horizon}-day horizon`}
        >
          <div className="risk-big negative-text">{money(risk.expected)}</div>
          <p className="risk-caption">
            Estimated sales foregone from {risk.units} uncovered units
          </p>
          <div className="risk-formula">
            {risk.units} units × {money(o.price)} retail × {lossRate}% lost-sale
            assumption
          </div>
          <p className="risk-caption">
            Gross retail exposure: {money(risk.gross)}. No additional supply
            assumed.
          </p>
        </Card>
        <Card
          title="If you transfer available stock"
          description="Counterfactual after assumed receipt within the horizon"
        >
          <div className="risk-big positive-text">
            {money(actionRisk.expected)}
          </div>
          <p className="risk-caption">
            Remaining estimated sales foregone after {qty} units arrive
          </p>
          <div className="risk-formula">
            Avoidable modeled loss: <strong>{money(benefit)}</strong> · transfer
            cost: {money(qty * 1.5)}
          </div>
          <div className="risk-action">
            <Button
              design="Emphasized"
              disabled={!qty}
              onClick={() => {
                try {
                  onState(
                    proposeTransfer(state, source.record.id, record.id, qty),
                  );
                  notify(
                    "Transfer proposal created; follow approval, issue and receipt in SAP Workflow.",
                  );
                  onWorkflow();
                } catch (e) {
                  notify((e as Error).message);
                }
              }}
            >
              Propose {qty}-unit transfer
            </Button>
            <Button design="Transparent" onClick={() => onOpportunity(o)}>
              Review evidence
            </Button>
          </div>
        </Card>
      </div>
      <Card
        title="Online store availability · SAP Commerce Cloud workflow"
        description="Essential Ribbed Top · Cream M · Online West Fulfillment"
      >
        <div className="commerce-grid">
          <div className="commerce-risk">
            <div className="product-channel">
              <Icon name="cart" />
              <span>ONLINE CHANNEL</span>
              <span
                className={online.stock > 0 ? "positive-text" : "negative-text"}
              >
                {online.stock > 0 ? "Available to promise" : "Out of stock"}
              </span>
            </div>
            <h2>
              {money(webRisk.expected)} <small>estimated sales foregone</small>
            </h2>
            <p>
              {webRisk.units > 0
                ? `If the online channel remains understocked for ${horizon} days.`
                : `Current online stock covers the ${horizon}-day demand scenario.`}
            </p>
            <div className="web-metrics">
              <div>
                <strong>162</strong>
                <span>qualified OOS sessions / 7 days</span>
              </div>
              <div>
                <strong>{webDemand}</strong>
                <span>modeled purchase units</span>
              </div>
              <div>
                <strong>{online.stock}</strong>
                <span>online sellable units</span>
              </div>
            </div>
            <label className="web-slider">
              Session-to-purchase assumption <strong>{conversion}%</strong>
              <input
                aria-label="Online conversion assumption"
                type="range"
                min="0"
                max="40"
                value={conversion}
                onChange={(e) => setConversion(Number(e.target.value))}
              />
            </label>
            <p className="fine-print">
              floor(162 × {conversion}% × {horizon}/7) − online stock; uncovered
              units × CAD 39 × {lossRate}%. Repeat-session aggregates are
              seeded; this is not a live website tracker.
            </p>
          </div>
          <div className="commerce-response">
            <h3>Restore online availability</h3>
            <p>
              Use surplus stock to replenish the fulfillment location. S/4HANA
              goods receipt updates the shared demo stock; the Commerce
              availability view then reflects the new quantity.
            </p>
            <ol>
              <li>Stock transport proposal</li>
              <li>Planner approval and goods issue</li>
              <li>Goods receipt at online fulfillment</li>
              <li>Commerce availability refresh</li>
            </ol>
            <Button
              design="Emphasized"
              disabled={!onlineSource || webRisk.units === 0 || pendingWeb}
              onClick={() => {
                try {
                  onState(
                    proposeTransfer(
                      state,
                      onlineSource.record.id,
                      online.id,
                      Math.min(webRisk.units, onlineSource.available),
                    ),
                  );
                  notify(
                    "Online replenishment proposed. Complete the SAP workflow to restore availability.",
                  );
                  onWorkflow();
                } catch (e) {
                  notify((e as Error).message);
                }
              }}
            >
              {pendingWeb
                ? "Replenishment already pending"
                : "Propose online replenishment"}
            </Button>
            {pendingWeb && (
              <Button onClick={onWorkflow}>Track incoming stock</Button>
            )}
          </div>
        </div>
      </Card>
      <Card
        title="Store risk register"
        description={`${horizon} days · excludes the separately modeled online channel`}
      >
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Product / location</th>
                <th>Stock</th>
                <th>Uncovered units</th>
                <th>Gross exposure</th>
                <th>Estimated sales foregone</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.o.id}>
                  <td>
                    {r.o.product}
                    <small>
                      {r.o.location} · {r.o.sku}
                    </small>
                  </td>
                  <td>{r.record.stock}</td>
                  <td>{r.units}</td>
                  <td>{money(r.gross)}</td>
                  <td className="negative-text">{money(r.expected)}</td>
                  <td>
                    <Button
                      design="Transparent"
                      onClick={() => onOpportunity(r.o)}
                    >
                      Review
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Card
        title="When does it sell best?"
        description="Illustrative 2025 monthly unit history by representative product category · Northern Hemisphere seasons"
      >
        <div className="season-heading">
          <label>
            Category
            <Select
              accessibleName="Seasonality category"
              onChange={(e) =>
                setCategory(e.detail.selectedOption.textContent!)
              }
            >
              {["Tops", "Denim", "Bottoms", "Knitwear"].map((c) => (
                <Option selected={c === category} key={c}>
                  {c}
                </Option>
              ))}
            </Select>
          </label>
          <div>
            <span>Best season</span>
            <strong className="positive-text">{season.bestSeason}</strong>
          </div>
          <div>
            <span>Peak month</span>
            <strong>{season.peak}</strong>
          </div>
          <div>
            <span>Quietest season</span>
            <strong>{season.worstSeason}</strong>
          </div>
          <div>
            <span>Lowest month</span>
            <strong>{season.low}</strong>
          </div>
        </div>
        <div className="season-chart">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={season.chart}
              margin={{ left: 0, right: 25, top: 12, bottom: 10 }}
            >
              <CartesianGrid vertical={false} stroke="#e5ebf2" />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                formatter={(v) => [v, "Seasonal index (100 = average month)"]}
              />
              <ReferenceLine y={100} stroke="#8b9fb4" strokeDasharray="4 4" />
              <Bar
                dataKey="index"
                name="Seasonal demand index"
                fill="#0070f2"
                radius={[3, 3, 0, 0]}
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="season-footer">
          <p>
            <strong>Planning response:</strong>{" "}
            {category === "Knitwear"
              ? "Build cover ahead of November and December; reduce summer replenishment."
              : category === "Bottoms"
                ? "Build linen inventory ahead of summer; avoid carrying peak-season quantities into winter."
                : category === "Denim"
                  ? "Prepare for the late-summer and autumn demand peak."
                  : "Prepare for stronger spring and summer demand."}{" "}
            One illustrative year cannot establish statistically reliable
            seasonality.
          </p>
          <Button
            icon="download"
            onClick={() => {
              downloadJson(`ibp-${category.toLowerCase()}-seasonal-plan.json`, {
                mode: "DEMO_PLANNING_HANDOFF",
                target: "SAP Integrated Business Planning",
                category,
                sourcePeriod: "2025-01/2025-12",
                measure: "Illustrative units and seasonal index",
                assumptions:
                  "Not a validated forecast; tenant key-figure mapping required",
                months: season.chart,
              });
              notify(
                "IBP planning handoff downloaded. No live IBP data was changed.",
              );
            }}
          >
            Export IBP planning handoff
          </Button>
        </div>
      </Card>
    </>
  );
}
export function SapWorkflow({
  state,
  onState,
  notify,
  connections,
}: SharedProps & { connections: Connections }) {
  const [focus, setFocus] = useState("");
  const [payload, setPayload] = useState(false);
  const transfers = state.transfers;
  const t = transfers.find((x) => x.id === focus) || transfers[0];
  const stages: TransferStage[] = [
    "Proposed",
    "Approved",
    "In transit",
    "Received",
  ];
  const src = t ? state.inventory.find((i) => i.id === t.sourceId)! : null,
    dest = t ? state.inventory.find((i) => i.id === t.destinationId)! : null;
  const transition = (target: TransferStage) => {
    if (!t) return;
    try {
      onState(advanceTransfer(state, t.id, target));
      notify(
        target === "Received"
          ? "Demo goods receipt posted. Inventory, risk and Commerce availability recalculated."
          : target === "In transit"
            ? "Demo goods issue posted. Units are now in transit."
            : `Transfer ${target.toLowerCase()}.`,
      );
    } catch (e) {
      notify((e as Error).message);
    }
  };
  return (
    <>
      <MessageStrip design="Information" hideCloseButton>
        This is a working simulation of SAP business steps. DEMO-STO references
        are local proposal IDs, not SAP document numbers. No tenant API is
        connected.
      </MessageStrip>
      <div className="kpi-grid">
        <Metric
          label="Awaiting approval"
          value={transfers.filter((t) => t.stage === "Proposed").length}
          note="Planning proposals reserve demo stock"
        />
        <Metric
          label="Approved for dispatch"
          value={transfers.filter((t) => t.stage === "Approved").length}
          note="Ready for goods issue"
        />
        <Metric
          label="Units in transit"
          value={transfers
            .filter((t) => t.stage === "In transit")
            .reduce((n, t) => n + t.quantity, 0)}
          note="Excluded from destination sellable stock"
        />
        <Metric
          label="Received units"
          value={transfers
            .filter((t) => t.stage === "Received")
            .reduce((n, t) => n + t.quantity, 0)}
          note="Included in shared destination stock"
        />
      </div>
      <Card
        title={`Stock transport worklist (${transfers.length})`}
        description="S/4HANA-aligned sequence · proposal → approval → goods issue → goods receipt"
      >
        {transfers.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Proposal</th>
                  <th>Product / channel</th>
                  <th>Route</th>
                  <th>Units</th>
                  <th>Stage</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {transfers.map((x) => (
                  <tr key={x.id}>
                    <td>
                      <button
                        className="text-link"
                        onClick={() => {
                          setFocus(x.id);
                          setPayload(false);
                        }}
                      >
                        {x.id}
                      </button>
                      <small>Demo document</small>
                    </td>
                    <td>
                      {x.product}
                      <small>
                        {x.sku} · {x.channel}
                      </small>
                    </td>
                    <td>
                      {
                        state.inventory.find((i) => i.id === x.sourceId)
                          ?.location
                      }
                      <small>
                        →{" "}
                        {
                          state.inventory.find((i) => i.id === x.destinationId)
                            ?.location
                        }
                      </small>
                    </td>
                    <td>{x.quantity}</td>
                    <td>
                      <span
                        className={`status ${x.stage === "Received" ? "positive" : x.stage === "Cancelled" ? "neutral" : "information"}`}
                      >
                        {x.stage}
                      </span>
                    </td>
                    <td>
                      <Button
                        design="Transparent"
                        onClick={() => {
                          setFocus(x.id);
                          setPayload(false);
                        }}
                      >
                        Inspect
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty">
            <Icon name="shipping-status" />
            <h3>No stock transport proposals yet</h3>
            <p>
              Create one from Location Intelligence, a risk scenario or an
              opportunity decision.
            </p>
          </div>
        )}
      </Card>
      {t && src && dest && (
        <Card
          title={t.id}
          description={`${t.quantity} units · ${src.location} → ${dest.location}`}
        >
          <div className="workflow-steps">
            {stages.map((stage, i) => (
              <div
                key={stage}
                className={
                  t.stage === "Cancelled"
                    ? "cancelled"
                    : stages.indexOf(t.stage) >= i
                      ? "done"
                      : ""
                }
              >
                <span>{stages.indexOf(t.stage) > i ? "✓" : i + 1}</span>
                <strong>{stage}</strong>
                <small>
                  {
                    [
                      "Retail Signal proposal",
                      "S/4HANA release step",
                      "Outbound / goods issue",
                      "Goods receipt + Commerce",
                    ][i]
                  }
                </small>
              </div>
            ))}
          </div>
          <div className="workflow-explanation">
            <Icon name="information" />
            <p>
              {t.stage === "Proposed"
                ? "The source quantity is committed to this proposal. Neither location’s physical stock has changed."
                : t.stage === "Approved"
                  ? "A planner has released this demo proposal. Dispatch reduces source stock; destination stock stays unchanged until receipt."
                  : t.stage === "In transit"
                    ? "Source stock has decreased. The transferred units are held in transit and cannot be sold by the destination yet."
                    : t.stage === "Received"
                      ? "Destination stock now includes the received quantity. Risk calculations and online availability use the new balance."
                      : "The proposal is cancelled. Its source commitment has been released."}
            </p>
          </div>
          <div className="sap-object-grid">
            <div>
              <span>SAP material mapping</span>
              <strong>{t.sku}</strong>
              <small>Demo external SKU → Product</small>
            </div>
            <div>
              <span>Supplying plant</span>
              <strong>{locationFor(src.location).plant}</strong>
              <small>{src.location}</small>
            </div>
            <div>
              <span>Receiving plant / storage</span>
              <strong>
                {locationFor(dest.location).plant} /{" "}
                {locationFor(dest.location).storage}
              </strong>
              <small>{dest.location}</small>
            </div>
            <div>
              <span>Commerce availability</span>
              <strong>
                {t.channel === "Online"
                  ? `${dest.stock} units`
                  : "Store channel"}
              </strong>
              <small>Refreshed from shared stock on receipt</small>
            </div>
          </div>
          <div className="workflow-actions">
            {t.stage === "Proposed" && (
              <Button
                design="Emphasized"
                onClick={() => transition("Approved")}
              >
                Approve proposal
              </Button>
            )}
            {t.stage === "Approved" && (
              <Button
                design="Emphasized"
                icon="shipping-status"
                onClick={() => transition("In transit")}
              >
                Post demo goods issue
              </Button>
            )}
            {t.stage === "In transit" && (
              <Button
                design="Emphasized"
                icon="accept"
                onClick={() => transition("Received")}
              >
                Post demo goods receipt
              </Button>
            )}
            {["Proposed", "Approved"].includes(t.stage) && (
              <Button onClick={() => transition("Cancelled")}>
                Cancel proposal
              </Button>
            )}
            <Button
              icon="download"
              onClick={() => {
                downloadJson(
                  `${t.id}-s4hana-draft.json`,
                  stockTransportDraft(t, state),
                );
                notify(
                  "S/4HANA mapping draft downloaded. Validate document type, units and organizational data against your tenant.",
                );
              }}
            >
              Export S/4HANA draft
            </Button>
            <Button design="Transparent" onClick={() => setPayload(!payload)}>
              {payload ? "Hide mapping" : "Inspect SAP mapping"}
            </Button>
            {connections.s4FioriUrl && (
              <a href={connections.s4FioriUrl} target="_blank" rel="noreferrer">
                Open configured S/4HANA app ↗
              </a>
            )}
          </div>
          {payload && (
            <div className="sap-payload">
              <p>
                Dedicated Stock Transport Order OData V4 service. This is an
                illustrative tenant mapping, not a validated request. Document
                type UB, company code, plants, units and supported release must
                be verified in your system.
              </p>
              <pre>
                {JSON.stringify(stockTransportDraft(t, state), null, 2)}
              </pre>
              <a
                href="https://help.sap.com/docs/SAP_S4HANA_CLOUD/bb9f1469daf04bd894ab2167f8132a1a/807b2c79e22c4ef7a4c30c928bb3344e.html"
                target="_blank"
                rel="noreferrer"
              >
                SAP Stock Transport Order API documentation ↗
              </a>
            </div>
          )}
          <div className="workflow-audit">
            <h4>Business event trail</h4>
            {t.events.map((e, i) => (
              <div key={`${e.timestamp}-${i}`}>
                <i />
                <strong>{e.stage}</strong>
                <span>
                  Alex Morgan ·{" "}
                  {new Date(e.timestamp).toLocaleString("en-CA", {
                    timeZone: "America/Vancouver",
                  })}
                </span>
                <small>Demo event · No remote API call</small>
              </div>
            ))}
          </div>
        </Card>
      )}
      <Card
        title="Existing SAP products in this workflow"
        description="Concrete responsibilities and handoffs, with each integration state kept explicit"
      >
        <div className="sap-product-flow">
          <div>
            <Icon name="database" />
            <h4>SAP Customer Activity Repository</h4>
            <p>
              Transactional and inventory context. This demo supplies seeded
              records.
            </p>
            <span>Simulated input</span>
          </div>
          <div>
            <Icon name="inventory" />
            <h4>SAP S/4HANA</h4>
            <p>
              Stock transport order, release, goods issue and receipt. Export a
              mapping draft for the dedicated V4 service.
            </p>
            <span>Working demo lifecycle</span>
          </div>
          <div>
            <Icon name="cart" />
            <h4>SAP Commerce Cloud</h4>
            <p>
              Online sellable availability changes after fulfillment stock is
              received.
            </p>
            <span>Shared demo availability</span>
          </div>
          <div>
            <Icon name="line-charts" />
            <h4>SAP IBP</h4>
            <p>
              Seasonal demand review and planning handoff export. Tenant key
              figures need mapping.
            </p>
            <span>Planning handoff</span>
          </div>
        </div>
      </Card>
    </>
  );
}
export function ConnectionSettings({
  connections,
  onConnections,
  notify,
}: {
  connections: Connections;
  onConnections: (c: Connections) => void;
  notify: (s: string) => void;
}) {
  const [draft, setDraft] = useState(connections);
  const [error, setError] = useState("");
  const change = (key: keyof Connections, value: string) =>
    setDraft((c) => ({ ...c, [key]: value.trim() }));
  return (
    <Card
      title="Connection setup"
      description="Demo mode works without credentials. Configure a restricted Google browser key and links to your existing SAP apps."
    >
      <div className="connection-settings">
        <div className="connection-section">
          <h3>Google Maps JavaScript API</h3>
          <p>
            Without a key, the map uses OpenStreetMap. A valid browser key loads
            Google Maps with clickable risk markers and proposed transfer links.
            Google billing, API enablement and website restrictions are
            configured in your Google Cloud project.
          </p>
          <label>
            Browser API key
            <Input
              accessibleName="Google Maps browser key"
              type="Password"
              placeholder="Restricted Maps JavaScript API key"
              value={draft.googleMapsKey}
              onInput={(e) => change("googleMapsKey", e.target.value)}
            />
          </label>
          <label>
            Google map ID (optional for demo)
            <Input
              accessibleName="Google map ID"
              placeholder="Uses DEMO_MAP_ID when empty"
              value={draft.googleMapId}
              onInput={(e) => change("googleMapId", e.target.value)}
            />
          </label>
          <p className="fine-print">
            The Maps browser key is visible in browser requests by design and
            stored on this device. Restrict it to Maps JavaScript API and
            https://retail-signal-fiori-cv.figomyx.chatgpt.site/* (plus
            localhost during development). After changing an already loaded key,
            reload the page.
          </p>
          <a
            href="https://developers.google.com/maps/documentation/javascript/get-api-key"
            target="_blank"
            rel="noreferrer"
          >
            Google Maps setup documentation ↗
          </a>
        </div>
        <div className="connection-section">
          <h3>Your SAP application links</h3>
          <p>
            Open existing products from the same workflow. These links do not
            authenticate API access or verify a tenant connection. Use the exact
            application URL from your SAP launchpad.
          </p>
          <label>
            S/4HANA stock transport / purchasing app URL
            <Input
              accessibleName="S/4HANA application URL"
              placeholder="https://your-tenant…"
              value={draft.s4FioriUrl}
              onInput={(e) => change("s4FioriUrl", e.target.value)}
            />
          </label>
          <label>
            SAP Commerce Cloud Backoffice URL
            <Input
              accessibleName="Commerce application URL"
              placeholder="https://your-commerce…"
              value={draft.commerceUrl}
              onInput={(e) => change("commerceUrl", e.target.value)}
            />
          </label>
          <label>
            SAP IBP planning application URL
            <Input
              accessibleName="IBP application URL"
              placeholder="https://your-ibp…"
              value={draft.ibpUrl}
              onInput={(e) => change("ibpUrl", e.target.value)}
            />
          </label>
          <p className="fine-print">
            No SAP passwords or API secrets belong in this browser form. A live
            Integration Suite / BTP backend must manage authentication, CSRF,
            authorization and tenant-specific mappings.
          </p>
        </div>
      </div>
      {error && (
        <div className="connection-error" role="alert">
          {error}
        </div>
      )}
      <div className="connection-actions">
        <Button
          design="Emphasized"
          onClick={() => {
            try {
              saveConnections(draft);
              onConnections(draft);
              setError("");
              notify(
                "Connection settings saved on this device. SAP links are configured, not API-connected.",
              );
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          Save connection settings
        </Button>
        {connections.s4FioriUrl && (
          <a href={connections.s4FioriUrl} target="_blank" rel="noreferrer">
            S/4HANA ↗
          </a>
        )}
        {connections.commerceUrl && (
          <a href={connections.commerceUrl} target="_blank" rel="noreferrer">
            Commerce Backoffice ↗
          </a>
        )}
        {connections.ibpUrl && (
          <a href={connections.ibpUrl} target="_blank" rel="noreferrer">
            IBP Planning ↗
          </a>
        )}
      </div>
    </Card>
  );
}
export function OpportunityExposure({
  state,
  opportunity,
}: {
  state: DemoState;
  opportunity: Opportunity;
}) {
  const stock = state.inventory.find(
    (i) => i.id === `${opportunity.id}-dest`,
  )!.stock;
  const r = salesRisk(
    demandFor(opportunity, state),
    stock,
    opportunity.price,
    70,
  );
  return (
    <div className="opportunity-exposure">
      <Icon name="alert" />
      <div>
        <strong>
          If no action: {money(r.expected)} estimated sales foregone over 7 days
        </strong>
        <p>
          {r.units} uncovered units × {money(opportunity.price)} retail × 70%
          lost-sale assumption. Gross exposure {money(r.gross)}. This is a
          scenario, not a validated forecast.
        </p>
      </div>
    </div>
  );
}
