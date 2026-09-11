# Inventory Intelligence Dashboard

A local-first React dashboard for exploring the supplied asset inventory CSV. It follows the enterprise dashboard reference with filter controls, KPI summaries, aggregated regional totals, a paginated sortable register, CSV export, and an asset detail drawer.

## Stack

- React 18+ and TypeScript
- Vite
- Vitest and jsdom for synthetic unit tests
- Lucide React icons
- react-simple-maps with bundled world-atlas geography data
- No analytics, external APIs, or runtime CSV uploads

## Setup and commands

```bash
npm install
npm run dev
npm run test
npm run lint
npm run build
npm run preview
```

The development server opens at the URL printed by Vite (normally `http://localhost:5173`).

## Data

The production input is [public/data/assets.csv](public/data/assets.csv). The supplied source file is copied there as part of setup for this workspace. Expected columns are:

`Asset ID`, `Description`, `Assigned To`, `Manufacturer`, `Model`, `Serial #`, `Processor`, `Harddrive Size`, `RAM`, `Warranty Expiration Date`

The CSV parser supports quoted commas, escaped quotes, CRLF/LF line endings, and blank rows. Values are trimmed, blank values receive readable display fallbacks, manufacturers are title-cased, and each row receives an internal stable row ID. Blank or repeated asset IDs do not crash the app or collide internally.

Changing the CSV requires replacing `public/data/assets.csv` and rebuilding or refreshing the deployed site, depending on the hosting model.

## Classification rules

Region classification uses ordered longest-prefix matching: `ECBRA` -> Brazil, `ECMEX` -> Mexico, `EM000` -> EMEA, `JP000` -> Japan, `LA000` -> Latin America, `USA`/`USD`/`USP`/`USPRT`/`US` -> USA, `AP` -> APAC, `EBRA` -> Brazil, `EC` -> Latin America, `RFID` -> Global, otherwise Unknown. The implementation sorts prefix rules by length before matching so specific USA subcategories are handled before the general US rule.

Categories are derived from normalized description, manufacturer, and model text. Laptop, desktop, mobile, monitor, dock, printer, network, RFID, tablet, accessory, and Other are supported. Warranty status is Active, Expiring soon (within 90 days), Expired, or Unknown relative to the dashboard date.

To add a region, add a prefix and label in `src/lib/regions.ts`. To change classification or category behavior, update `src/lib/normalization.ts` and its synthetic tests.

## Performance and privacy

The CSV is fetched and parsed once. Normalized records, filter results, dependent model choices, sorted rows, and region aggregates are memoized. The register uses pagination instead of rendering thousands of rows, and the regional view aggregates by region rather than placing a marker for every asset. Loading and parsing-error states are explicit.

This client-side delivery exposes the underlying CSV to anyone who can access the website. Authentication and authorization are required before production deployment; this project intentionally does not create an authentication system. Do not add third-party analytics or transmit CSV contents to external services. Full records are not written to the browser console or error telemetry. Values are safely rendered as React text and `dangerouslySetInnerHTML` is not used.

Synthetic records only are used in automated tests. Real names, serial numbers, and asset records should not be added to source fixtures.

## Known data-quality limitations

The source inventory contains inconsistent capitalization, missing IDs, duplicate serials, malformed or historical dates, mixed storage/RAM units, and descriptive status text embedded in free-text fields. The app preserves source values for inspection and applies display-level normalization; it does not silently rewrite the source data.

## Deployment

Build with `npm run build` and serve the `dist` directory from an authenticated internal host. Ensure the host serves `public/data/assets.csv` at `/data/assets.csv`. Restrict access by region/role as required by your organization before exposing this inventory.

### GitHub and Azure Static Web Apps

The repository includes `.github/workflows/azure-static-web-apps.yml`. It runs install, lint, tests, and the production build on pushes to `main`, then deploys `dist` with the Azure Static Web Apps action. In the GitHub repository, add the Azure deployment token as the `AZURE_STATIC_WEB_APPS_API_TOKEN` Actions secret. The token is generated in the Azure Static Web App resource under deployment tokens.

Create the repository and push the `main` branch with Git, then add the repository to Azure Static Web Apps or set the workflow secret manually. GitHub and Azure credentials must never be committed to this repository. The included `staticwebapp.config.json` provides SPA fallback routing and basic response headers.
