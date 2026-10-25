import {
  resources,
  resourceSkus,
  defaultShortage,
  simulateResourceShortage,
  purchaseRate,
} from "./resources";
import type { ShortageConfig, PurchaseRates } from "./resources";
import type { MarketQuote } from "./market";
import { opportunities, demandFor, stockFor, money } from "./data";
import type { DemoState } from "./data";
import { conversion } from "./analytics";
import { proposalFor, networkIssues } from "./supplyNetwork";
import { transferable, salesRisk } from "./planning";
import { simulateCascade } from "./cascade";
import type { CascadeConfig } from "./cascade";

export interface AssistantContext {
  name: string;
  skus: string[];
  nodeId?: string;
  shortage?: ShortageConfig;
  purchaseRates?: PurchaseRates;
  marketQuotes?: MarketQuote[];
  timeline?: CascadeConfig & {
    day: number;
    view: "baseline" | "delayed" | "response";
  };
}
export interface AssistantAnswer {
  summary: string;
  evidence: string[];
  assumptions: string;
  opportunityId: string;
  sources?: { label: string; url: string }[];
}
export function answerQuestion(
  question: string,
  state: DemoState,
  context: AssistantContext,
): AssistantAnswer {
  const related = opportunities.filter((o) => context.skus.includes(o.sku));
  const o = related[0] || opportunities[0];
  const q = question.toLowerCase();
  const proposal = proposalFor(o, state);
  const answer: AssistantAnswer = {
    summary: "",
    evidence: [],
    opportunityId: o.id,
    assumptions:
      "Seeded demo records; interest is not a guaranteed sale. Scenarios do not execute actions. Review a proposal before approval, dispatch and receipt.",
  };
  const formatCost = (n: number) =>
    new Intl.NumberFormat("en-CA", {
      style: "currency",
      currency: "CAD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n);
  const selectedResource = resources.find(
    (r) => `material:${r.id}` === context.nodeId,
  );
  if (
    /shortage|margin/.test(q) ||
    (context.shortage && /cost|impact|explain/.test(q))
  ) {
    const namedResource = /diesel|transport fuel|gasoline/.test(q)
      ? "diesel"
      : /natural gas|gas shortage/.test(q)
        ? "gas"
        : undefined;
    const config: ShortageConfig = {
      ...(context.shortage || {
        ...defaultShortage,
        resource: selectedResource?.id || "diesel",
      }),
      ...(namedResource ? { resource: namedResource } : {}),
    };
    const result = simulateResourceShortage(
      state,
      config,
      context.purchaseRates,
    );
    const skus = resourceSkus(result.resource);
    const runConfig: CascadeConfig = {
      supplier: context.timeline?.supplier || o.supplier,
      delayDays: context.timeline?.delayDays || 0,
      horizon: config.horizon,
      demandPercent: context.timeline?.demandPercent || 100,
      inboundWeeks: context.timeline?.inboundWeeks || 4,
      response: "none",
      sku: "All products",
    };
    const baseline = simulateCascade(state, { ...runConfig, delayDays: 0 });
    const stressed = simulateCascade(state, {
      ...runConfig,
      resourceShock: {
        skus,
        supplyPercent: 100 - config.shortagePercent,
        delayDays: config.delayDays,
      },
    });
    const day = Math.min(
      context.timeline?.day ?? config.horizon,
      config.horizon,
    );
    const incrementalLoss =
      stressed.days[day].cumulativeLoss - baseline.days[day].cumulativeLoss;
    const quote = context.marketQuotes?.find(
      (q) => q.series === result.resource.benchmark,
    );
    answer.summary = `${result.resource.name}: ${context.shortage ? "the active" : "an illustrative"} ${config.shortagePercent}% supply reduction, ${config.priceIncreasePercent}% input-price rise and ${config.delayDays}-day delay add ${formatCost(result.addedCost)} to completed new production over ${config.horizon} days. ${result.scenarioMargin === null ? "No units complete, so a percentage margin is undefined." : `Weighted gross margin falls from ${result.baseMargin.toFixed(2)}% to ${result.scenarioMargin.toFixed(2)}% (${result.marginDrop!.toFixed(2)} percentage points).`}`;
    answer.evidence = [
      `${result.deferred} of ${result.units} planned new units are deferred. Planning-cohort gross profit decreases ${formatCost(result.profitReduction)}: ${formatCost(result.addedCost)} added input costs plus ${formatCost(result.deferredProfit)} profit on deferred units. This does not assume those deferred sales are permanently lost.`,
      ...result.rows
        .slice(0, 3)
        .map(
          (r) =>
            `${r.o.sku}: ${r.input} ${result.resource.unit} × ${formatCost(r.rate)}/${result.resource.unit} × ${config.priceIncreasePercent}% increase × ${config.passThroughPercent}% supplier pass-through = ${formatCost(r.addedPerUnit)} added per completed garment. Landed unit cost ${formatCost(r.baseCost)} → ${formatCost(r.scenarioCost)}; margin ${r.baseMargin.toFixed(2)}% → ${r.scenarioMargin.toFixed(2)}%.`,
        ),
      `Propagation: ${result.resource.name} → ${result.resource.id === "diesel" ? "distribution transport" : "supplier production"} → reduced, delayed receipts → stores and online. ${skus.length} SKUs are exposed. Existing stock is preserved. The separate stock simulation projects ${formatCost(Math.max(0, incrementalLoss))} additional estimated sales foregone by day ${day} versus original supply timing (70% lost-sale assumption). Do not add this revenue estimate to the planning-cohort gross profit reduction.`,
      quote
        ? `Public reference: ${quote.label}, ${quote.value} ${quote.unit}, observation ${quote.period}; ${quote.status === "snapshot" ? "dated snapshot" : "retrieved public observation"}. ${result.resource.benchmarkNote}`
        : result.resource.benchmarkNote,
      "Response: check existing uncommitted inventory and use the transfer workflow for immediate coverage; validate fuel surcharge clauses and supplier quotes before accepting cost pass-through. Alternative suppliers may share the same input shock; switching alone is not guaranteed to remove it.",
    ];
    if (quote) answer.sources = [{ label: quote.source, url: quote.sourceUrl }];
    answer.assumptions =
      "Illustrative procurement rates, physical input requirements, fixed retail prices and 1:1 input-shortfall-to-new-production reduction. Base finished-goods cost already includes current inputs; only their uplift is added. Baseline cost includes CAD 1.50 freight/unit. Public USD benchmarks are not converted into CAD purchase rates. Simulation does not execute purchasing or change saved inventory.";
  } else if (
    selectedResource &&
    /pay|purchase|market|cost|yard|price/.test(q)
  ) {
    const quote = context.marketQuotes?.find(
      (q) => q.series === selectedResource.benchmark,
    );
    answer.summary = `${selectedResource.name} is purchased per ${selectedResource.unit}. These are editable demo procurement rates, not verified invoices.`;
    answer.evidence = [
      ...selectedResource.contracts
        .slice(0, 3)
        .map(
          (c) =>
            `${c.counterparty}: ${formatCost(purchaseRate(selectedResource, c, context.purchaseRates || {}))}/${selectedResource.unit}; ${c.monthlyQuantity} ${selectedResource.unit}s/month modeled; ${c.status}.`,
        ),
      quote
        ? `${quote.label}: ${quote.value} ${quote.unit}, observation ${quote.period}. ${selectedResource.benchmarkNote}`
        : selectedResource.benchmarkNote,
    ];
    if (quote) answer.sources = [{ label: quote.source, url: quote.sourceUrl }];
  } else if (/delay|disrupt|scenario|downstream|day\b/.test(q)) {
    const requested = q.match(
      /(?:by|additional|delay(?:ed)?(?: by)?)\s*(\d+)\s*days?/,
    );
    const t = context.timeline;
    const config: CascadeConfig = t
      ? { ...t }
      : {
          supplier: o.supplier,
          delayDays: 10,
          horizon: 45,
          demandPercent: 100,
          inboundWeeks: 4,
          response: "rebalance",
          sku: o.sku,
        };
    if (requested) config.delayDays = Math.min(45, Number(requested[1]));
    const baseline = simulateCascade(state, {
      ...config,
      delayDays: 0,
      response: "none",
    });
    const delayed = simulateCascade(state, { ...config, response: "none" });
    const response = simulateCascade(state, config);
    const day =
      t?.day ?? Math.min(config.horizon, o.lead + config.delayDays + 2);
    const loss = (run: typeof baseline) =>
      run.days[day].records.reduce(
        (sum, r) =>
          sum +
          (context.skus.includes(r.sku)
            ? r.cumulativeUnmet *
              (opportunities.find((p) => p.sku === r.sku)?.price || 0) *
              0.7
            : 0),
        0,
      );
    const receipts = delayed.events.filter(
      (e) =>
        e.kind === "supplier-arrival" &&
        e.from === config.supplier &&
        context.skus.includes(e.sku),
    );
    answer.summary = `${config.supplier} with ${config.delayDays} additional delay days: by day ${day}, selected-SKU estimated sales foregone is ${money(loss(delayed))}, versus ${money(loss(baseline))} with original timing.`;
    answer.evidence = [
      `Incremental modeled exposure: ${money(Math.max(0, loss(delayed) - loss(baseline)))}. ${config.response === "none" ? "No response selected." : `The ${config.response} response projects ${money(loss(response))} sales foregone; compare source-store consequences too.`}`,
      receipts.length
        ? `Warehouse receipts: ${receipts.map((e) => `${e.sku} on day ${e.day}`).join("; ")}. Distribution transit takes two additional days.`
        : "No selected-SKU receipt from this supplier appears within the horizon.",
      `Assumptions: ${config.horizon}-day horizon; demand ${config.demandPercent}%; hypothetical supplier order covers ${config.inboundWeeks} weeks; lost demand × retail price × 70%. Materials and production are illustrative relationships, without separate capacity simulation.`,
    ];
  } else if (/transfer|stock|stores|units|cover/.test(q)) {
    const match = q.match(/(?:transfer|move)\s+(-?\d+(?:\.\d+)?)/);
    const quantity = match ? Number(match[1]) : proposal.quantity;
    const maximum = transferable(state, proposal.source);
    const valid =
      Number.isInteger(quantity) && quantity > 0 && quantity <= maximum;
    const demand = demandFor(o, state),
      stock = stockFor(o, state);
    answer.summary = valid
      ? `A ${quantity}-unit transfer from ${proposal.source.location} is feasible from current uncommitted stock. It would bring ${o.location} to ${stock + quantity} units on receipt.`
      : `That transfer is not currently feasible. ${proposal.source.location} has ${maximum} uncommitted units available; use a positive whole quantity within that limit.`;
    answer.evidence = [
      `${o.sku}: ${proposal.source.stock} source units, ${proposal.source.reserve} protected reserve, ${maximum} transferable after open commitments. Destination: ${stock} on hand / ${demand} units of seven-day demand.`,
      valid
        ? `Two-day transit; ${money(quantity * 1.5)} transport cost. Remaining gap after receipt: ${Math.max(0, demand - stock - quantity)} units. Estimated exposure after receipt: ${money(salesRisk(demand, stock + quantity, o.price, 70).expected)}.`
        : `Suggested additional proposal: ${proposal.quantity} units, capped by the uncovered gap and existing incoming commitments.`,
      "Proposing or approving does not increase destination stock. Goods issue creates transit stock; goods receipt makes it sellable. Sales lost before arrival are not recovered by this static comparison.",
    ];
  } else if (
    /why|flag|recommend|demand|caus|explain|risk|exception|issue|material|production|suppl/.test(
      q,
    )
  ) {
    const issues = networkIssues(state, new Set(context.skus));
    answer.summary = `${context.name} connects ${related.length} SKUs to ${issues.filter((i) => i.severity === "Error").length} current availability exceptions. ${proposal.quantity ? `For ${o.sku}, propose ${proposal.quantity} units from ${proposal.source.location} to address the immediate gap.` : `For ${o.sku}, review incoming commitments and other source locations before adding a transfer.`}`;
    answer.evidence = [
      ...issues
        .slice(0, 4)
        .map((i) => `${i.source} · ${i.title}: ${i.evidence}`),
      `${o.sku} demand evidence: ${o.tries} try-ons, ${o.purchases} purchases (${conversion(o.purchases, o.tries)}% vs ${o.baseline}% baseline), ${o.oos} qualified out-of-stock sessions; demand growth ${o.growth}%.`,
      o.id === opportunities[0].id
        ? "Coastal Textiles offers 120 units at CAD 14.50/unit with 9-day lead time. It arrives outside the immediate seven-day window; request buyer review."
        : `${o.supplier} lead time is ${o.lead} days. No approved alternative capacity is modeled for this SKU.`,
    ];
  } else {
    answer.summary = `I can explain ${context.name}, inspect its current exceptions, calculate a transfer quantity, or compare a supplier delay. Ask “Explain the network risks”, “Transfer 20 units” or “Supplier delayed by 10 days”.`;
    answer.evidence = [
      `Context: ${context.skus.join(", ")}. Answers are calculated from the current saved demo state.`,
    ];
  }
  return answer;
}
