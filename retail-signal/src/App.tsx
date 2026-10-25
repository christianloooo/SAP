import { useState, useEffect } from "react";
import {
  Avatar,
  Button,
  Icon,
  Input,
  Select,
  Option,
  MessageStrip,
  ProgressIndicator,
  SideNavigation,
  SideNavigationItem,
} from "@ui5/webcomponents-react";
import {
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
import {
  opportunities,
  freshState,
  initialInventory,
  money,
  demandFor,
  stockFor,
  gapFor,
} from "./data";
import type { Opportunity, Page, DemoState, AuditAction } from "./data";
import { simulate, conversion, priorityScore } from "./analytics";
import type { ScenarioKind } from "./analytics";

import {
  LocationIntelligence,
  RiskSeasonality,
  SapWorkflow,
  ConnectionSettings,
  OpportunityExposure,
} from "./components/PlanningViews";
import SupplyNetwork from "./components/SupplyNetwork";
import { readConnections } from "./connections";
import { proposeTransfer, transferable } from "./planning";

const navItems: { page: Page; icon: string }[] = [
  { page: "Command Center", icon: "home" },
  { page: "Opportunities", icon: "lightbulb" },
  { page: "Demand Intelligence", icon: "line-charts" },
  { page: "Location Intelligence", icon: "map" },
  { page: "Risk & Seasonality", icon: "business-objects-experience" },
  { page: "Inventory & Supply", icon: "shipping-status" },
  { page: "SAP Workflow", icon: "process" },
  { page: "Action Center", icon: "task" },
  { page: "Integrations", icon: "connected" },
];
const trend = [
  { day: "Oct 18", demand: 146, sales: 120 },
  { day: "Oct 19", demand: 158, sales: 126 },
  { day: "Oct 20", demand: 149, sales: 122 },
  { day: "Oct 21", demand: 178, sales: 132 },
  { day: "Oct 22", demand: 191, sales: 128 },
  { day: "Oct 23", demand: 224, sales: 142 },
  { day: "Oct 24", demand: 248, sales: 151 },
];
function loadState(): DemoState {
  try {
    const v = JSON.parse(localStorage.getItem("retail-signal-v1") || "null");
    if (v && Array.isArray(v.inventory) && Array.isArray(v.actions))
      return {
        ...freshState(),
        ...v,
        transfers: Array.isArray(v.transfers) ? v.transfers : [],
        inventory: initialInventory.map((base) => ({
          ...base,
          stock:
            v.inventory.find(
              (i: { id: string; stock: number }) => i.id === base.id,
            )?.stock ?? base.stock,
        })),
      };
  } catch {
    /* recover invalid browser storage */
  }
  return freshState();
}
function Status({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: string;
}) {
  return (
    <span className={`status ${tone}`}>
      <span className="status-dot" />
      {children}
    </span>
  );
}
function Panel({
  title,
  sub,
  action,
  children,
  className = "",
}: {
  title: string;
  sub?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      <div className="panel-heading">
        <div>
          <h3>{title}</h3>
          {sub && <p>{sub}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
function ProductIcon({
  category,
  small = false,
}: {
  category: string;
  small?: boolean;
}) {
  return (
    <div
      className={`product-icon ${small ? "small" : ""} ${category.toLowerCase()}`}
    >
      <svg viewBox="0 0 60 60" aria-hidden="true">
        {category === "Denim" || category === "Bottoms" ? (
          <path d="M19 10h22l4 40H33l-3-26-3 26H15z" />
        ) : (
          <path d="m19 12 7-3q4 6 8 0l7 3 11 12-9 8-5-6v25H22V26l-5 6-9-8z" />
        )}
      </svg>
    </div>
  );
}
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
function Kpi({
  label,
  value,
  unit,
  detail,
  tone,
  icon,
}: {
  label: string;
  value: string | number;
  unit?: string;
  detail: string;
  tone?: string;
  icon: string;
}) {
  return (
    <div className="kpi">
      <div className="kpi-label">
        {label}
        <Icon name={icon} />
      </div>
      <div className={`kpi-value ${tone || ""}`}>
        {value}
        <small>{unit}</small>
      </div>
      <div className="kpi-detail">{detail}</div>
    </div>
  );
}
export default function App() {
  const [connections, setConnections] = useState(readConnections);
  const [page, setPage] = useState<Page>("Command Center");
  const [state, setState] = useState<DemoState>(loadState);
  const [selected, setSelected] = useState<Opportunity | null>(null);
  const [sidebar, setSidebar] = useState(window.innerWidth > 720);
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("All locations");
  const [priority, setPriority] = useState("All priorities");
  const [range, setRange] = useState("Last 7 days");
  const [sort, setSort] = useState("Priority");
  const [assistant, setAssistant] = useState(false);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<{ role: string; text: string }[]>(
    [],
  );
  const [toast, setToast] = useState("");
  const [guide, setGuide] = useState(0);
  const [kind, setKind] = useState<ScenarioKind>("transfer");
  const [qty, setQty] = useState(40);
  const [simulated, setSimulated] = useState(false);
  const [tab, setTab] = useState("Overview");
  const [signalTab, setSignalTab] = useState("In-store signals");
  const [inventoryQuery, setInventoryQuery] = useState("");
  const [supplier, setSupplier] = useState<string | null>(null);
  useEffect(() => {
    localStorage.setItem("retail-signal-v1", JSON.stringify(state));
  }, [state]);
  useEffect(() => {
    if (toast) {
      const id = setTimeout(() => setToast(""), 4500);
      return () => clearTimeout(id);
    }
  }, [toast]);
  const navigate = (p: Page) => {
    setPage(p);
    setSelected(null);
    setSupplier(null);
  };
  const open = (o: Opportunity) => {
    setSelected(o);
    setKind(
      transferable(
        state,
        state.inventory.find((i) => i.id === `${o.id}-source`)!,
      ) > 0
        ? "transfer"
        : "investigate",
    );
    setQty(
      Math.min(
        40,
        transferable(
          state,
          state.inventory.find((i) => i.id === `${o.id}-source`)!,
        ),
      ),
    );
    setSimulated(false);
    setTab("Overview");
  };
  const active = opportunities.filter((o) => !state.dismissed.includes(o.id));
  const filtered = active
    .filter(
      (o) =>
        (o.product + " " + o.sku).toLowerCase().includes(query.toLowerCase()) &&
        (location === "All locations" || o.location === location) &&
        (priority === "All priorities" || o.priority === priority) &&
        (range === "Last 7 days" || o.detected >= "2026-10-22"),
    )
    .sort((a, b) =>
      sort === "Potential value"
        ? gapFor(b, state) * b.price - gapFor(a, state) * a.price
        : { Critical: 0, High: 1, Medium: 2 }[a.priority] -
            { Critical: 0, High: 1, Medium: 2 }[b.priority] ||
          priorityScore(b, state) - priorityScore(a, state),
    );
  const gap = filtered.reduce((sum, o) => sum + gapFor(o, state), 0);
  const potential = filtered.reduce(
    (sum, o) => sum + gapFor(o, state) * o.price,
    0,
  );
  const high = filtered.filter((o) => o.priority !== "Medium").length;
  const notify = (s: string) => setToast(s);
  const addAction = (
    o: Opportunity,
    type: string,
    quantity: number,
    status: AuditAction["status"],
    detail: string,
    next = state,
  ) => {
    const action: AuditAction = {
      id: `ACT-${Date.now().toString().slice(-7)}`,
      opportunity: o.id,
      product: o.product,
      type,
      quantity,
      status,
      owner: "Alex Morgan",
      timestamp: new Date().toISOString(),
      detail,
    };
    setState({ ...next, actions: [action, ...next.actions] });
  };
  const approve = () => {
    if (!selected || !simulated) return;
    const result = simulate(selected, state, kind, qty);
    if (!result.valid) return;
    const already = state.actions.some(
      (a) =>
        a.opportunity === selected.id &&
        a.type === "Replenishment proposal" &&
        a.status === "Pending review",
    );
    if (kind === "replenish" && already) {
      notify("A replenishment proposal is already pending review.");
      return;
    }
    if (kind === "transfer") {
      try {
        const next = proposeTransfer(
          state,
          `${selected.id}-source`,
          `${selected.id}-dest`,
          qty,
        );
        setState(next);
        setSelected(null);
        setPage("SAP Workflow");
        notify(
          "Stock transport proposal created. Approve, dispatch and receive it in SAP Workflow.",
        );
      } catch (error) {
        notify((error as Error).message);
        return;
      }
    } else {
      addAction(
        selected,
        kind === "replenish"
          ? "Replenishment proposal"
          : "Conversion investigation",
        kind === "replenish" ? qty : 0,
        "Pending review",
        kind === "replenish"
          ? "Alternative supplier: 9 days, CAD 14.50/unit. Buyer approval required."
          : "Review availability, fit, price and merchandising. Low conversion alone does not establish cause.",
      );
      notify("Request created in Action Center.");
    }
    setSimulated(false);
    if (kind === "transfer") {
      setKind("investigate");
      setQty(0);
    }
  };
  const ask = (text: string) => {
    const o = selected || opportunities[0],
      source = state.inventory.find((i) => i.id === `${o.id}-source`)!;
    const r = simulate(
      o,
      state,
      "transfer",
      Math.min(40, transferable(state, source)),
    );
    let answer = "";
    if (/transfer|what happens|40|stock|stores/.test(text.toLowerCase()))
      answer = `${source.location} has ${source.stock} units, including a protected reserve of ${source.reserve}. ${r.maximum} units are available for transfer. Moving ${r.qty} units would bring ${o.location} to ${stockFor(o, state) + r.qty} units and cover ${r.coverage}% of the ${demandFor(o, state)}-unit seven-day scenario. Estimated transport cost: ${money(r.cost)}; transit: 2 days. This assumes transferred units can sell within the window.`;
    else if (/supplier|delay|10 days/.test(text.toLowerCase()))
      answer = `${o.supplier} has a ${o.lead}-day lead time${/10/.test(text) ? `, or ${o.lead + 10} days with your additional delay` : ""}. Both are outside the seven-day demand window. An approved alternative has a 9-day lead time at CAD 14.50/unit (capacity: 120). Use a transfer for immediate coverage and request a buyer review for replenishment. Future demand and delivery timing remain uncertain.`;
    else if (/why|flag|recommend|demand|caus/.test(text.toLowerCase()))
      answer = `${o.product}, size ${o.size}, shows ${o.growth}% demand acceleration. ${o.tries} fitting-room interactions produced ${o.purchases} purchases (${conversion(o.purchases, o.tries)}% conversion; baseline ${o.baseline}%). Online, ${o.oos} qualified out-of-stock sessions were observed. Current destination stock: ${stockFor(o, state)} units against a seven-day scenario of ${demandFor(o, state)} units. A transfer addresses the immediate gap; investigate availability, fit, price and merchandising before a larger commitment. Interest is not a guaranteed sale.`;
    else
      answer = `I can explain ${o.product}'s signals, compare available stock, simulate a transfer, or assess supplier delays. Ask “Why is this product flagged?”, “What happens if we transfer 40 units?” or “What if our supplier is delayed by 10 days?” Responses use seeded records and deterministic calculations.`;
    setMessages((m) => [
      ...m,
      { role: "user", text },
      { role: "assistant", text: answer },
    ]);
    setQuestion("");
  };
  const reset = () => {
    setState(freshState());
    setSelected(null);
    setGuide(0);
    setMessages([]);
    notify("Demo reset to the original seeded data.");
  };
  function OpportunitiesTable() {
    return (
      <Panel
        title={`Demand opportunities (${filtered.length})`}
        sub="Prioritized customer intent, connected to inventory and supply"
        action={
          <div className="toolbar">
            <span className="muted">Sort by</span>
            <Select
              accessibleName="Sort opportunities"
              onChange={(e) =>
                setSort(e.detail.selectedOption.textContent || "Priority")
              }
            >
              <Option selected={sort === "Priority"}>Priority</Option>
              <Option selected={sort === "Potential value"}>
                Potential value
              </Option>
            </Select>
            <Button
              icon="download"
              design="Transparent"
              tooltip="Export filtered opportunities"
              onClick={() => {
                const csv =
                  "Opportunity,Product,SKU,Location,Demand,Stock\n" +
                  filtered
                    .map((o) =>
                      [
                        o.id,
                        o.product,
                        o.sku,
                        o.location,
                        demandFor(o, state),
                        stockFor(o, state),
                      ].join(","),
                    )
                    .join("\n");
                const url = URL.createObjectURL(
                  new Blob([csv], { type: "text/csv" }),
                );
                const a = document.createElement("a");
                a.href = url;
                a.download = "retail-opportunities.csv";
                a.click();
                URL.revokeObjectURL(url);
                notify("Filtered opportunities exported.");
              }}
            />
          </div>
        }
      >
        <div className="table-scroll">
          <table className="worklist">
            <thead>
              <tr>
                <th>Product / SKU</th>
                <th>Location</th>
                <th>Priority</th>
                <th>Demand trend</th>
                <th className="numeric">On hand</th>
                <th>Supply status</th>
                <th className="numeric">Potential value¹</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => (
                <tr
                  key={o.id}
                  onClick={() => open(o)}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") open(o);
                  }}
                  aria-label={`Open ${o.product}, size ${o.size}`}
                >
                  <td>
                    <div className="product-cell">
                      <ProductIcon category={o.category} small />
                      <div>
                        <button
                          className="text-link"
                          onClick={(e) => {
                            e.stopPropagation();
                            open(o);
                          }}
                        >
                          {o.product}
                        </button>
                        <small>
                          {o.sku} · {o.color} · {o.size}
                        </small>
                      </div>
                    </div>
                  </td>
                  <td>
                    {o.location}
                    <small>Canada · Retail</small>
                  </td>
                  <td>
                    <Status
                      tone={
                        o.priority === "Critical"
                          ? "negative"
                          : o.priority === "High"
                            ? "warning"
                            : "information"
                      }
                    >
                      {o.priority}
                    </Status>
                  </td>
                  <td>
                    <span className="trend-up">↗ {o.growth}%</span>
                    <small>vs. prior period</small>
                  </td>
                  <td className="numeric">
                    <strong>{stockFor(o, state)}</strong>
                    <small>units</small>
                  </td>
                  <td>
                    <span
                      className={
                        o.risk === "On schedule"
                          ? "positive-text"
                          : "warning-text"
                      }
                    >
                      {o.risk === "On schedule"
                        ? "On schedule"
                        : "Supplier delay"}
                    </span>
                    <small>{o.lead}-day lead time</small>
                  </td>
                  <td className="numeric">
                    <strong>{money(gapFor(o, state) * o.price)}</strong>
                    <small>scenario estimate</small>
                  </td>
                  <td>
                    <Icon name="slim-arrow-right" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filtered.length && (
            <div className="empty">
              <Icon name="search" />
              <h3>No opportunities match these filters</h3>
              <p>Try another product, location or priority.</p>
              <Button
                onClick={() => {
                  setQuery("");
                  setLocation("All locations");
                  setPriority("All priorities");
                  setRange("Last 7 days");
                }}
              >
                Clear filters
              </Button>
            </div>
          )}
        </div>
        <div className="table-footer">
          {filtered.length} opportunities · All values in CAD
          <span>
            ¹ Uncovered scenario units × retail price. Not a sales forecast.
          </span>
        </div>
      </Panel>
    );
  }
  const renderFilters = () => (
    <div className="filter-bar">
      <Field label="Search">
        <Input
          accessibleName="Search products or SKUs"
          placeholder="Product or SKU"
          value={query}
          onInput={(e) => setQuery(e.target.value)}
        />
      </Field>
      <Field label="Location">
        <Select
          accessibleName="Location filter"
          onChange={(e) =>
            setLocation(e.detail.selectedOption.textContent || "All locations")
          }
        >
          {[
            "All locations",
            ...new Set(opportunities.map((o) => o.location)),
          ].map((v) => (
            <Option selected={location === v} key={v}>
              {v}
            </Option>
          ))}
        </Select>
      </Field>
      <Field label="Priority">
        <Select
          accessibleName="Priority filter"
          onChange={(e) =>
            setPriority(e.detail.selectedOption.textContent || "All priorities")
          }
        >
          {["All priorities", "Critical", "High", "Medium"].map((v) => (
            <Option selected={priority === v} key={v}>
              {v}
            </Option>
          ))}
        </Select>
      </Field>
      <Field label="Detected in">
        <Select
          accessibleName="Date range"
          onChange={(e) =>
            setRange(e.detail.selectedOption.textContent || "Last 7 days")
          }
        >
          <Option selected={range === "Last 7 days"}>Last 7 days</Option>
          <Option selected={range === "Last 3 days"}>Last 3 days</Option>
        </Select>
      </Field>
      <Button
        design="Transparent"
        className="clear-filters"
        onClick={() => {
          setQuery("");
          setLocation("All locations");
          setPriority("All priorities");
          setRange("Last 7 days");
        }}
      >
        Reset filters
      </Button>
      <span className="filter-meta">
        <Icon name="history" />
        Snapshot: Oct 24, 2026
      </span>
    </div>
  );
  function Dashboard() {
    const trendData = (range === "Last 3 days" ? trend.slice(-3) : trend).map(
      (t, i) => ({
        ...t,
        demand:
          Math.round((t.demand * filtered.length) / 6) +
          (state.spike && i === (range === "Last 3 days" ? 2 : 6) ? 24 : 0),
        sales: Math.round((t.sales * filtered.length) / 6),
      }),
    );
    return (
      <>
        <div className="planning-entry-banner">
          <Icon name="map" />
          <div>
            <h3>See where demand needs a response</h3>
            <p>
              Location alerts, no-action sales risk and SAP stock transport
              proposals share the same inventory.
            </p>
          </div>
          <Button onClick={() => navigate("Location Intelligence")}>
            Open location map
          </Button>
          <Button
            design="Transparent"
            onClick={() => navigate("Risk & Seasonality")}
          >
            Explore sales risk
          </Button>
        </div>
        <div className="kpi-grid">
          <Kpi
            label="Priority opportunities"
            value={high.toString().padStart(2, "0")}
            detail={`${filtered.length} total opportunities detected`}
            icon="lightbulb"
            tone="blue"
          />
          <Kpi
            label="Uncovered demand"
            value={gap}
            unit="units"
            detail="7-day scenario · after on-hand stock"
            icon="cart"
            tone="warning-text"
          />
          <Kpi
            label="Potential sales at risk¹"
            value={(potential / 1000).toFixed(1)}
            unit="K CAD"
            detail="Scenario-based retail value"
            icon="business-objects-experience"
          />
          <Kpi
            label="Supplier disruptions"
            value={new Set(
              filtered
                .filter((o) => o.risk !== "On schedule")
                .map((o) => o.supplier),
            ).size
              .toString()
              .padStart(2, "0")}
            detail="Active suppliers requiring attention"
            icon="shipping-status"
            tone="warning-text"
          />
        </div>
        <div className="analysis-grid">
          <Panel
            title="Customer intent is outpacing sales"
            sub="Daily qualified interactions and completed purchases"
            action={<Status tone="information">{range}</Status>}
          >
            <div className="chart-legend">
              <span>
                <i className="legend-dot intent" />
                Customer intent
              </span>
              <span>
                <i className="legend-dot sales" />
                Completed purchases
              </span>
              <span className="muted">
                Illustrative event history · current filters
              </span>
            </div>
            <div className="trend-chart">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={trendData}
                  margin={{ top: 8, right: 25, bottom: 0, left: 0 }}
                >
                  <defs>
                    <linearGradient id="demandFill" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="0%"
                        stopColor="#0070f2"
                        stopOpacity={0.15}
                      />
                      <stop offset="100%" stopColor="#0070f2" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="#e8ecf1" />
                  <XAxis
                    dataKey="day"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11, fill: "#647387" }}
                    dy={8}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11, fill: "#647387" }}
                    width={40}
                  />
                  <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                  <Area
                    isAnimationActive={false}
                    type="monotone"
                    dataKey="demand"
                    name="Customer intent"
                    stroke="#0070f2"
                    strokeWidth={2.5}
                    fill="url(#demandFill)"
                  />
                  <Area
                    isAnimationActive={false}
                    type="monotone"
                    dataKey="sales"
                    name="Completed purchases"
                    stroke="#839bb5"
                    strokeDasharray="4 4"
                    strokeWidth={2}
                    fill="transparent"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="chart-insight">
              <Icon name="information" />
              Intent includes fitting-room and qualified digital sessions; it is
              not unit demand.
            </div>
          </Panel>
          <Panel
            title="Recommended next step"
            sub="Featured opportunity · Vancouver Downtown"
            className="recommendation-panel"
          >
            <div className="rec-product">
              <ProductIcon category="Tops" />
              <div>
                <Status tone="negative">Critical priority</Status>
                <h3>Essential Ribbed Top</h3>
                <p>Cream · Size M · Vancouver Downtown</p>
              </div>
            </div>
            <p className="rec-copy">
              Strong interest. Limited availability.
              <br />
              {state.inventory[1].stock > state.inventory[1].reserve
                ? "Rebalance stock before placing a larger order."
                : "Transfer complete. Review the remaining demand gap."}
            </p>
            <div className="transfer-mini">
              <div>
                <strong>{transferable(state, state.inventory[1])}</strong>
                <span>transferable units</span>
              </div>
              <Icon name="arrow-right" />
              <div>
                <strong>
                  2 <small>days</small>
                </strong>
                <span>estimated transit</span>
              </div>
            </div>
            <Button design="Emphasized" onClick={() => open(opportunities[0])}>
              Review opportunity
              <Icon name="slim-arrow-right" />
            </Button>
            <span className="recommendation-note">
              Grounded in demand, inventory and supplier data
            </span>
          </Panel>
        </div>
        <OpportunitiesTable />
      </>
    );
  }
  function Detail() {
    if (!selected) return null;
    const o = selected,
      r = simulate(o, state, kind, qty),
      records = state.inventory.filter((i) => i.sku === o.sku),
      source = records[1];
    return (
      <>
        <div className="object-header">
          <ProductIcon category={o.category} />
          <div className="object-title">
            <span className="eyebrow">DEMAND OPPORTUNITY · {o.id}</span>
            <h1>{o.product}</h1>
            <p>
              {o.sku} <span>•</span> {o.color} <span>•</span> Size {o.size}{" "}
              <span>•</span> {o.location}
            </p>
          </div>
          <div className="object-status">
            <Status tone={o.priority === "Critical" ? "negative" : "warning"}>
              {o.priority} priority
            </Status>
            <small>Rule-based score: {priorityScore(o, state)}/100</small>
          </div>
        </div>
        <div className="object-metrics">
          <div>
            <span>Demand acceleration</span>
            <strong className="positive-text">+{o.growth}%</strong>
          </div>
          <div>
            <span>Try-on conversion</span>
            <strong>
              {conversion(o.purchases, o.tries)}%{" "}
              <small>/ {o.baseline}% baseline</small>
            </strong>
          </div>
          <div>
            <span>Available at destination</span>
            <strong>
              {stockFor(o, state)} <small>units</small>
            </strong>
          </div>
          <div>
            <span>7-day demand scenario</span>
            <strong>
              {demandFor(o, state)} <small>units</small>
            </strong>
          </div>
          <div>
            <span>Potential sales at risk</span>
            <strong>{money(gapFor(o, state) * o.price)}</strong>
          </div>
        </div>
        <div className="tabs">
          {["Overview", "Evidence & inventory", "Action history"].map((t) => (
            <button
              className={tab === t ? "active" : ""}
              key={t}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="detail-content">
          <OpportunityExposure state={state} opportunity={o} />
          {tab === "Overview" ? (
            <>
              <div className="summary-strip">
                <div className="joule-mark">✧</div>
                <div>
                  <h3>Connected signals. One coordinated response.</h3>
                  <p>
                    {o.tries} try-ons and {o.oos} out-of-stock digital sessions
                    indicate customer interest. {source.location} can release{" "}
                    <strong>{transferable(state, source)} units</strong> while
                    protecting its reserve.{" "}
                    {transferable(state, source) > 0
                      ? `With the primary supplier at ${o.lead} days, a transfer is the fastest available response.`
                      : "The source reserve is now protected. Investigate conversion and review replenishment for the remaining gap."}
                  </p>
                  <small>
                    Simulated assistant · Deterministic explanation · Interest
                    does not guarantee sales
                  </small>
                </div>
                <Button
                  design="Transparent"
                  onClick={() => {
                    setAssistant(true);
                    ask("Why are you recommending this action?");
                  }}
                >
                  Ask assistant
                </Button>
              </div>
              <div className="decision-grid">
                <Panel
                  title="Response options"
                  sub="Compare actions against available stock and lead times"
                >
                  <div className="scenario-options">
                    {(
                      [
                        {
                          id: "transfer",
                          title: "Transfer available stock",
                          sub: `${source.location} → ${o.location}`,
                          badge: "Recommended",
                          icon: "shipping-status",
                        },
                        {
                          id: "replenish",
                          title: "Alternative supplier",
                          sub: "120-unit capacity · 9 days · CAD 14.50/unit",
                          badge: "Buyer review",
                          icon: "factory",
                        },
                        {
                          id: "investigate",
                          title: "Investigate conversion",
                          sub: "Review availability, fit, pricing and merchandising",
                          badge: "3-day review",
                          icon: "inspect",
                        },
                      ] as const
                    ).map((option) => (
                      <button
                        key={option.id}
                        disabled={
                          option.id === "replenish" && o.id !== "OPP-1042"
                        }
                        title={
                          option.id === "replenish" && o.id !== "OPP-1042"
                            ? "No approved alternative is configured for this SKU"
                            : undefined
                        }
                        className={`scenario-option ${kind === option.id ? "selected" : ""}`}
                        onClick={() => {
                          setKind(option.id);
                          setQty(
                            option.id === "transfer"
                              ? Math.min(40, transferable(state, source))
                              : 120,
                          );
                          setSimulated(false);
                        }}
                      >
                        <span className="radio-dot" />
                        <Icon name={option.icon} />
                        <span>
                          <strong>{option.title}</strong>
                          <small>
                            {option.id === "replenish" && o.id !== "OPP-1042"
                              ? "No approved alternative configured for this SKU"
                              : option.sub}
                          </small>
                        </span>
                        <span className="option-badge">{option.badge}</span>
                      </button>
                    ))}
                  </div>
                  <div className="quantity-row">
                    {kind !== "investigate" ? (
                      <Field
                        label={
                          kind === "transfer"
                            ? "Transfer quantity"
                            : "Order quantity"
                        }
                      >
                        <Input
                          accessibleName="Scenario quantity"
                          type="Number"
                          value={String(qty)}
                          onInput={(e) => {
                            setQty(Number(e.target.value));
                            setSimulated(false);
                          }}
                        />
                      </Field>
                    ) : (
                      <p className="muted">
                        A review creates a task; it does not change stock.
                      </p>
                    )}
                    <div className="quantity-note">
                      {kind === "transfer"
                        ? `${r.maximum} units available · reserve protected`
                        : kind === "replenish"
                          ? "Capacity: 120 units · +CAD 2.50 vs. primary supplier"
                          : "Owner: Retail Operations"}
                    </div>
                    <Button
                      design="Emphasized"
                      icon="simulate"
                      disabled={!r.valid}
                      onClick={() => setSimulated(true)}
                    >
                      Simulate
                    </Button>
                  </div>
                  {!r.valid && (
                    <div className="inline-error">
                      {r.maximum > 0
                        ? `Enter a whole quantity from 1 to ${r.maximum} units.`
                        : "No additional units are available for this response. Choose another option."}
                    </div>
                  )}
                  <div className="assumption">
                    <Icon name="information" />
                    Seven-day coverage includes stock on hand and feasible
                    transfers. Supplier delivery at day 9 falls outside this
                    window.
                  </div>
                </Panel>
                <Panel
                  title="Scenario impact"
                  sub={
                    simulated
                      ? "Calculated from current demo records"
                      : "Simulate an option to compare the outcome"
                  }
                >
                  {simulated ? (
                    <>
                      <div className="impact-main">
                        <span>Demand coverage</span>
                        <strong>{r.coverage}%</strong>
                        <ProgressIndicator
                          value={r.coverage}
                          displayValue={`${r.coverage}%`}
                          valueState={
                            r.coverage >= 50 ? "Positive" : "Critical"
                          }
                        />
                        <small>
                          Current:{" "}
                          {Math.round(
                            (stockFor(o, state) / demandFor(o, state)) * 100,
                          )}
                          % · Seven-day scenario
                        </small>
                      </div>
                      <dl className="impact-list">
                        <div>
                          <dt>Units moved / ordered</dt>
                          <dd>{r.qty}</dd>
                        </div>
                        <div>
                          <dt>Expected lead time</dt>
                          <dd>{r.days} days</dd>
                        </div>
                        <div>
                          <dt>
                            {kind === "replenish"
                              ? "Order cost"
                              : "Incremental cost"}
                          </dt>
                          <dd>{money(r.cost)}</dd>
                        </div>
                        <div>
                          <dt>Demand remaining uncovered</dt>
                          <dd>{r.remaining} units</dd>
                        </div>
                        <div>
                          <dt>Retail value covered¹</dt>
                          <dd className="positive-text">{money(r.revenue)}</dd>
                        </div>
                      </dl>
                      <Button
                        className="full-width"
                        design="Emphasized"
                        onClick={approve}
                      >
                        {kind === "transfer"
                          ? "Create transfer proposal"
                          : "Request approval"}
                      </Button>
                      <p className="fine-print">
                        {kind === "transfer"
                          ? "Proposal reserves source stock. Complete approval, goods issue and receipt in SAP Workflow. No live SAP transaction is created."
                          : "Creates a pending review. Inventory changes only after fulfillment; no real order is placed."}
                      </p>
                    </>
                  ) : (
                    <div className="simulation-empty">
                      <Icon name="simulate" />
                      <h3>Make an informed decision</h3>
                      <p>
                        Select an option and simulate its impact on coverage,
                        cost and remaining demand.
                      </p>
                    </div>
                  )}
                </Panel>
              </div>
              <div className="bottom-actions">
                <Button
                  icon="discussion"
                  onClick={() => {
                    addAction(
                      o,
                      "Planner review",
                      0,
                      "Pending review",
                      "Review customer intent and conversion evidence.",
                    );
                    notify("Planner review requested.");
                  }}
                >
                  Request review
                </Button>
                <Button
                  design="Transparent"
                  onClick={() => {
                    addAction(
                      o,
                      "Opportunity dismissal",
                      0,
                      "Dismissed",
                      "Planner dismissed from active worklist.",
                      { ...state, dismissed: [...state.dismissed, o.id] },
                    );
                    setSelected(null);
                    notify("Opportunity dismissed. Audit entry retained.");
                  }}
                >
                  Dismiss opportunity
                </Button>
                <span>
                  ¹ Illustrative retail value, before conversion uncertainty,
                  returns and margin.
                </span>
              </div>
            </>
          ) : tab === "Evidence & inventory" ? (
            <>
              <div className="evidence-grid">
                <Kpi
                  label="Fitting-room interactions"
                  value={o.tries}
                  icon="customer"
                  detail={`${o.purchases} purchases · ${conversion(o.purchases, o.tries)}% conversion`}
                />
                <Kpi
                  label="Online product searches"
                  value={o.searches}
                  icon="search"
                  detail="Qualified unique sessions · bots excluded"
                />
                <Kpi
                  label="Out-of-stock interest"
                  value={o.oos}
                  icon="cart"
                  detail="Unique sessions, deduplicated within channel"
                />
                <Kpi
                  label="Primary supplier"
                  value={o.lead}
                  unit="days"
                  icon="factory"
                  detail={`${o.supplier} · ${o.risk}`}
                />
              </div>
              <Panel
                title="Inventory availability"
                sub="Stock is shared across the command center, decision center and network view"
              >
                <InventoryTable records={records} />
              </Panel>
              <MessageStrip design="Information" hideCloseButton>
                Low conversion can reflect fit, stock availability, pricing or
                merchandising. Review evidence before assigning a cause. No
                cross-channel identity matching is assumed.
              </MessageStrip>
            </>
          ) : (
            <Activity opportunity={o.id} />
          )}
        </div>
      </>
    );
  }
  function InventoryTable({ records }: { records: DemoState["inventory"] }) {
    return (
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Location</th>
              <th>SKU</th>
              <th>Location type</th>
              <th className="numeric">On hand</th>
              <th className="numeric">Protected reserve</th>
              <th className="numeric">Transferable</th>
              <th className="numeric">Coverage</th>
            </tr>
          </thead>
          <tbody>
            {records.map((i) => (
              <tr key={i.id}>
                <td>
                  <Icon
                    name={i.type === "Store" ? "retail-store" : "building"}
                  />{" "}
                  {i.location}
                </td>
                <td>{i.sku}</td>
                <td>{i.type}</td>
                <td className="numeric">
                  <strong>{i.stock}</strong>
                </td>
                <td className="numeric">{i.reserve}</td>
                <td className="numeric">{transferable(state, i)}</td>
                <td className="numeric">
                  <span
                    className={
                      i.stock / i.daily < 3 ? "negative-text" : "positive-text"
                    }
                  >
                    {(i.stock / i.daily).toFixed(1)} days
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  function Activity({ opportunity }: { opportunity?: string }) {
    const actions = state.actions.filter(
      (a) => !opportunity || a.opportunity === opportunity,
    );
    return (
      <Panel
        title={`Action history (${actions.length})`}
        sub="Planner decisions and simulated execution · all timestamps in Vancouver time"
      >
        {actions.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Action / reference</th>
                  <th>Product</th>
                  <th>Quantity</th>
                  <th>Status</th>
                  <th>Owner</th>
                  <th>Timestamp</th>
                  <th>Audit detail</th>
                </tr>
              </thead>
              <tbody>
                {actions.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <strong>{a.type}</strong>
                      <small>{a.id}</small>
                    </td>
                    <td>
                      <button
                        className="text-link"
                        onClick={() =>
                          open(
                            opportunities.find((o) => o.id === a.opportunity)!,
                          )
                        }
                      >
                        {a.product}
                      </button>
                      <small>{a.opportunity}</small>
                    </td>
                    <td>{a.quantity || "—"}</td>
                    <td>
                      <Status
                        tone={
                          a.status === "Completed"
                            ? "positive"
                            : a.status === "Pending review"
                              ? "warning"
                              : "neutral"
                        }
                      >
                        {a.status}
                      </Status>
                    </td>
                    <td>{a.owner}</td>
                    <td>
                      {new Date(a.timestamp).toLocaleString("en-CA", {
                        timeZone: "America/Vancouver",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="audit-detail">{a.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty">
            <Icon name="task" />
            <h3>Your decisions will appear here</h3>
            <p>
              Review an opportunity, simulate a response and approve a demo
              action.
            </p>
            <Button design="Emphasized" onClick={() => open(opportunities[0])}>
              Review priority opportunity
            </Button>
          </div>
        )}
      </Panel>
    );
  }
  function Demand() {
    return (
      <>
        <div className="section-intro">
          <div>
            <h2>See the intent behind the transaction</h2>
            <p>
              Two sources of customer interest, connected to the same
              opportunities.
            </p>
          </div>
          <Status tone="information">Seeded event data</Status>
        </div>
        <div className="tabs inset-tabs">
          {["In-store signals", "Online signals"].map((t) => (
            <button
              className={signalTab === t ? "active" : ""}
              onClick={() => setSignalTab(t)}
              key={t}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="analysis-grid demand-grid">
          <Panel
            title={
              signalTab === "In-store signals"
                ? "Try-on conversion by product"
                : "Qualified digital interest"
            }
            sub={
              signalTab === "In-store signals"
                ? "Completed purchases ÷ fitting-room interactions"
                : "Unique search sessions and out-of-stock sessions"
            }
          >
            <div className="bar-chart">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={filtered.map((o) => ({
                    name:
                      o.product.length > 20
                        ? o.product.slice(0, 19) + "…"
                        : o.product,
                    conversion: conversion(o.purchases, o.tries),
                    baseline: o.baseline,
                    searches: o.searches,
                    oos: o.oos,
                  }))}
                  margin={{ top: 10, right: 20, left: 0, bottom: 25 }}
                >
                  <CartesianGrid vertical={false} stroke="#e8ecf1" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 10 }}
                    interval={0}
                    angle={-12}
                    textAnchor="end"
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip />
                  <Bar
                    isAnimationActive={false}
                    dataKey={
                      signalTab === "In-store signals"
                        ? "conversion"
                        : "searches"
                    }
                    fill="#0070f2"
                    name={
                      signalTab === "In-store signals"
                        ? "Conversion %"
                        : "Searches"
                    }
                    radius={[3, 3, 0, 0]}
                  />
                  <Bar
                    isAnimationActive={false}
                    dataKey={
                      signalTab === "In-store signals" ? "baseline" : "oos"
                    }
                    fill="#a8c7ed"
                    name={
                      signalTab === "In-store signals"
                        ? "Baseline %"
                        : "Out-of-stock sessions"
                    }
                    radius={[3, 3, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>
          <Panel title="How signals are qualified" sub="Transparent analytics">
            <div className="method-list">
              <div>
                <Icon name="filter" />
                <div>
                  <h4>Unique sessions</h4>
                  <p>
                    Digital signals use unique session + SKU pairs. Repeat views
                    within a session count once.
                  </p>
                </div>
              </div>
              <div>
                <Icon name="shield" />
                <div>
                  <h4>Bot traffic excluded</h4>
                  <p>
                    The seeded qualified aggregates exclude events marked as
                    bots. No live tracking is connected.
                  </p>
                </div>
              </div>
              <div>
                <Icon name="chain-link" />
                <div>
                  <h4>One opportunity per SKU and location</h4>
                  <p>
                    Signals connect through product and location. They are not
                    summed into a cross-channel customer count.
                  </p>
                </div>
              </div>
            </div>
          </Panel>
        </div>
        <OpportunitiesTable />
      </>
    );
  }
  function Network() {
    const records = state.inventory.filter((i) =>
      (i.location + " " + i.sku)
        .toLowerCase()
        .includes(inventoryQuery.toLowerCase()),
    );
    return (
      <>
        <SupplyNetwork
          state={state}
          onState={setState}
          onOpportunity={open}
          onWorkflow={() => navigate("SAP Workflow")}
          notify={notify}
        />
        <Panel
          title="Inventory network"
          sub="Shared stock records behind the relationship graph"
          action={
            <Input
              accessibleName="Search inventory"
              placeholder="Search location or SKU"
              value={inventoryQuery}
              onInput={(e) => setInventoryQuery(e.target.value)}
            />
          }
        >
          <InventoryTable records={records} />
          {!records.length && (
            <div className="empty">No matching inventory records.</div>
          )}
        </Panel>
        <Panel
          title="Supplier constraints"
          sub="Inspect a supplier to find dependent opportunities"
        >
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Supplier</th>
                  <th>Status</th>
                  <th>Lead time</th>
                  <th>Cost per unit</th>
                  <th>Capacity</th>
                  <th>Linked opportunities</th>
                </tr>
              </thead>
              <tbody>
                {[
                  [
                    "Pacific Apparel Co.",
                    "Delayed",
                    "21 days",
                    "CAD 12.00",
                    "180 units",
                    "3",
                  ],
                  [
                    "Denim Works",
                    "Delayed",
                    "18 days",
                    "CAD 28.00",
                    "90 units",
                    "1",
                  ],
                  [
                    "Atelier Textile",
                    "On schedule",
                    "12 days",
                    "CAD 24.00",
                    "140 units",
                    "1",
                  ],
                  [
                    "Northern Knit",
                    "On schedule",
                    "14 days",
                    "CAD 38.00",
                    "80 units",
                    "1",
                  ],
                  [
                    "Coastal Textiles · Alternative",
                    "On schedule",
                    "9 days",
                    "CAD 14.50",
                    "120 units",
                    "1",
                  ],
                ].map((row) => (
                  <tr key={row[0]}>
                    <td>
                      <button
                        className="text-link"
                        onClick={() => setSupplier(row[0])}
                      >
                        {row[0]}
                      </button>
                    </td>
                    <td>
                      <Status
                        tone={row[1] === "Delayed" ? "warning" : "positive"}
                      >
                        {row[1]}
                      </Status>
                    </td>
                    {row.slice(2).map((c, i) => (
                      <td key={i}>{c}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
        {supplier && (
          <Panel
            title={`${supplier} · dependent opportunities`}
            action={
              <Button
                design="Transparent"
                icon="decline"
                accessibleName="Close supplier details"
                onClick={() => setSupplier(null)}
              />
            }
          >
            <div className="supplier-links">
              {opportunities
                .filter(
                  (o) =>
                    o.supplier === supplier ||
                    (supplier.startsWith("Coastal") && o.id === "OPP-1042"),
                )
                .map((o) => (
                  <Button
                    key={o.id}
                    design="Transparent"
                    onClick={() => open(o)}
                  >
                    {o.id} · {o.product} · {o.size}
                    <Icon name="slim-arrow-right" />
                  </Button>
                ))}
            </div>
          </Panel>
        )}
      </>
    );
  }
  const sapProducts = [
    {
      name: "SAP Customer Activity Repository",
      icon: "database",
      role: "Omnichannel transactions and inventory visibility",
      url: "https://help.sap.com/docs/CARAB/e95c8443f589486bbfec99331049704a/95c8fc53f8149438e10000000a44176d.html",
    },
    {
      name: "SAP Commerce Cloud",
      icon: "cart",
      role: "Commerce context; proposed qualified digital intent feed",
      url: "https://www.sap.com/products/crm/commerce-cloud.html",
    },
    {
      name: "SAP S/4HANA",
      icon: "inventory",
      role: "Inventory, purchasing and business transactions",
      url: "https://www.sap.com/products/erp/s4hana.html",
    },
    {
      name: "SAP Integrated Business Planning",
      icon: "line-charts",
      role: "Demand, inventory and supply planning; what-if scenarios",
      url: "https://www.sap.com/products/scm/integrated-business-planning.html",
    },
    {
      name: "SAP Integration Suite on BTP",
      icon: "connected",
      role: "Proposed integration and enterprise workflow extension layer",
      url: "https://www.sap.com/products/technology-platform/integration-suite.html",
    },
    {
      name: "SAP Joule",
      icon: "ai",
      role: "Potential contextual assistance; deterministic demo substitute",
      url: "https://help.sap.com/docs/joule/integrating-joule-with-sap/integrating-your-sap-solution",
    },
  ];
  function Integrations() {
    return (
      <>
        <ConnectionSettings
          connections={connections}
          onConnections={setConnections}
          notify={notify}
        />
        <MessageStrip design="Information" hideCloseButton>
          All connectors are simulated. No SAP tenant, credentials, live API
          access or production transactions are configured.
        </MessageStrip>
        <Panel
          title="An extension to the SAP retail ecosystem"
          sub="Proposed architecture · existing SAP responsibilities remain in their source systems"
        >
          <div className="architecture">
            <div className="arch-sources">
              <div>
                <Icon name="customer" />
                Fitting-room intent<small>Proposed event source</small>
              </div>
              <div>
                <Icon name="cart" />
                Digital interest<small>Qualified session aggregates</small>
              </div>
              <div>
                <Icon name="database" />
                Enterprise records<small>Inventory, sales, supplier data</small>
              </div>
            </div>
            <div className="arch-arrow">↓</div>
            <div className="arch-integration">
              <Icon name="connected" /> SAP BTP / Integration Suite{" "}
              <span>Proposed orchestration</span>
            </div>
            <div className="arch-arrow">↓</div>
            <div className="arch-engine">
              <div>
                <img src="/sap.svg" alt="SAP" />
                <h3>Retail Signal</h3>
                <Status tone="information">Competition concept</Status>
              </div>
              <p>
                Detect intent → connect evidence → evaluate constraints →
                simulate → approve → measure
              </p>
            </div>
            <div className="arch-arrow">↓</div>
            <div className="arch-output">
              <span>S/4HANA · Operational transactions</span>
              <span>IBP · Planning handoff</span>
              <span>Joule · Contextual guidance</span>
            </div>
          </div>
        </Panel>
        <div className="integration-grid">
          {sapProducts.map((c) => (
            <Panel
              title={c.name}
              key={c.name}
              action={<Status tone="warning">Simulated</Status>}
            >
              <div className="connector-body">
                <Icon name={c.icon} />
                <p>{c.role}</p>
              </div>
              <a href={c.url} target="_blank" rel="noreferrer">
                Official SAP documentation <Icon name="action" />
              </a>
            </Panel>
          ))}
        </div>
      </>
    );
  }
  function About() {
    return (
      <div className="about">
        <Panel
          title="From customer intent to coordinated retail action"
          sub="SAP Retail Signal · Independent competition concept"
        >
          <p>
            Sales capture purchases. They do not capture every shopper who tried
            a size, searched for an unavailable product or left without buying.
            Retail Signal gives a merchandise planner one place to examine those
            signals alongside inventory and supplier constraints.
          </p>
          <h3>One connected planning workflow</h3>
          <p>
            Detect → Analyze → Evaluate → Recommend → Act → Measure. Earlier
            intent signals enrich existing SAP processes; this concept
            complements ERP and planning systems.
          </p>
          <h3>What this demo proves</h3>
          <p>
            A consistent data model connects the worklist, inventory, scenario
            comparison and action history. Approved simulated transfers conserve
            stock and respect source reserves. Coverage and potential retail
            value recalculate from the changed records.
          </p>
          <h3>What remains a product hypothesis</h3>
          <p>
            Earlier signals may help planners find unmet demand and respond
            sooner. No customer study, production deployment, measured ROI or
            validated conversion model is claimed.
          </p>
          <h3>Formulas and assumptions</h3>
          <dl className="formulas">
            <div>
              <dt>Conversion</dt>
              <dd>
                Completed purchases ÷ fitting-room interactions × 100. Seeded
                aggregate attribution is illustrative.
              </dd>
            </div>
            <div>
              <dt>Uncovered demand</dt>
              <dd>
                max(0, seven-day scenario units − destination stock). Scenario
                units are planner assumptions, not event counts or a trained
                forecast.
              </dd>
            </div>
            <div>
              <dt>Potential sales at risk</dt>
              <dd>
                Uncovered units × retail price. Excludes conversion uncertainty,
                margin, returns and costs.
              </dd>
            </div>
            <div>
              <dt>Transfer capacity</dt>
              <dd>
                Source stock − protected reserve. Transfers cost CAD 1.50/unit
                and take two days.
              </dd>
            </div>
            <div>
              <dt>Coverage</dt>
              <dd>
                (Destination stock + feasible transfer units) ÷ seven-day demand
                scenario, capped at 100%. Assumes timely receipt.
              </dd>
            </div>
            <div>
              <dt>Stock coverage</dt>
              <dd>
                On-hand stock ÷ seeded daily unit demand for each location.
              </dd>
            </div>
            <div>
              <dt>Priority score</dt>
              <dd>
                min(100, uncovered proportion × 50 + demand growth % × 0.7 + 15
                if lead time exceeds 14 days). A ranking rule, not confidence.
              </dd>
            </div>
            <div>
              <dt>Demand acceleration</dt>
              <dd>
                Seeded percentage change from the prior seven-day qualified
                signal period. The chart shows separate illustrative daily
                aggregates.
              </dd>
            </div>
          </dl>
          <p>
            Digital aggregates deduplicate sessions per SKU and exclude
            simulated bot events. Cross-channel identities are not matched. Data
            is stored only in this browser. The assistant uses deterministic
            responses, without an authenticated Joule connection.
          </p>
          <h3>Design and SAP references</h3>
          <ul>
            <li>
              <a
                href="https://experience.sap.com/fiori-design-web/analytical-list-page/"
                target="_blank"
                rel="noreferrer"
              >
                SAP Fiori analytical list page
              </a>
            </li>
            <li>
              <a
                href="https://ui5.github.io/webcomponents-react/"
                target="_blank"
                rel="noreferrer"
              >
                UI5 Web Components for React
              </a>
            </li>
            {sapProducts.map((c) => (
              <li key={c.name}>
                <a href={c.url} target="_blank" rel="noreferrer">
                  {c.name}
                </a>{" "}
                — {c.role}
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    );
  }
  const guideSteps = [
    "Start with the critical opportunity. Customer intent is growing faster than completed sales.",
    "Review the connected signals: try-ons, conversion, online interest and stock availability.",
    "Simulate a 40-unit transfer, then create a stock transport proposal.",
    "In SAP Workflow, approve the proposal, post demo goods issue, and post demo goods receipt. Then inspect the updated stock and risk.",
  ];
  return (
    <div className="app">
      <header className="enterprise-shell">
        <Button
          icon="menu2"
          design="Transparent"
          accessibleName="Toggle navigation"
          onClick={() => setSidebar(!sidebar)}
        />
        <button
          className="shell-brand"
          onClick={() => navigate("Command Center")}
        >
          <img src="/sap.svg" alt="SAP" />
          <strong>Retail Signal</strong>
        </button>
        <span className="shell-context">Retail Intelligence</span>
        <div className="shell-spacer" />
        <Button
          icon="sys-help"
          design="Transparent"
          accessibleName="About Retail Signal"
          onClick={() => navigate("About Retail Signal")}
        />
        <Button
          icon="bell"
          design="Transparent"
          accessibleName="View action notifications"
          onClick={() => navigate("Action Center")}
        />
        <Avatar initials="AM" colorScheme="Accent6" size="XS" />
      </header>
      <div className="app-layout">
        {sidebar && (
          <aside className="sidebar">
            <div className="workspace-label">RETAIL WORKSPACE</div>
            <SideNavigation
              onSelectionChange={(e) => {
                const name = e.detail.item.getAttribute("data-page") as Page;
                if (name) navigate(name);
              }}
              fixedItems={
                <>
                  <SideNavigationItem
                    text="About Retail Signal"
                    icon="hint"
                    data-page="About Retail Signal"
                  />
                  <SideNavigationItem
                    text="Reset demo"
                    icon="reset"
                    onClick={reset}
                  />
                </>
              }
            >
              {navItems.map((n) => (
                <SideNavigationItem
                  text={n.page}
                  icon={n.icon}
                  key={n.page}
                  data-page={n.page}
                  selected={page === n.page && !selected}
                />
              ))}
            </SideNavigation>
            <div className="sidebar-foot">
              <span className="demo-indicator" />
              Competition concept
              <small>Simulated data · No live SAP connection</small>
            </div>
          </aside>
        )}
        <main>
          <div className="breadcrumb">
            <button onClick={() => navigate("Command Center")}>
              Retail Intelligence
            </button>
            <Icon name="slim-arrow-right" />
            {selected ? (
              <>
                <button onClick={() => setSelected(null)}>{page}</button>
                <Icon name="slim-arrow-right" />
                <span>{selected.id}</span>
              </>
            ) : (
              <span>{page}</span>
            )}
            <span className="environment-label">DEMO ENVIRONMENT</span>
          </div>
          {selected ? (
            Detail()
          ) : (
            <>
              <header className="page-header">
                <div>
                  <div className="page-title">
                    <h1>{page}</h1>
                    {page === "Command Center" && (
                      <span className="variant">
                        Standard <Icon name="slim-arrow-down" />
                      </span>
                    )}
                  </div>
                  <p>
                    {page === "Command Center"
                      ? "Turn emerging customer intent into coordinated retail action."
                      : page === "Opportunities"
                        ? "Review, prioritize and respond to connected demand signals."
                        : page === "Demand Intelligence"
                          ? "Understand customer interest across stores and digital channels."
                          : page === "Inventory & Supply"
                            ? "Evaluate available stock, fulfillment routes and supplier constraints."
                            : page === "Action Center"
                              ? "Track decisions, simulated execution and operational follow-up."
                              : page === "Location Intelligence"
                                ? "Find demand hotspots, stock shortages and feasible transfers on the map."
                                : page === "Risk & Seasonality"
                                  ? "Compare the cost of inaction, online availability and seasonal planning."
                                  : page === "SAP Workflow"
                                    ? "Follow stock transport proposals through approval, goods issue and goods receipt."
                                    : page === "Integrations"
                                      ? "Connect earlier customer intent to the SAP enterprise landscape."
                                      : "The product, assumptions and evidence behind this concept."}
                  </p>
                </div>
                <div className="page-actions">
                  {page === "Command Center" && (
                    <>
                      <Button icon="media-play" onClick={() => setGuide(1)}>
                        Guided demo
                      </Button>
                      <Button
                        design="Emphasized"
                        icon="add"
                        disabled={state.spike}
                        onClick={() => {
                          setState({ ...state, spike: true });
                          notify(
                            "24 scenario demand units added to Essential Ribbed Top, size M.",
                          );
                        }}
                      >
                        Simulate demand spike
                      </Button>
                    </>
                  )}
                  <Button
                    icon="ai"
                    design={
                      page === "Command Center" ? "Transparent" : "Default"
                    }
                    onClick={() => setAssistant(true)}
                    accessibleName="Open contextual assistant"
                    tooltip="Open contextual assistant"
                  />
                </div>
              </header>
              {[
                "Command Center",
                "Opportunities",
                "Demand Intelligence",
              ].includes(page) && renderFilters()}
              <div className="page-content">
                {page === "Command Center" && Dashboard()}
                {page === "Opportunities" && <OpportunitiesTable />}
                {page === "Demand Intelligence" && Demand()}
                {page === "Inventory & Supply" && Network()}
                {page === "Location Intelligence" && (
                  <LocationIntelligence
                    state={state}
                    onState={setState}
                    notify={notify}
                    connections={connections}
                    onWorkflow={() => navigate("SAP Workflow")}
                    onConnections={() => navigate("Integrations")}
                    onOpportunity={open}
                  />
                )}
                {page === "Risk & Seasonality" && (
                  <RiskSeasonality
                    state={state}
                    onState={setState}
                    notify={notify}
                    onWorkflow={() => navigate("SAP Workflow")}
                    onOpportunity={open}
                  />
                )}
                {page === "SAP Workflow" && (
                  <SapWorkflow
                    state={state}
                    onState={setState}
                    notify={notify}
                    connections={connections}
                  />
                )}

                {page === "Action Center" && (
                  <>
                    <div className="kpi-grid">
                      <Kpi
                        label="Completed demo transfers"
                        value={
                          state.actions.filter(
                            (a) =>
                              a.type === "Stock transfer" ||
                              a.type === "Simulated goods receipt",
                          ).length
                        }
                        detail="Simulated receipt recorded"
                        icon="shipping-status"
                      />
                      <Kpi
                        label="Inventory transferred"
                        value={state.actions
                          .filter(
                            (a) =>
                              a.type === "Stock transfer" ||
                              a.type === "Simulated goods receipt",
                          )
                          .reduce((s, a) => s + a.quantity, 0)}
                        unit="units"
                        detail="Conserved across the inventory network"
                        icon="inventory"
                      />
                      <Kpi
                        label="Pending reviews"
                        value={
                          state.actions.filter(
                            (a) => a.status === "Pending review",
                          ).length
                        }
                        detail="Awaiting planner or buyer follow-up"
                        icon="pending"
                        tone="warning-text"
                      />
                      <Kpi
                        label="Open opportunities"
                        value={active.length}
                        detail="Excludes planner-dismissed items"
                        icon="lightbulb"
                      />
                    </div>
                    <Activity />
                  </>
                )}
                {page === "Integrations" && <Integrations />}
                {page === "About Retail Signal" && <About />}
                <footer className="app-footer">
                  <span>Retail Signal · SAP Fiori competition concept</span>
                  <span>
                    <i className="demo-indicator" /> Seeded simulation · All
                    amounts in CAD
                  </span>
                </footer>
              </div>
            </>
          )}
        </main>
      </div>
      <button
        className="assistant-fab"
        onClick={() => setAssistant(!assistant)}
        aria-label="Open Joule-inspired assistant"
      >
        <span>✧</span>
      </button>
      {assistant && (
        <aside className="assistant-panel">
          <div className="assistant-header">
            <div className="joule-mark">✧</div>
            <div>
              <h3>Retail Signal Assistant</h3>
              <span>Joule-inspired · Simulated</span>
            </div>
            <Button
              icon="decline"
              design="Transparent"
              accessibleName="Close assistant"
              onClick={() => setAssistant(false)}
            />
          </div>
          <div className="assistant-context">
            <Icon name="chain-link" />
            {(selected || opportunities[0]).product} ·{" "}
            {(selected || opportunities[0]).size}
          </div>
          <div className="assistant-messages">
            {messages.length === 0 ? (
              <div className="assistant-welcome">
                <span>✧</span>
                <h2>
                  Let’s make your next
                  <br />
                  retail decision clearer.
                </h2>
                <p>
                  Ask about the opportunity, available stock or the impact of a
                  response.
                </p>
                {[
                  "Why is this product flagged?",
                  "What happens if we transfer 40 units?",
                  "What if our supplier is delayed by 10 days?",
                ].map((t) => (
                  <button key={t} onClick={() => ask(t)}>
                    {t}
                    <Icon name="arrow-right" />
                  </button>
                ))}
              </div>
            ) : (
              messages.map((m, i) => (
                <div className={`chat-message ${m.role}`} key={i}>
                  {m.role === "assistant" && (
                    <strong>Retail Signal Assistant</strong>
                  )}
                  <p>{m.text}</p>
                  {m.role === "assistant" && (
                    <small>
                      Source: seeded demand, inventory and supplier records
                    </small>
                  )}
                </div>
              ))
            )}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (question.trim()) ask(question);
            }}
          >
            <Input
              value={question}
              accessibleName="Ask assistant"
              placeholder="Ask about this opportunity…"
              onInput={(e) => setQuestion(e.target.value)}
            />
            <Button
              icon="paper-plane"
              design="Emphasized"
              accessibleName="Send question"
              type="Submit"
            />
          </form>
          <p className="assistant-disclaimer">
            Deterministic demo responses. No live SAP Joule connection.
          </p>
        </aside>
      )}
      {guide > 0 && (
        <div className="guide-panel">
          <div>
            <span>GUIDED DEMO · {guide} / 4</span>
            <Button
              design="Transparent"
              icon="decline"
              accessibleName="Close guided demo"
              onClick={() => setGuide(0)}
            />
          </div>
          <h3>
            {
              [
                "Identify the opportunity",
                "Connect the evidence",
                "Compare a response",
                "Act and measure",
              ][guide - 1]
            }
          </h3>
          <p>{guideSteps[guide - 1]}</p>
          <div>
            <Button
              onClick={() => {
                if (guide === 1) open(opportunities[0]);
                if (guide === 2) {
                  open(opportunities[0]);
                  setTab("Evidence & inventory");
                }
                if (guide === 3) {
                  open(opportunities[0]);
                }
                if (guide === 4) navigate("SAP Workflow");
              }}
            >
              Show me
            </Button>
            <Button
              design="Emphasized"
              onClick={() => {
                if (guide < 4) setGuide(guide + 1);
                else setGuide(0);
              }}
            >
              {guide === 4 ? "Finish" : "Next step"}
              <Icon name="slim-arrow-right" />
            </Button>
          </div>
        </div>
      )}
      {toast && (
        <div className="toast" role="status">
          <Icon name="message-success" />
          {toast}
        </div>
      )}
    </div>
  );
}
