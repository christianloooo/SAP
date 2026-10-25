import { useMemo, useRef, useState, useEffect } from "react";
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
  traceNetwork,
  supplierImpact,
  incomingUnits,
  proposalFor,
  alternativeSupplier,
} from "../supplyNetwork";
import type { SupplyNode, SupplyEdge } from "../supplyNetwork";
const glyphs = {
  supplier: "factory",
  product: "product",
  warehouse: "building",
  store: "retail-store",
  online: "cart",
};
const kinds = {
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
}: {
  state: DemoState;
  onState: (s: DemoState) => void;
  onOpportunity: (o: Opportunity) => void;
  onWorkflow: () => void;
  notify: (s: string) => void;
}) {
  const graph = useMemo(() => buildSupplyGraph(state), [state]);
  const [selected, setSelected] = useState(`supplier:Pacific Apparel Co.`);
  const [filter, setFilter] = useState("All products");
  const [query, setQuery] = useState("");
  const [extraDays, setExtraDays] = useState(0);
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
  const relatedSkus = new Set(
    node.skus.filter((sku) => filter === "All products" || sku === filter),
  );
  const related = opportunities.filter((o) => relatedSkus.has(o.sku));
  const traced = traceNetwork(graph, selected, filter);
  const highlighted = new Set(traced.nodes.map((n) => n.id));
  const highlightedEdges = new Set(traced.edges.map((e) => e.id));
  const visibleSkus = new Set(
    opportunities
      .filter(
        (o) =>
          (filter === "All products" || o.sku === filter) &&
          (!onlyRisk || o.risk !== "On schedule"),
      )
      .map((o) => o.sku),
  );
  const visibleNodes = graph.nodes.filter((n) =>
    n.skus.some((sku) => visibleSkus.has(sku)),
  );
  const ids = new Set(visibleNodes.map((n) => n.id));
  const edges = graph.edges.filter(
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
    setExtraDays(0);
  };
  const path = (edge: SupplyEdge) => {
    const a = graph.nodes.find((n) => n.id === edge.from)!,
      b = graph.nodes.find((n) => n.id === edge.to)!;
    const ay = a.y + 35,
      by = b.y + 35;
    if (a.x === b.x) {
      const bend = 1122 + Math.min(45, Math.abs(by - ay) * 0.08);
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
          detail: `Review ${node.name}; ${related.length} linked SKUs. ${extraDays ? `Scenario: ${extraDays} additional delay days. ` : ""}Demo review request; no supplier message sent.`,
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
          <h2>See the connections. Follow the risk.</h2>
          <p>
            Select a company, product or location to trace its dependencies and
            response options.
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
              setExtraDays(0);
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
          {onlyRisk ? "Show all dependencies" : "Supplier risks only"}
        </Button>
        <Button
          design={showRebalance ? "Emphasized" : "Default"}
          onClick={() => setShowRebalance(!showRebalance)}
        >
          Rebalance links
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
      <div className="supply-workbench">
        <div className="relationship-stage">
          <div className="relationship-columns">
            <span>SUPPLIERS</span>
            <span>PRODUCT DEPENDENCIES</span>
            <span>DISTRIBUTION</span>
            <span>STORES & DIGITAL</span>
          </div>
          <div className="relationship-viewport">
            <svg
              ref={canvas}
              viewBox="0 0 1160 680"
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
                  1160 / canvas.current.getBoundingClientRect().width;
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
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#7c99b8" />
                </marker>
                <pattern
                  id="network-grid"
                  width="24"
                  height="24"
                  patternUnits="userSpaceOnUse"
                >
                  <circle cx="1" cy="1" r=".6" fill="#27374a" />
                </pattern>
              </defs>
              <rect width="1160" height="680" fill="url(#network-grid)" />
              <g
                transform={`translate(${offset.x} ${offset.y}) scale(${zoom})`}
              >
                {edges.map((edge) => (
                  <path
                    key={edge.id}
                    d={path(edge)}
                    markerEnd="url(#network-arrow)"
                    className={`relationship-edge ${edge.kind} ${edge.risk ? "risk" : ""} ${highlightedEdges.has(edge.id) ? "lit" : "dim"}`}
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
                  const detail =
                    n.kind === "supplier" && isSelected && extraDays
                      ? `${(n.name === alternativeSupplier ? 9 : supplierImpact(n.name, state, 0).rows[0].lead) + extraDays}-day lead · +${extraDays} scenario days`
                      : n.detail;
                  return (
                    <g
                      key={n.id}
                      data-node="true"
                      className={`relationship-node ${n.kind} ${n.risk ? "risk" : ""} ${isSelected ? "selected" : ""} ${highlighted.has(n.id) && match ? "lit" : "dim"}`}
                      transform={`translate(${n.x} ${n.y})`}
                      role="button"
                      tabIndex={0}
                      aria-label={`Inspect ${n.name}`}
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
                        height="70"
                        rx="5"
                      />
                      <rect
                        className="node-accent"
                        width="3"
                        height="70"
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
                    </g>
                  );
                })}
              </g>
            </svg>
          </div>
          <div className="network-canvas-tools">
            <span>
              {visibleNodes.length} entities · {edges.length} links · drag
              background to pan
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
            Seeded supplier and inventory relationships. Supply links model
            dependencies; only demo transfer-order links represent a proposed or
            executed movement. No Bloomberg data connection.
          </p>
        </div>
        <aside className="dependency-inspector">
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
            {node.risk && <span className="risk-tag">Requires attention</span>}
          </div>
          {node.kind === "supplier" ? (
            <>
              <div className="dependency-exposure">
                <span>CURRENT 7-DAY STORE SCENARIO</span>
                <strong>{money(impact!.currentLoss)}</strong>
                <p>
                  Estimated sales foregone across linked store opportunities.
                  Online exposure is shown separately in Risk & Seasonality.
                </p>
              </div>
              <div className="supplier-delay-control">
                <label>
                  What if this supplier is delayed?
                  <strong>+{extraDays} days</strong>
                  <input
                    aria-label="Additional supplier delay days"
                    type="range"
                    min="0"
                    max="21"
                    step="1"
                    value={extraDays}
                    onChange={(e) => setExtraDays(Number(e.target.value))}
                  />
                </label>
                <div>
                  <span>Additional exposure during the extended lead time</span>
                  <strong>{money(impact!.additionalLoss)}</strong>
                </div>
                <p>
                  Linear demand, unchanged stock, no additional supply and 70%
                  lost-sale assumption. A scenario, not a forecast; it does not
                  change live supplier records.
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
            <h4>Available responses</h4>
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
        </aside>
      </div>
    </section>
  );
}
