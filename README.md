# SAP Retail Signal

A runnable SAP Fiori retail demand and response competition concept. Connect fitting-room interest and online out-of-stock demand to inventory, supplier dependencies and coordinated stock transfers.

[Open the private demo](https://retail-signal-fiori-cv.figomyx.chatgpt.site/)

## Run locally

Requires Node.js 22+.

```sh
cd retail-signal
npm ci
npm run dev
```

Build with `npm run build` and run analytical/workflow tests with `npm test` from `retail-signal/`.

## Main features

- Connected demand opportunities from store and digital signals.
- Interactive grayscale location map with shortage alerts and transfer proposals.
- Visual supply-chain relationship explorer: select a supplier, product or facility to trace dependencies, model delays and act on affected opportunities.
- Estimated no-action sales exposure, online availability scenarios and seasonal planning.
- SAP-aligned stock transport workflow with proposals, approval, goods issue, in-transit quantities and receipt.
- S/4HANA mapping drafts, IBP planning handoffs and optional Google Maps setup.

All enterprise data and SAP execution are explicitly simulated. No Bloomberg, live SAP or customer tracking connection is claimed.

The full application source, fonts, dependency lockfile and tests are included under [`retail-signal/`](./retail-signal/). See the [application README](./retail-signal/README.md) for architecture, assumptions, integration setup and the demo script. Generated build files and installed dependencies are excluded; rebuild them locally.
