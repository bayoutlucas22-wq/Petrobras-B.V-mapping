# Petrobras B.V. Study Case

An interactive React Flow study case focused on Dutch B.V. entities appearing in the Petrobras offshore contract ecosystem.

## What it does

- Interactive graph of the B.V. structure
- Search and filter by status and entity kind
- Detail panel for selected nodes
- Timeline of the study narrative
- Source/reference links

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

GitHub Pages:

- Use `npm run build:gh-pages`
- Publish the `dist` folder
- If you rename the repository, update the base path in `package.json` or pass a different `--base` value in the script

## Notes

- This repository is framed as a study case, not a legal finding.
- Evidence labels distinguish confirmed, partial, and unresolved relationships.
- The graph is intended to be reactive and explorable, not a static infographic.
