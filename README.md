# Petrobras B.V. Study Case

An interactive React Flow study case focused on Dutch B.V. entities appearing in the Petrobras offshore contract ecosystem, with an emphasis on tracing money flow.

The map in this repo is the curated source of truth. The CSV and correlation files are supporting evidence used to validate, correlate, and extend the structure for money-flow analysis.

## Scope

The current map captures both upstream asset vehicles and adjacent B.V.-based vendors/services that appear in the contract record, but it does so through a normalized and reviewed relationship graph designed to trace money flow rather than a raw label dump.

### Petrobras-linked entities

These are the direct or clearly Petrobras-adjacent B.V. entities represented in the map and used as anchors for flow correlation:

- `Petrobras Netherlands B.V.`
- `Petrobras Netherlands B.V. - PNBV`
- `Petrobras Global Trading B.V.`
- `Tupi B.V.`
- `Roncador B.V.`
- `Guara B.V.`
- `Lapa Oil & Gas B.V.`
- `Papa Terra B.V.`

### Upstream / offshore project vehicles

These B.V.s are tied to FPSOs, drilling units, or field-linked offshore structures and are the main upstream money-flow nodes:

- `Tamandare B.V.`
- `Mero 2 B.V.`
- `Libra MV 31 B.V.`
- `Buzios5 MV32 B.V.`
- `Sepia MV30 B.V.`
- `Marlim1 MV33 B.V.`
- `Yinson Boronia Production B.V.`
- `Gas Opportunity MV20 B.V.`
- `Opportunity MV18 B.V.`
- `Tartaruga MV29 B.V.`
- `Boipeba Drilling B.V.`
- `Comandatuba Drilling B.V.`
- `Interlagos Drilling B.V.`
- `Itapema Drilling B.V.`
- `Ondina Drilling B.V.`
- `Pituba Drilling B.V.`
- `Grumari Drilling B.V.`
- `Ipanema Drilling B.V.`
- `Leblon Drilling B.V.`
- `Leme Drilling B.V.`
- `Marambaia Drilling B.V.`
- `Arpoador Drilling B.V.`
- `Brava Drilling B.V.`
- `Copacabana Drilling B.V.`
- `Diamond Offshore Netherlands B.V.`
- `Positive Investment Management B.V.`
- `Aquarius Brasil B.V.`
- `DUH Boats 2 B.V.`
- `NB Constellation B.V.`
- `Baru International B.V.`
- `SAME Netherlands B.V.`

### Other B.V. entities in the CSV

The supporting data also contains B.V.-based vendors and service providers that are not upstream asset vehicles, but they still matter because they show adjacent spend paths and value leakage points:

- `Geoquest Systems B.V.` and `Geoquest System B.V.`
- `Elsevier B.V.`
- `R&V Engineering B.V.`
- `Frames Energy Systems B.V.`
- `DNV Netherlands B.V.`
- `Worley Nederland B.V.`
- `AIMMS B.V.`
- `Composite Analytica B.V.`
- `Grofsmederij Nieuwkoop B.V.`
- `Smit Salvage B.V.`
- `Bluebox Events B.V.`
- `Engineering Trainer B.V.`
- `London Tower Management B.V.`
- `Navingo B.V.`
- `Petrotechnical Data Systems B.V.`
- `Strohm B.V.`
- `Core Laboratories Sales B.V.`
- `Doedijns B.V.`
- `Expro Worldwide B.V.`
- `Stamicarbon B.V.`
- `Synergy B.V.`
- `Norit Nederland B.V.`
- `Peloton E.U. B.V.`

## What it does

- Interactive graph of the B.V. structure
- Search and filter by status and entity kind
- Detail panel for selected nodes
- Timeline of the study narrative
- Source/reference links
- CSV-backed evidence tracking for upstream and adjacent B.V. labels
- Correlation of contract values, counterparties, and offshore asset chains

## Run locally

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Deploy

Vercel:

- Connect the repository and use the default build command: `npm run build`
- Leave the output directory as `dist`
- This repo also includes a [`vercel.json`](./vercel.json) file with the build settings already pinned

GitHub Pages:

- Use `npm run build:gh-pages`
- Publish the `dist` folder
- If you rename the repository, update the base path in `package.json` or pass a different `--base` value in the script

## Notes

- This repository is framed as a study case, not a legal finding.
- Evidence labels distinguish confirmed, partial, and unresolved relationships.
- The graph is intended to be reactive and explorable, not a static infographic.
- The CSV and correlation artifacts are evidence inputs; the map is the reviewed synthesis.
- The main analytical question is money flow: which B.V.s receive spend, how concentrated it is, and which offshore structures it supports.
- Some labels appear with alias variants or punctuation differences, such as `Petrobras Netherlands B.V.` vs `Petrobras Netherlands B.V. - PNBV`.
