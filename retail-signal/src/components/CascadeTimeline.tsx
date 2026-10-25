import { useState, useEffect } from "react";
import { Button, Select, Option } from "@ui5/webcomponents-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
} from "recharts";
import type { CascadeRun, CascadeResponse } from "../cascade";
import { money, opportunities } from "../data";
import type { SupplyNode } from "../supplyNetwork";
export interface TimelineControls {
  enabled: boolean;
  day: number;
  horizon: number;
  supplier: string;
  delayDays: number;
  demandPercent: number;
  inboundWeeks: number;
  response: CascadeResponse;
  view: "baseline" | "delayed" | "response";
}
interface Props {
  controls: TimelineControls;
  onChange: (patch: Partial<TimelineControls>) => void;
  baseline: CascadeRun;
  delayed: CascadeRun;
  response: CascadeRun;
}
export function CascadeTimeline({
  controls: c,
  onChange,
  baseline,
  delayed,
  response,
}: Props) {
  const [playing, setPlaying] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(
      () => onChange({ day: c.day >= c.horizon ? 0 : c.day + 1 }),
      900,
    );
    return () => clearInterval(id);
  }, [playing, c.day, c.horizon, onChange]);
  const active =
    c.view === "baseline"
      ? baseline
      : c.view === "response"
        ? response
        : delayed;
  const point = active.days[c.day];
  const chart = baseline.days.map((b, i) => ({
    day: i,
    baseline: Math.round(b.cumulativeLoss),
    delayed: Math.round(delayed.days[i].cumulativeLoss),
    response: Math.round(response.days[i].cumulativeLoss),
  }));
  const additional = point.cumulativeLoss - baseline.days[c.day].cumulativeLoss;
  const avoided =
    delayed.days[c.day].cumulativeLoss - response.days[c.day].cumulativeLoss;
  const events = active.events.filter(
    (e) =>
      e.day <= c.day &&
      (e.kind === "supplier-arrival" ||
        e.kind === "shortage" ||
        e.kind === "recovery" ||
        e.kind === "capacity"),
  );
  const total = active.days[c.horizon];
  return (
    <div className="cascade-panel">
      <div className="cascade-heading">
        <div>
          <span>DOWNSTREAM IMPACT SIMULATOR</span>
          <h3>Follow a disruption through time</h3>
          <p>
            Hypothetical daily simulation: warehouse supply → transit → store
            and online shortages → estimated sales foregone.
          </p>
        </div>
        <Button
          design={c.enabled ? "Emphasized" : "Default"}
          onClick={() => onChange({ enabled: !c.enabled })}
        >
          {c.enabled ? "Timeline colors on graph" : "Show projected graph"}
        </Button>
      </div>
      <div className="cascade-inputs">
        <label>
          Supplier being disrupted
          <Select
            accessibleName="Timeline supplier"
            onChange={(e) =>
              onChange({
                supplier: e.detail.selectedOption.textContent!,
                delayDays: 0,
              })
            }
          >
            {[...new Set(opportunities.map((o) => o.supplier))].map((s) => (
              <Option key={s} selected={c.supplier === s}>
                {s}
              </Option>
            ))}
          </Select>
        </label>
        <label>
          Additional delay <strong>{c.delayDays} days</strong>
          <input
            aria-label="Timeline additional supplier delay"
            type="range"
            min="0"
            max="21"
            value={c.delayDays}
            onChange={(e) => onChange({ delayDays: Number(e.target.value) })}
          />
        </label>
        <label>
          Demand level <strong>{c.demandPercent}%</strong>
          <input
            aria-label="Timeline demand multiplier"
            type="range"
            min="50"
            max="200"
            step="10"
            value={c.demandPercent}
            onChange={(e) =>
              onChange({ demandPercent: Number(e.target.value) })
            }
          />
        </label>
        <label>
          Horizon
          <Select
            accessibleName="Timeline horizon"
            onChange={(e) => {
              const horizon = Number(
                e.detail.selectedOption.getAttribute("data-days"),
              );
              onChange({ horizon, day: Math.min(c.day, horizon) });
            }}
          >
            {[30, 45, 60].map((n) => (
              <Option key={n} data-days={n} selected={c.horizon === n}>
                {n} days
              </Option>
            ))}
          </Select>
        </label>
        <label>
          Response to compare
          <Select
            accessibleName="Timeline response"
            onChange={(e) =>
              onChange({
                response: e.detail.selectedOption.getAttribute(
                  "data-response",
                ) as CascadeResponse,
              })
            }
          >
            <Option
              data-response="rebalance"
              selected={c.response === "rebalance"}
            >
              Rebalance available stock
            </Option>
            <Option
              data-response="alternative"
              selected={c.response === "alternative"}
            >
              Alternative supplier · cream M only
            </Option>
          </Select>
        </label>
      </div>
      <div
        className="cascade-scenario-tabs"
        role="group"
        aria-label="Projected graph scenario"
      >
        {(
          [
            { id: "baseline", label: "Original supplier timing" },
            { id: "delayed", label: "Delay · no additional action" },
            { id: "response", label: "Delay · with response" },
          ] as const
        ).map((v) => (
          <button
            key={v.id}
            aria-pressed={c.view === v.id}
            className={c.view === v.id ? "active" : ""}
            onClick={() => onChange({ view: v.id, enabled: true })}
          >
            {v.label}
          </button>
        ))}
      </div>
      <div className="cascade-scrubber">
        <Button
          icon={playing ? "media-pause" : "media-play"}
          accessibleName={
            playing ? "Pause downstream timeline" : "Play downstream timeline"
          }
          onClick={() => setPlaying(!playing)}
        >
          {playing ? "Pause" : "Play"}
        </Button>
        <strong>Day {c.day}</strong>
        <input
          aria-label="Downstream simulation day"
          type="range"
          min="0"
          max={c.horizon}
          step="1"
          value={c.day}
          onChange={(e) => {
            setPlaying(false);
            onChange({ day: Number(e.target.value) });
          }}
        />
        <span>Day {c.horizon}</span>
        <Button
          design="Transparent"
          onClick={() => {
            setPlaying(false);
            onChange({ day: 0 });
          }}
        >
          Reset day
        </Button>
      </div>
      <div className="cascade-metrics">
        <div>
          <span>Unfulfilled demand today</span>
          <strong>
            {point.unmet.toFixed(1)} <small>units</small>
          </strong>
        </div>
        <div>
          <span>Cumulative estimated sales foregone</span>
          <strong>{money(point.cumulativeLoss)}</strong>
        </div>
        <div>
          <span>Change vs. original supplier timing</span>
          <strong
            className={additional > 0 ? "negative-text" : "positive-text"}
          >
            {money(additional)}
          </strong>
        </div>
        <div>
          <span>Response impact by day {c.day}</span>
          <strong className={avoided >= 0 ? "positive-text" : "negative-text"}>
            {money(Math.abs(avoided))}
          </strong>
          <small>
            {avoided >= 0 ? "less modeled loss" : "more modeled loss"} ·{" "}
            {money(response.responseCost)} response cost
          </small>
        </div>
      </div>
      <div className="cascade-chart">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chart}
            margin={{ top: 10, right: 24, left: 14, bottom: 5 }}
          >
            <CartesianGrid vertical={false} stroke="#e5edf5" />
            <XAxis
              dataKey="day"
              tick={{ fontSize: 10 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={{ fontSize: 10 }}
              tickFormatter={(v) => `$${Math.round(v / 1000)}k`}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              labelFormatter={(v) => `Simulation day ${v}`}
              formatter={(value) => money(Number(value))}
            />
            <ReferenceLine x={c.day} stroke="#7d93a8" strokeDasharray="3 3" />
            <Line
              type="monotone"
              dataKey="baseline"
              name="Original timing"
              stroke="#859bb1"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="delayed"
              name="Delay, no action"
              stroke="#d8871d"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="response"
              name="Delay, with response"
              stroke="#0070f2"
              strokeWidth={2.5}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="cascade-key">
        <span>
          <i style={{ background: "#859bb1" }} />
          Original supplier timing
        </span>
        <span>
          <i style={{ background: "#d8871d" }} />
          Delay, no additional action
        </span>
        <span>
          <i style={{ background: "#0070f2" }} />
          Delay, with response
        </span>
        <span>
          Cumulative scenario sales foregone · product scope / consumer
          locations
        </span>
      </div>
      <div className="cascade-event-preview">
        <strong>What has happened by day {c.day}?</strong>
        {events.length ? (
          <div>
            {events.slice(-4).map((e, i) => (
              <button
                key={`${e.day}-${i}`}
                onClick={() => onChange({ day: e.day })}
              >
                <span>Day {e.day}</span>
                <div>
                  {e.location}
                  <small>
                    {e.message} · {e.sku}
                  </small>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <p>
            No simulated supply or shortage events yet. Move the day slider
            forward.
          </p>
        )}
      </div>
      <div className="cascade-details">
        <button onClick={() => setShowDetails(!showDetails)}>
          {showDetails ? "Hide" : "Show"} assumptions and complete event
          timeline
        </button>
        <span>
          Day {c.horizon} modeled loss: {money(total.cumulativeLoss)} ·
          scenarios do not change saved inventory
        </span>
        {showDetails && (
          <>
            <p>
              Daily demand is the seeded seven-day store scenario divided by
              seven; source stores use their seeded local daily demand; online
              uses 162 weekly OOS sessions × 15% conversion, floored to 24
              units/week. Demand multiplier affects all shown locations. A
              single assumed primary order of {c.inboundWeeks} weeks of original
              demand arrives on each SKU’s primary lead-time day; only the
              selected supplier is delayed. These are hypothetical inbound
              orders, not existing SAP purchase orders.
            </p>
            <label>
              Assumed primary inbound cover
              <Select
                accessibleName="Assumed inbound weeks"
                onChange={(e) =>
                  onChange({
                    inboundWeeks: Number(
                      e.detail.selectedOption.getAttribute("data-weeks"),
                    ),
                  })
                }
              >
                {[2, 4, 6, 8].map((n) => (
                  <Option
                    key={n}
                    selected={c.inboundWeeks === n}
                    data-weeks={n}
                  >
                    {n} weeks of original demand
                  </Option>
                ))}
              </Select>
            </label>
            <p>
              Arrivals are processed before daily allocations and sales.
              Warehouse allocation order is destination store, online, then
              source-store cover, preserving warehouse reserves. Every dispatch
              takes two days. Proposed transfers remain reserved; approved
              transfers dispatch on day 1; existing in-transit transfers arrive
              on day 2. Preview rebalancing dispatches available surplus on day
              1; the alternative response adds 120 cream-M units at day 9 (only
              if Pacific Apparel Co. is the disrupted supplier). Source-store
              sales continue, so transferring stock can move risk to that
              source. Unfulfilled demand is lost rather than backordered;
              estimated sales foregone = unfulfilled units × retail price × 70%.
              Demand across facilities is assumed independent; no seasonal,
              price, traffic or probabilistic effects are modeled.
            </p>
            <div className="table-scroll cascade-events">
              <table>
                <thead>
                  <tr>
                    <th>Day</th>
                    <th>Event</th>
                    <th>Location / SKU</th>
                    <th>Explanation</th>
                  </tr>
                </thead>
                <tbody>
                  {active.events.map((e, i) => (
                    <tr
                      key={i}
                      className={e.day === c.day ? "current-event" : ""}
                    >
                      <td>
                        <button onClick={() => onChange({ day: e.day })}>
                          {e.day}
                        </button>
                      </td>
                      <td>{e.kind}</td>
                      <td>
                        {e.location}
                        <small>{e.sku}</small>
                      </td>
                      <td>{e.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
export function CascadeInspector({
  run,
  day,
  node,
}: {
  run: CascadeRun;
  day: number;
  node: SupplyNode;
}) {
  const snapshot = run.days[day];
  const records = snapshot.records.filter(
    (r) =>
      node.skus.includes(r.sku) &&
      (node.kind === "product" ||
        node.kind === "supplier" ||
        node.id === `location:${r.location}`),
  );
  const final = run.days[run.days.length - 1];
  const selectedEvents = run.events.filter(
    (e) =>
      node.skus.includes(e.sku) &&
      (node.kind === "product" ||
        node.kind === "supplier" ||
        e.location === node.name),
  );
  return (
    <div className="cascade-inspector">
      <h4>Projected downstream state · day {day}</h4>
      <p>Forecast preview; current saved stock is unchanged.</p>
      {records.map((r) => {
        const end = final.records.find((i) => i.id === r.id)!;
        return (
          <div className="cascade-record" key={r.id}>
            <strong>{r.location}</strong>
            <small>{r.sku}</small>
            <span>
              {r.stock.toFixed(1)} units on hand · {r.inbound.toFixed(1)}{" "}
              incoming
            </span>
            <span className={r.unmet > 0 ? "negative-text" : "positive-text"}>
              {r.unmet > 0
                ? `${r.unmet.toFixed(1)} units unfulfilled today`
                : "Daily demand covered / no retail demand"}
            </span>
            <small>
              {end.firstShortage !== null
                ? `First unmet demand: day ${end.firstShortage}`
                : r.id.endsWith("-wh")
                  ? `Dispatch capacity exhausted: ${end.firstCapacity === null ? "not in horizon" : `day ${end.firstCapacity}`}`
                  : "No demand shortfall in the horizon"}
            </small>
          </div>
        );
      })}
      <h4>Upcoming consequences</h4>
      {selectedEvents
        .filter(
          (e) =>
            e.day > day &&
            ["shortage", "supplier-arrival", "recovery"].includes(e.kind),
        )
        .slice(0, 4)
        .map((e, i) => (
          <p key={i}>
            <strong>
              Day {e.day} · {e.location}
            </strong>
            <br />
            {e.message}
          </p>
        ))}
    </div>
  );
}
