import { useMemo, useRef, useState, useEffect, useCallback } from "react";
import { Button, Icon, Select, Option, Input } from "@ui5/webcomponents-react";
import type { DemoState, Opportunity } from "../data";
import { opportunities, money, demandFor } from "../data";
import {
  proposeTransfer,
  transferable,
  salesRisk,
  onlineDemand,
  candidates,
} from "../planning";
import {
  buildSupplyGraph,
  focusNetwork,
  networkIssues,
  supplierImpact,
  incomingUnits,
  proposalFor,
  alternativeSupplier,
} from "../supplyNetwork";
import type { AssistantContext } from "../assistant";
import type { NetworkDirection } from "../supplyNetwork";
import type { SupplyNode, SupplyEdge } from "../supplyNetwork";
import { ResourceWorkbench } from "./ResourceWorkbench";
import { resources, readPurchaseRates, resourceSkus } from "../resources";
import type { ShortageConfig } from "../resources";
import { useMarketQuotes } from "../useMarketQuotes";
import { simulateCascade, cascadeNodeState } from "../cascade";
import { CascadeTimeline, CascadeInspector } from "./CascadeTimeline";
import type { TimelineControls } from "./CascadeTimeline";
const glyphs = {
  material: "product",
  production: "factory",
  supplier: "factory",
  product: "product",
  warehouse: "building",
  store: "retail-store",
  online: "cart",
};
const kinds = {
  material: "MATERIAL · ILLUSTRATIVE",
  production: "PRODUCTION · ILLUSTRATIVE",
  supplier: "SUPPLIER",
  product: "PRODUCT / SKU",
  warehouse: "DISTRIBUTION CENTER",
  store: "STORE",
  online: "ONLINE FULFILLMENT",
};
export default function SupplyNetwork({
  state,
  onState,
  onOpportunity,
  onWorkflow,
  notify,
  onAsk,
  onContext,
}: {
  state: DemoState;
  onState: (s: DemoState) => void;
  onOpportunity: (o: Opportunity) => void;
  onWorkflow: () => void;
  notify: (s: string) => void;
  onContext: (context: AssistantContext) => void;
  onAsk: (question: string, context: AssistantContext) => void;
}) {
  const [rates, setRates] = useState(readPurchaseRates);
  const [shock, setShock] = useState<ShortageConfig | null>(null);
  const market = useMarketQuotes();
  useEffect(() => {
    localStorage.setItem("retail-procurement-rates-v1", JSON.stringify(rates));
  }, [rates]);
  const shockedResource = shock
    ? resources.find((r) => r.id === shock.resource)!
    : null;
  const shockedSkus = new Set(
    shockedResource ? resourceSkus(shockedResource) : [],
  );
  const graph = useMemo(() => buildSupplyGraph(state), [state]);
  const [selected, setSelected] = useState(`supplier:Pacific Apparel Co.`);
  const [filter, setFilter] = useState("All products");
  const [direction, setDirection] = useState<NetworkDirection>("both");
  const [focusOnly, setFocusOnly] = useState(false);
  const [query, setQuery] = useState("");
  const [timeline, setTimeline] = useState<TimelineControls>({
    enabled: false,
    day: 0,
    horizon: 45,
    supplier: "Pacific Apparel Co.",
    delayDays: 10,
    demandPercent: 100,
    inboundWeeks: 4,
    response: "rebalance",
    view: "delayed",
  });
  const changeTimeline = useCallback(
    (patch: Partial<TimelineControls>) =>
      setTimeline((t) => ({ ...t, ...patch })),
    [],
  );
  const extraDays = timeline.delayDays;
  const runs = useMemo(() => {
    const config = {
      supplier: timeline.supplier,
      delayDays: timeline.delayDays,
      horizon: timeline.horizon,
      demandPercent: timeline.demandPercent,
      inboundWeeks: timeline.inboundWeeks,
      response: timeline.response,
      sku: filter,
      resourceShock: shock
        ? {
            skus: resourceSkus(resources.find((r) => r.id === shock.resource)!),
            supplyPercent: 100 - shock.shortagePercent,
            delayDays: shock.delayDays,
          }
        : undefined,
    };
    return {
      baseline: simulateCascade(state, {
        ...config,
        delayDays: 0,
        resourceShock: undefined,
        response: "none",
      }),
      delayed: simulateCascade(state, { ...config, response: "none" }),
      response: simulateCascade(state, config),
    };
  }, [
    state,
    filter,
    shock,
    timeline.supplier,
    timeline.delayDays,
    timeline.horizon,
    timeline.demandPercent,
    timeline.inboundWeeks,
    timeline.response,
  ]);
  const activeRun = runs[timeline.view];
  const isShockNode = (n: SupplyNode) =>
    !!shock &&
    (n.kind === "material"
      ? n.id === `material:${shock.resource}`
      : n.skus.some((sku) => shockedSkus.has(sku)));
  const isShockEdge = (e: SupplyEdge) =>
    !!shock &&
    (e.kind === "material"
      ? e.from === `material:${shock.resource}`
      : e.skus.some((sku) => shockedSkus.has(sku)));
  const projected = (n: SupplyNode) =>
    cascadeNodeState(
      activeRun,
      timeline.day,
      n,
      timeline.supplier,
      timeline.view === "baseline" ? 0 : extraDays,
    );
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [expanded, setExpanded] = useState(false);
  const [showRebalance, setShowRebalance] = useState(true);
  const [onlyRisk, setOnlyRisk] = useState(false);
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(
    null,
  );
  const canvas = useRef<SVGSVGElement>(null);
  useEffect(() => {
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpanded(false);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);
  const node = graph.nodes.find((n) => n.id === selected) || graph.nodes[0];
  useEffect(() => {
    onContext({
      name: node.name,
      nodeId: node.id,
      skus: node.skus.filter(
        (sku) => filter === "All products" || sku === filter,
      ),
      timeline: timeline.enabled ? { ...timeline, sku: filter } : undefined,
      shortage: shock || undefined,
      purchaseRates: rates,
      marketQuotes: market.quotes,
    });
  }, [node, filter, timeline, onContext, shock, rates, market.quotes]);
  const relatedSkus = new Set(
    node.skus.filter((sku) => filter === "All products" || sku === filter),
  );
  const related = opportunities.filter((o) => relatedSkus.has(o.sku));
  const traced = focusNetwork(graph, selected, filter, direction);
  const issues = networkIssues(state, relatedSkus);
  const directLinks = graph.edges.filter(
    (e) =>
      (e.from === selected || e.to === selected) &&
      e.skus.some((sku) => relatedSkus.has(sku)),
  );
  const askNetwork = () =>
    onAsk("Explain the network risks and recommend a response", {
      name: node.name,
      nodeId: node.id,
      skus: [...relatedSkus],
      timeline: timeline.enabled ? { ...timeline, sku: filter } : undefined,
      shortage: shock || undefined,
      purchaseRates: rates,
      marketQuotes: market.quotes,
    });
  const highlighted = new Set(traced.nodes.map((n) => n.id));
  const highlightedEdges = new Set(traced.edges.map((e) => e.id));
  const visibleSkus = new Set(
    opportunities
      .filter(
        (o) =>
          (filter === "All products" || o.sku === filter) &&
          (!onlyRisk ||
            networkIssues(state, new Set([o.sku])).some(
              (i) => i.severity !== "Information",
            )),
      )
      .map((o) => o.sku),
  );
  const visibleNodes = graph.nodes.filter(
    (n) =>
      n.skus.some((sku) => visibleSkus.has(sku)) &&
      (!focusOnly || highlighted.has(n.id)),
  );
  const ids = new Set(visibleNodes.map((n) => n.id));
  const forecastEdges: SupplyEdge[] =
    timeline.enabled && timeline.view === "response"
      ? activeRun.responseTransfers.map((t, i) => ({
          id: `forecast-response:${i}`,
          from: `location:${t.source}`,
          to: `location:${t.destination}`,
          skus: [t.sku],
          kind: "transfer",
          label: `Forecast response: ${t.quantity} units; receipt day ${t.arrivalDay}`,
          risk: false,
        }))
      : [];
  const edges = [...graph.edges, ...forecastEdges].filter(
    (e) =>
      ids.has(e.from) &&
      ids.has(e.to) &&
      e.skus.some((sku) => visibleSkus.has(sku)) &&
      (showRebalance || e.kind !== "rebalance"),
  );
  const impact =
    node.kind === "supplier"
      ? supplierImpact(node.name, state, extraDays)
      : null;
  const facility = state.inventory.filter(
    (i) =>
      `location:${i.location}` === node.id &&
      (filter === "All products" || i.sku === filter),
  );
  const currentExposure = related
    .filter(
      (o) =>
        node.kind === "supplier" ||
        node.kind === "product" ||
        o.location === node.name,
    )
    .reduce(
      (n, o) =>
        n +
        salesRisk(
          demandFor(o, state),
          state.inventory.find((i) => i.id === `${o.id}-dest`)!.stock,
          o.price,
          70,
        ).expected,
      0,
    );
  const search = query.toLowerCase().trim();
  const selectedSearch = visibleNodes.filter((n) =>
    (n.name + " " + n.detail).toLowerCase().includes(search),
  );
  const select = (n: SupplyNode) => {
    setSelected(n.id);
    if (
      n.kind === "supplier" &&
      n.name !== alternativeSupplier &&
      n.name !== timeline.supplier
    )
      changeTimeline({ supplier: n.name, delayDays: 0 });
  };
  const path = (edge: SupplyEdge) => {
    const a = graph.nodes.find((n) => n.id === edge.from)!,
      b = graph.nodes.find((n) => n.id === edge.to)!;
    const ay = a.y + 43,
      by = b.y + 43;
    if (a.x === b.x) {
      const bend = 1500 + Math.min(45, Math.abs(by - ay) * 0.08);
      return `M ${a.x + 214} ${ay} C ${bend} ${ay},${bend} ${by},${b.x + 214} ${by}`;
    }
    return `M ${a.x + 214} ${ay} C ${a.x + 251} ${ay},${b.x - 37} ${by},${b.x} ${by}`;
  };
  const requestReview = () => {
    if (!related[0]) return;
    const now = new Date().toISOString();
    onState({
      ...state,
      actions: [
        {
          id: `SUP-REVIEW-${Date.now()}`,
          opportunity: related[0].id,
          product: related[0].product,
          type: "Supplier dependency review",
          quantity: 0,
          status: "Pending review",
          owner: "Alex Morgan",
          timestamp: now,
          detail: `Review ${node.name}; ${related.length} linked SKUs. ${node.name === timeline.supplier && extraDays ? `Scenario: ${extraDays} additional delay days. ` : ""}Demo review request; no supplier message sent.`,
        },
        ...state.actions,
      ],
    });
    notify("Supplier review added to Action Center.");
  };
  return (
    <section className={`supply-explorer ${expanded ? "expanded" : ""}`}>
      <div className="supply-header">
        <div>
          <span className="supply-eyebrow">
            SUPPLY CHAIN RELATIONSHIP EXPLORER
          </span>
          <h2>Supply chain intelligence</h2>
          <p>
            Trace materials to customer demand. Inspect upstream dependencies,
            downstream exposure and actionable exceptions.
          </p>
        </div>
        <Button
          icon={expanded ? "exit-full-screen" : "full-screen"}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? "Close expanded view" : "Expand network"}
        </Button>
      </div>
      <div className="supply-controls">
        <label>
          Product scope
          <Select
            accessibleName="Supply network product"
            onChange={(e) => {
              const sku = e.detail.selectedOption.getAttribute("data-sku")!;
              setFilter(sku);
              setSelected(
                sku === "All products"
                  ? "supplier:Pacific Apparel Co."
                  : `product:${sku}`,
              );
              changeTimeline({
                supplier:
                  sku === "All products"
                    ? "Pacific Apparel Co."
                    : opportunities.find((o) => o.sku === sku)!.supplier,
                delayDays: 0,
              });
            }}
          >
            <Option
              data-sku="All products"
              selected={filter === "All products"}
            >
              All products
            </Option>
            {opportunities.map((o) => (
              <Option data-sku={o.sku} selected={filter === o.sku} key={o.sku}>
                {o.product} · {o.size}
              </Option>
            ))}
          </Select>
        </label>
        <label>
          Find a connection
          <Input
            accessibleName="Search supply network"
            placeholder="Supplier, location or SKU"
            value={query}
            onInput={(e) => setQuery(e.target.value)}
          />
        </label>
        <Button
          icon="alert"
          design={onlyRisk ? "Emphasized" : "Default"}
          onClick={() => setOnlyRisk(!onlyRisk)}
        >
          {onlyRisk ? "Show all dependencies" : "Exceptions only"}
        </Button>
        <Button
          design={showRebalance ? "Emphasized" : "Default"}
          onClick={() => setShowRebalance(!showRebalance)}
        >
          Rebalance links
        </Button>
      </div>
      <div className="network-focusbar">
        <div>
          <span>SELECTED ENTITY</span>
          <strong>{node.name}</strong>
          <small>
            {related.length} SKUs · {traced.nodes.length} connected entities ·{" "}
            {issues.filter((i) => i.severity === "Error").length} availability
            exceptions
          </small>
        </div>
        <label>
          Trace direction
          <select
            aria-label="Trace direction"
            value={direction}
            onChange={(e) => {
              setDirection(e.target.value as NetworkDirection);
              setFocusOnly(true);
            }}
          >
            <option value="both">Upstream + downstream</option>
            <option value="upstream">Upstream dependencies</option>
            <option value="downstream">Downstream exposure</option>
          </select>
        </label>
        <Button onClick={() => setFocusOnly(!focusOnly)}>
          {focusOnly ? "Show entire web" : "Isolate selected web"}
        </Button>
        <Button design="Emphasized" onClick={askNetwork}>
          Ask Joule about this network
        </Button>
      </div>
      {search && (
        <div className="network-search-results">
          {selectedSearch.length ? (
            selectedSearch.slice(0, 8).map((n) => (
              <button
                key={n.id}
                onClick={() => {
                  select(n);
                  setQuery("");
                }}
              >
                {n.name}
                <small>{kinds[n.kind]}</small>
              </button>
            ))
          ) : (
            <span>No matching connection in this product scope.</span>
          )}
        </div>
      )}
      <ResourceWorkbench
        selectedId={node.id}
        state={state}
        rates={rates}
        onRates={setRates}
        scenario={shock}
        onSimulate={(config) => {
          setShock(config);
          setSelected(`material:${config.resource}`);
          setFilter("All products");
          setFocusOnly(false);
          setDirection("both");
          changeTimeline({
            enabled: true,
            day: Math.min(23, config.horizon),
            horizon: config.horizon,
            delayDays: 0,
            view: "delayed",
          });
        }}
        onClear={() => {
          setShock(null);
          changeTimeline({ enabled: false, day: 0, delayDays: 10 });
        }}
        onSelect={(id) => {
          const n = graph.nodes.find((n) => n.id === id);
          if (n) select(n);
        }}
        onExplain={() =>
          onAsk(
            "Explain this shortage: added costs, margin erosion and downstream impact",
            {
              name: shockedResource?.name || node.name,
              skus: [...shockedSkus],
              nodeId: shockedResource
                ? `material:${shockedResource.id}`
                : node.id,
              shortage: shock || undefined,
              purchaseRates: rates,
              marketQuotes: market.quotes,
              timeline: timeline.enabled
                ? { ...timeline, sku: filter }
                : undefined,
            },
          )
        }
        quotes={market.quotes}
        loading={market.loading}
        onRefresh={() => void market.refresh()}
        marketError={market.error}
      />
      {shock && (
        <div className="shock-path-banner">
          <strong>{shockedResource!.name} disruption active</strong>
          <span>
            {shock.shortagePercent}% less new supply · +{shock.delayDays}{" "}
            delivery days · red outlines trace affected SKUs and facilities.
            Click any node to inspect its role.
          </span>
        </div>
      )}
      <div className="supply-workbench">
        <div className="relationship-stage">
          <div className="graph-timebar">
            <div>
              <strong>
                {timeline.enabled
                  ? `PROJECTED DAY ${timeline.day}`
                  : "CURRENT SAVED RECORDS"}
              </strong>
              <span>
                {timeline.enabled
                  ? `${timeline.supplier} · +${extraDays} days`
                  : "Shared inventory · seven-day demand window"}
              </span>
            </div>
            <input
              aria-label="Graph downstream simulation day"
              type="range"
              min="0"
              max={timeline.horizon}
              value={timeline.day}
              onChange={(e) =>
                changeTimeline({ day: Number(e.target.value), enabled: true })
              }
            />
            <select
              aria-label="Graph timeline scenario"
              value={timeline.view}
              onChange={(e) =>
                changeTimeline({
                  view: e.target.value as TimelineControls["view"],
                  enabled: true,
                })
              }
            >
              <option value="baseline">Original timing</option>
              <option value="delayed">Delay · no action</option>
              <option value="response">Delay · with response</option>
            </select>
          </div>
          <div className="relationship-columns">
            <span>MATERIAL INPUTS</span>
            <span>SUPPLIERS</span>
            <span>PRODUCTION</span>
            <span>PRODUCT DEPENDENCIES</span>
            <span>DISTRIBUTION</span>
            <span>STORES & DIGITAL</span>
          </div>
          <div className="relationship-viewport">
            <svg
              ref={canvas}
              viewBox="0 0 1510 740"
              role="group"
              aria-label="Interactive supply chain relationship graph. Select nodes to trace supplier risks and affected products and locations."
              onPointerDown={(e) => {
                if ((e.target as Element).closest("[data-node]")) return;
                drag.current = {
                  x: e.clientX,
                  y: e.clientY,
                  ox: offset.x,
                  oy: offset.y,
                };
                e.currentTarget.setPointerCapture(e.pointerId);
              }}
              onPointerMove={(e) => {
                if (!drag.current || !canvas.current) return;
                const scale =
                  1510 / canvas.current.getBoundingClientRect().width;
                setOffset({
                  x: drag.current.ox + (e.clientX - drag.current.x) * scale,
                  y: drag.current.oy + (e.clientY - drag.current.y) * scale,
                });
              }}
              onPointerUp={() => (drag.current = null)}
              onPointerCancel={() => (drag.current = null)}
            >
              <defs>
                <marker
                  id="network-arrow"
                  viewBox="0 0 10 10"
                  refX="9"
                  refY="5"
                  markerWidth="5"
                  markerHeight="5"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#647f99" />
                </marker>
                <pattern
                  id="network-grid"
                  width="24"
                  height="24"
                  patternUnits="userSpaceOnUse"
                >
                  <circle cx="1" cy="1" r=".6" fill="#d4dfe9" />
                </pattern>
              </defs>
              <rect width="1510" height="740" fill="url(#network-grid)" />
              <g
                transform={`translate(${offset.x} ${offset.y}) scale(${zoom})`}
              >
                {edges.map((edge) => (
                  <path
                    key={edge.id}
                    d={path(edge)}
                    markerEnd="url(#network-arrow)"
                    className={`relationship-edge ${edge.kind} ${isShockEdge(edge) ? "shock" : ""} ${(timeline.enabled && !["material", "production"].includes(edge.kind) ? cascadeNodeState(activeRun, timeline.day, { ...graph.nodes.find((n) => n.id === edge.to)!, skus: edge.skus }, timeline.supplier, timeline.view === "baseline" ? 0 : extraDays).risk : edge.risk) ? "risk" : ""} ${highlightedEdges.has(edge.id) || edge.id.startsWith("forecast-response:") ? "lit" : "dim"}`}
                  >
                    <title>
                      {edge.label} · {edge.skus.join(", ")}
                    </title>
                  </path>
                ))}
                {visibleNodes.map((n) => {
                  const isSelected = n.id === selected;
                  const match =
                    !search ||
                    (n.name + " " + n.detail).toLowerCase().includes(search);
                  const projection =
                    timeline.enabled &&
                    !["material", "production"].includes(n.kind)
                      ? projected(n)
                      : null;
                  const projectedRisk = projection?.risk ?? n.risk;
                  const detail = projection ? projection.detail : n.detail;
                  return (
                    <g
                      key={n.id}
                      data-node="true"
                      className={`relationship-node ${n.kind} ${isShockNode(n) ? "shock" : ""} ${projectedRisk ? "risk" : timeline.enabled ? "projected-safe" : ""} ${isSelected ? "selected" : ""} ${highlighted.has(n.id) && match ? "lit" : "dim"}`}
                      transform={`translate(${n.x} ${n.y})`}
                      role="button"
                      tabIndex={0}
                      aria-label={`Inspect ${n.name}${n.kind === "product" ? ` ${n.skus[0]}` : ""}`}
                      onClick={() => select(n)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          select(n);
                        }
                      }}
                    >
                      <title>
                        {n.name} — {detail}
                      </title>
                      <rect
                        className="node-body"
                        width="214"
                        height="86"
                        rx="5"
                      />
                      <rect
                        className="node-accent"
                        width="3"
                        height="86"
                        rx="1"
                      />
                      <circle
                        className="node-indicator"
                        cx="199"
                        cy="13"
                        r="3"
                      />
                      <text className="node-kind" x="12" y="15">
                        {kinds[n.kind]}
                      </text>
                      <text className="node-name" x="12" y="35">
                        {n.name.length > 26
                          ? n.name.slice(0, 24) + "…"
                          : n.name}
                      </text>
                      <text className="node-detail" x="12" y="55">
                        {detail.length > 35
                          ? detail.slice(0, 33) + "…"
                          : detail}
                      </text>
                      <text className="node-evidence" x="12" y="75">
                        {n.kind === "product"
                          ? n.skus[0]
                          : ["material", "production"].includes(n.kind)
                            ? "Availability / capacity unverified"
                            : `${n.skus.length} SKUs · ${networkIssues(state, new Set(n.skus)).length} linked exceptions`}
                      </text>
                    </g>
                  );
                })}
              </g>
            </svg>
          </div>
          <div className="network-canvas-tools">
            <span>
              {timeline.enabled
                ? `PROJECTED DAY ${timeline.day} · ${timeline.view.toUpperCase()}`
                : `${visibleNodes.length} entities · ${edges.length} links`}{" "}
              · drag background to pan
            </span>
            <div>
              <button
                aria-label="Zoom network out"
                onClick={() => setZoom((z) => Math.max(0.6, z - 0.2))}
              >
                −
              </button>
              <span>{Math.round(zoom * 100)}%</span>
              <button
                aria-label="Zoom network in"
                onClick={() => setZoom((z) => Math.min(2, z + 0.2))}
              >
                +
              </button>
              <button
                onClick={() => {
                  setZoom(1);
                  setOffset({ x: 0, y: 0 });
                }}
              >
                Fit
              </button>
            </div>
          </div>
          <div className="relationship-legend">
            <span>
              <i className="supply-material" />
              Illustrative material input
            </span>
            <span>
              <i className="supply-risk" />
              Delayed supplier dependency
            </span>
            <span>
              <i className="supply-allocation" />
              Modeled supply link
            </span>
            <span>
              <i className="supply-rebalance" />
              Possible rebalance
            </span>
            <span>
              <i className="supply-transfer" />
              Demo transfer order
            </span>
          </div>
          <p className="network-provenance">
            Input specifications, purchase rates and production steps are
            illustrative; availability and capacity are unverified. Supplier
            lead times include production. Seeded supply links model
            dependencies; only demo transfer-order links represent a proposed or
            executed movement. No Bloomberg data connection.
          </p>
        </div>
        <aside
          className={`dependency-inspector ${["material", "production"].includes(node.kind) || !timeline.enabled ? "no-forecast" : ""}`}
        >
          <div className="dependency-summary">
            <div className="dependency-title">
              <Icon name={glyphs[node.kind]} />
              <div>
                <span>{kinds[node.kind]}</span>
                <h3>{node.name}</h3>
              </div>
            </div>
            <div className="dependency-tags">
              <span>{related.length} linked SKUs</span>
              <span>{traced.nodes.length} connected entities</span>
              {node.risk && (
                <span className="risk-tag">Requires attention</span>
              )}
            </div>
            {["material", "production"].includes(node.kind) ? (
              <div className="dependency-exposure">
                <span>ILLUSTRATIVE DEPENDENCY</span>
                <h4>{node.detail}</h4>
                <p>
                  Purchase rates and physical input requirements are demo
                  assumptions. No verified material inventory, yield or
                  production capacity is available. Inspect linked SKU
                  exceptions below; supplier lead times already include
                  production.
                </p>
              </div>
            ) : node.kind === "supplier" ? (
              <>
                <div className="dependency-exposure">
                  <span>CURRENT 7-DAY STORE SCENARIO</span>
                  <strong>{money(impact!.currentLoss)}</strong>
                  <p>
                    Estimated sales foregone across linked store opportunities.
                    Online exposure is shown separately in Risk & Seasonality.
                  </p>
                </div>
                <Button
                  className="supplier-review-button"
                  onClick={requestReview}
                >
                  Request supplier review
                </Button>
              </>
            ) : node.kind === "product" ? (
              <div className="dependency-exposure">
                <span>7-DAY STORE EXPOSURE</span>
                <strong>{money(currentExposure)}</strong>
                <p>
                  Current stock and shared demand scenario · 70% lost-sale
                  assumption.
                </p>
              </div>
            ) : (
              <div className="dependency-facility">
                <div>
                  <span>On hand</span>
                  <strong>
                    {facility.reduce((n, i) => n + i.stock, 0)} units
                  </strong>
                </div>
                <div>
                  <span>Uncommitted surplus</span>
                  <strong>
                    {facility
                      .filter((i) => i.reserve > 0)
                      .reduce((n, i) => n + transferable(state, i), 0)}{" "}
                    units
                  </strong>
                </div>
                {node.kind === "online" && (
                  <p>
                    Online scenario:{" "}
                    {money(
                      salesRisk(
                        onlineDemand(15, 7),
                        facility[0]?.stock || 0,
                        39,
                        70,
                      ).expected,
                    )}{" "}
                    estimated sales foregone.
                  </p>
                )}
              </div>
            )}
          </div>
          {timeline.enabled &&
            !["material", "production"].includes(node.kind) && (
              <CascadeInspector
                run={activeRun}
                day={timeline.day}
                node={node}
              />
            )}
          <div className="dependency-decisions">
            <div className="dependency-path">
              <h4>Trace the impact</h4>
              <p>
                {node.kind === "supplier"
                  ? `${impact!.locations.join(" and ")} depend on products linked to this supplier.`
                  : "Highlighted links connect this entity to its suppliers, products and fulfillment locations."}
              </p>
              <div>
                {related.map((o) => (
                  <button key={o.id} onClick={() => onOpportunity(o)}>
                    <span>
                      {o.product} · {o.size}
                    </span>
                    <small>{o.location} → Review evidence</small>
                    <Icon name="slim-arrow-right" />
                  </button>
                ))}
              </div>
            </div>
            <div className="dependency-responses">
              <h4>Create a response from current stock</h4>
              <p>
                Proposals use today’s saved inventory, not forecast balances.
                Timeline previews do not execute transfers.
              </p>
              {related.slice(0, 3).map((o) => {
                const base = proposalFor(o, state);
                const online = state.inventory.find(
                  (i) => i.id === "online-west",
                )!;
                const onlineSource = candidates(state, online.id)[0];
                const p =
                  node.kind === "online"
                    ? {
                        source: onlineSource?.record || base.source,
                        destination: online,
                        quantity: Math.min(
                          onlineSource?.available || 0,
                          Math.max(
                            0,
                            onlineDemand(15, 7) -
                              online.stock -
                              incomingUnits(state, online.id),
                          ),
                        ),
                      }
                    : base;
                return (
                  <div key={o.id}>
                    <strong>
                      {o.product} · {o.size}
                    </strong>
                    <p>
                      {p.quantity
                        ? `Transfer ${p.quantity} units from ${p.source.location} to ${p.destination.location}.`
                        : "No additional uncommitted source stock is available for this gap."}
                    </p>
                    <Button
                      design="Emphasized"
                      disabled={!p.quantity}
                      onClick={() => {
                        try {
                          onState(
                            proposeTransfer(
                              state,
                              p.source.id,
                              p.destination.id,
                              p.quantity,
                            ),
                          );
                          notify(
                            "Transfer proposal created from the dependency network.",
                          );
                          onWorkflow();
                        } catch (e) {
                          notify((e as Error).message);
                        }
                      }}
                    >
                      Propose {p.quantity}-unit transfer
                    </Button>
                  </div>
                );
              })}
              {related.some((o) => o.id === opportunities[0].id) && (
                <div className="alternate-response">
                  <strong>Alternative: Coastal Textiles</strong>
                  <p>
                    9-day lead · 120-unit capacity · CAD 14.50/unit. Requires
                    buyer review and arrives outside the immediate 7-day window.
                  </p>
                  <Button
                    design="Transparent"
                    onClick={() => onOpportunity(opportunities[0])}
                  >
                    Compare replenishment
                  </Button>
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>
      <div className="network-analysis-grid">
        <section className="network-evidence">
          <div className="network-section-title">
            <div>
              <span>CONNECTED EXCEPTIONS</span>
              <h3>Evidence behind the risk</h3>
            </div>
            <strong>{issues.length}</strong>
          </div>
          <p>
            Current saved records for selected SKUs. Forecast colors above are a
            separate scenario.
          </p>
          <div className="network-issue-list">
            {issues.length ? (
              issues.map((issue) => (
                <button
                  key={issue.id}
                  onClick={() =>
                    issue.source === "SAP Workflow"
                      ? onWorkflow()
                      : onOpportunity(issue.opportunity)
                  }
                >
                  <span
                    className={`issue-severity ${issue.severity.toLowerCase()}`}
                  >
                    {issue.severity}
                  </span>
                  <div>
                    <strong>{issue.title}</strong>
                    <small>
                      {issue.sku} · {issue.source}
                    </small>
                    <p>{issue.evidence}</p>
                  </div>
                  <span aria-hidden="true">↗</span>
                </button>
              ))
            ) : (
              <p>No current exceptions for the selected product scope.</p>
            )}
          </div>
        </section>
        <section className="network-relationships">
          <div className="network-section-title">
            <div>
              <span>ENTITY RELATIONSHIPS</span>
              <h3>Direct connections</h3>
            </div>
            <strong>{directLinks.length}</strong>
          </div>
          <p>
            Select a counterparty to follow the next tier. Relationships retain
            their SKU scope.
          </p>
          <div className="network-issue-list">
            {directLinks.map((e) => {
              const upstream = e.to === selected;
              const counterparty = graph.nodes.find(
                (n) => n.id === (upstream ? e.from : e.to),
              )!;
              return (
                <button key={e.id} onClick={() => select(counterparty)}>
                  <span className="relation-direction">
                    {upstream ? "IN" : "OUT"}
                  </span>
                  <div>
                    <strong>{counterparty.name}</strong>
                    <small>
                      {kinds[counterparty.kind]} · {e.skus.length} SKUs
                    </small>
                    <p>{e.label}</p>
                    <small>{e.skus.join(" · ")}</small>
                  </div>
                  <span aria-hidden="true">→</span>
                </button>
              );
            })}
          </div>
        </section>
      </div>
      <CascadeTimeline
        resourceShockLabel={
          shock
            ? `${shockedResource!.name}: ${shock.shortagePercent}% less supply, +${shock.delayDays} days`
            : undefined
        }
        controls={timeline}
        onChange={changeTimeline}
        baseline={runs.baseline}
        delayed={runs.delayed}
        response={runs.response}
      />
    </section>
  );
}
