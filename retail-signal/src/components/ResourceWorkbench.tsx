import { useState, useRef, useEffect } from "react";
import { Button } from "@ui5/webcomponents-react";
import type { DemoState } from "../data";
import type { MarketQuote } from "../market";
import {
  resources,
  purchaseRate,
  rateKey,
  defaultShortage,
  simulateResourceShortage,
} from "../resources";
import type { PurchaseRates, ShortageConfig } from "../resources";
export const cad = (value: number) =>
  new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
export function ResourceWorkbench({
  selectedId,
  state,
  rates,
  onRates,
  scenario,
  onSimulate,
  onClear,
  onSelect,
  onExplain,
  quotes,
  loading,
  onRefresh,
  marketError,
}: {
  selectedId: string;
  state: DemoState;
  rates: PurchaseRates;
  onRates: (rates: PurchaseRates) => void;
  scenario: ShortageConfig | null;
  onSimulate: (c: ShortageConfig) => void;
  onClear: () => void;
  onSelect: (id: string) => void;
  onExplain: () => void;
  quotes: MarketQuote[];
  loading: boolean;
  onRefresh: () => void;
  marketError: string;
}) {
  const resourcePanel = useRef<HTMLDivElement>(null);
  const resultPanel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (selectedId.startsWith("material:"))
      resourcePanel.current?.scrollIntoView({
        block: "start",
        behavior: "smooth",
      });
  }, [selectedId]);
  useEffect(() => {
    if (scenario)
      resultPanel.current?.scrollIntoView({
        block: "start",
        behavior: "smooth",
      });
  }, [scenario]);
  const material = resources.find((r) => `material:${r.id}` === selectedId);
  const [showSimulator, setShowSimulator] = useState(false);
  const [draft, setDraft] = useState<ShortageConfig>(defaultShortage);
  const [showAll, setShowAll] = useState(false);
  const activeResource = resources.find(
    (r) => r.id === (showSimulator ? draft.resource : material?.id || "diesel"),
  )!;
  const result = scenario
    ? simulateResourceShortage(state, scenario, rates)
    : null;
  const ranked = material
    ? [...material.contracts].sort(
        (a, b) =>
          (a.status === "Current" ? 0 : 1) - (b.status === "Current" ? 0 : 1) ||
          purchaseRate(material, b, rates) * b.monthlyQuantity -
            purchaseRate(material, a, rates) * a.monthlyQuantity,
      )
    : [];
  const relevantQuote = material?.benchmark
    ? quotes.find((q) => q.series === material.benchmark)
    : undefined;
  const numberField = (
    label: string,
    key:
      | "shortagePercent"
      | "priceIncreasePercent"
      | "delayDays"
      | "passThroughPercent",
    max: number,
  ) => (
    <label>
      {label}
      <input
        type="number"
        aria-label={label}
        min="0"
        max={max}
        step="1"
        value={draft[key]}
        onChange={(e) => setDraft({ ...draft, [key]: e.target.valueAsNumber })}
      />
    </label>
  );
  const valid =
    [
      draft.shortagePercent,
      draft.priceIncreasePercent,
      draft.delayDays,
      draft.passThroughPercent,
    ].every(Number.isFinite) &&
    draft.shortagePercent >= 0 &&
    draft.shortagePercent <= 100 &&
    draft.priceIncreasePercent >= 0 &&
    draft.priceIncreasePercent <= 300 &&
    Number.isInteger(draft.delayDays) &&
    draft.delayDays >= 0 &&
    draft.delayDays <= 30 &&
    draft.passThroughPercent >= 0 &&
    draft.passThroughPercent <= 100;
  return (
    <section className="resource-workbench">
      {material && (
        <div className="resource-detail" ref={resourcePanel}>
          <div className="resource-description">
            <span className="supply-eyebrow">
              SELECTED SUPPLY · {material.unit.toUpperCase()}
            </span>
            <h3>{material.name}</h3>
            <p>{material.description}</p>
            <div className="resource-unit">
              <strong>CAD / {material.unit}</strong>
              <span>Editable demo purchase rates · saved in this browser</span>
            </div>
            <Button
              onClick={() => {
                setDraft({ ...defaultShortage, resource: material.id });
                setShowSimulator(true);
              }}
            >
              Model a {material.name.toLowerCase()} shortage
            </Button>
          </div>
          <div className="resource-suppliers">
            <h4>
              {material.id === "diesel"
                ? "Largest consuming facilities"
                : "Prominent suppliers"}
            </h4>
            <p>
              Ranked by modeled monthly spend; alternatives follow current
              contracts. Click a name to highlight its network.
            </p>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Counterparty</th>
                    <th>Purchase rate</th>
                    <th>Monthly quantity</th>
                    <th>Modeled spend</th>
                  </tr>
                </thead>
                <tbody>
                  {(showAll ? ranked : ranked.slice(0, 3)).map((c, i) => (
                    <tr key={c.counterparty}>
                      <td>
                        <button
                          className="supplier-drilldown"
                          onClick={() => onSelect(c.nodeId)}
                        >
                          {i + 1}. {c.counterparty}
                        </button>
                        <small>{c.status}</small>
                      </td>
                      <td>
                        <label className="rate-editor">
                          <span>CAD / {material.unit}</span>
                          <input
                            aria-label={`Purchase rate for ${material.name} from ${c.counterparty}`}
                            type="number"
                            min="0.01"
                            max="100000"
                            step="0.01"
                            value={purchaseRate(material, c, rates)}
                            onChange={(e) => {
                              const v = e.target.valueAsNumber;
                              if (Number.isFinite(v) && v > 0 && v <= 100000)
                                onRates({
                                  ...rates,
                                  [rateKey(material, c)]: v,
                                });
                            }}
                          />
                        </label>
                      </td>
                      <td>
                        {c.monthlyQuantity.toLocaleString()} {material.unit}s
                      </td>
                      <td>
                        {cad(
                          c.monthlyQuantity * purchaseRate(material, c, rates),
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {ranked.length > 3 && (
              <Button design="Transparent" onClick={() => setShowAll(!showAll)}>
                {showAll ? "Show top three" : "Show all counterparties"}
              </Button>
            )}
          </div>
          <div className="resource-market">
            <div className="market-heading">
              <h4>Recent market reference</h4>
              <Button
                design="Transparent"
                disabled={loading}
                onClick={onRefresh}
              >
                {loading ? "Retrieving…" : "Refresh market data"}
              </Button>
            </div>
            {relevantQuote ? (
              <>
                <strong>
                  {relevantQuote.value.toLocaleString("en-CA", {
                    maximumFractionDigits: 5,
                  })}{" "}
                  <small>{relevantQuote.unit}</small>
                </strong>
                <p>
                  Observation: <b>{relevantQuote.period}</b>
                </p>
                <a
                  href={relevantQuote.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  {relevantQuote.source} ↗
                </a>
                <small>
                  {relevantQuote.status === "snapshot"
                    ? "Last verified snapshot"
                    : "Retrieved from public source"}{" "}
                  · checked{" "}
                  {new Date(
                    relevantQuote.retrievedAt.length === 10
                      ? `${relevantQuote.retrievedAt}T12:00:00`
                      : relevantQuote.retrievedAt,
                  ).toLocaleString("en-CA", { timeZone: "America/Vancouver" })}
                </small>
              </>
            ) : (
              <p>No matching public benchmark configured.</p>
            )}
            <p>{material.benchmarkNote}</p>
            {(relevantQuote?.error || marketError) && (
              <p className="market-warning">
                {relevantQuote?.error || marketError} Retaining the dated
                reference above.
              </p>
            )}
          </div>
        </div>
      )}
      <div className="shortage-heading">
        <div>
          <span className="supply-eyebrow">RESOURCE SHOCK LAB</span>
          <h3>What if a critical input runs short?</h3>
          <p>
            Trace fuel or fabric constraints into replenishment, unit cost and
            gross margin.
          </p>
        </div>
        <Button
          design="Emphasized"
          onClick={() => setShowSimulator(!showSimulator)}
        >
          {showSimulator ? "Hide controls" : "Simulate shortage"}
        </Button>
        {scenario && <Button onClick={onClear}>Clear shortage scenario</Button>}
      </div>
      {showSimulator && (
        <div className="shortage-controls">
          <label>
            Input to disrupt
            <select
              aria-label="Shortage resource"
              value={draft.resource}
              onChange={(e) => setDraft({ ...draft, resource: e.target.value })}
            >
              {resources.map((r) => (
                <option value={r.id} key={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
          {numberField("Supply reduction (%)", "shortagePercent", 100)}
          {numberField("Input price increase (%)", "priceIncreasePercent", 300)}
          {numberField("Additional delivery delay (days)", "delayDays", 30)}
          {numberField(
            "Supplier cost pass-through (%)",
            "passThroughPercent",
            100,
          )}
          <label>
            Planning horizon
            <select
              aria-label="Shortage planning horizon"
              value={draft.horizon}
              onChange={(e) =>
                setDraft({ ...draft, horizon: Number(e.target.value) })
              }
            >
              {[30, 45, 60].map((d) => (
                <option value={d} key={d}>
                  {d} days
                </option>
              ))}
            </select>
          </label>
          <Button
            design="Emphasized"
            disabled={!valid}
            onClick={() => onSimulate({ ...draft })}
          >
            Run shortage simulation
          </Button>
          <p className="shortage-assumptions">
            {activeResource.name}: price increase and production shortfall are
            independent assumptions. A 25% input shortage is modeled as 25% less
            new production. No assumed price elasticity. Pass-through is the
            share of added input cost charged by suppliers to the retailer;
            retail selling prices stay fixed. Changes apply when you run the
            simulation.
          </p>
        </div>
      )}
      {result && (
        <div className="shortage-results" role="status" ref={resultPanel}>
          <div className="shortage-result-title">
            <div>
              <span>ACTIVE SIMULATION · {result.config.horizon} DAYS</span>
              <h3>
                {result.resource.name}: {result.config.shortagePercent}% supply
                reduction, +{result.config.priceIncreasePercent}% price
              </h3>
              <p>
                Highlighted paths identify affected suppliers, production and
                fulfillment. Existing finished inventory stays unchanged.
              </p>
            </div>
            <Button design="Emphasized" onClick={onExplain}>
              Ask Joule: cost & margin impact
            </Button>
          </div>
          <div className="shortage-kpis">
            <div>
              <span>Added cost on completed new units</span>
              <strong>{cad(result.addedCost)}</strong>
            </div>
            <div>
              <span>Gross margin on completed new units</span>
              <strong>
                {result.scenarioMargin === null
                  ? "N/A · no units completed"
                  : `${result.baseMargin.toFixed(2)}% → ${result.scenarioMargin.toFixed(2)}%`}
              </strong>
              <small>
                {result.marginDrop === null
                  ? "No revenue denominator"
                  : `${result.marginDrop.toFixed(2)} percentage-point erosion`}
              </small>
            </div>
            <div>
              <span>Planned production deferred</span>
              <strong>
                {result.deferred} / {result.units} units
              </strong>
              <small>
                +{result.config.delayDays} days on reduced replenishment
              </small>
            </div>
            <div>
              <span>Gross profit reduction in planning cohort</span>
              <strong>{cad(result.profitReduction)}</strong>
              <small>
                {cad(result.deferredProfit)} from deferred units + added costs
              </small>
            </div>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Affected SKU</th>
                  <th>Input per garment</th>
                  <th>Base landed cost</th>
                  <th>Stressed cost / unit</th>
                  <th>Gross margin</th>
                  <th>Deferred units</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((r) => (
                  <tr key={r.o.sku}>
                    <td>
                      {r.o.product}
                      <small>{r.o.sku}</small>
                    </td>
                    <td>
                      {r.input} {result.resource.unit}
                      <small>
                        {cad(r.rate)} / {result.resource.unit}
                      </small>
                    </td>
                    <td>{cad(r.baseCost)}</td>
                    <td>
                      {cad(r.scenarioCost)}
                      <small>+{cad(r.addedPerUnit)}</small>
                    </td>
                    <td>
                      {r.baseMargin.toFixed(2)}% → {r.scenarioMargin.toFixed(2)}
                      %
                    </td>
                    <td>{r.deferred}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="shortage-assumptions">
            New-production cohort = seven-day store demand × horizon / 7,
            rounded up per SKU; online demand is excluded from this cost cohort.
            Existing input costs are included in base finished-goods cost; only
            the uplift is added. Deferred units are not assumed permanently lost
            sales. Total gross profit reduction includes their forgone profit
            within this cohort; it is distinct from per-unit margin erosion. The
            timeline below separately models current stock and a reduced,
            delayed hypothetical inbound order. No real purchase order or
            inventory record changes.
          </p>
        </div>
      )}
    </section>
  );
}
