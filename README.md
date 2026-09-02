# Myntra Discovery Engine

Evidence-driven insights into what keeps Myntra shoppers from converting wishlisted items into purchases. Analyzes public reviews and discussions across Google Play, App Store, YouTube, and Reddit to surface behavioural barriers, ranked opportunities, and interview-ready user segments.

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Start the development server
npm run dev

# 3. Open in browser
open http://localhost:3000
```

The app loads the provisional evidence corpus by default (11,903 units from 4 public sources).

## Available Modes

| Mode | How to activate | Description |
|------|-----------------|-------------|
| **Provisional** | Default (`DATA_MODE=provisional` in `.env`) | Real public-evidence corpus |
| Fixtures | `npm run dev:fixtures` | Fictional demo data for testing |
| Empty | Set `DATA_MODE=empty` in `.env` | App shell with no data |

## Enable the AI Copilot (optional)

The Copilot works out of the box with **evidence-based** answers (deterministic retrieval, no key
needed). To get **AI-written** answers grounded in the same evidence, add a free Google Gemini key:

```bash
# 1. Get a free key at https://aistudio.google.com/apikey
# 2. Copy the example environment file:
cp .env.example .env

# 3. Open .env and add your key:
#    GEMINI_API_KEY=your_key_here

# 4. Restart the server:
npm run dev
```

That's the only change needed — `ENABLE_RUNTIME_LLM=true` is already set. The Copilot badge will read
"Gemini-generated" once a valid key is active.

Notes:
- If a model ID is ever unavailable, the client rotates through fallbacks
  (`gemini-3.6-flash` → `gemini-3.5-flash-lite` → `gemini-flash-latest`). Override with `GEMINI_MODEL`.
- If the key is missing or every model call fails, Copilot silently returns the evidence-based
  answer — it never errors out.
- The LLM only writes the answer prose; all citations and typed fields are computed deterministically
  from retrieved evidence, so answers stay grounded.

## Production Build

```bash
npm run build
npm start
```

## App Structure

- **Overview** — KPI summary, barrier ranking, top opportunities, source coverage
- **Analytics** — Filters, source/relevance breakdowns, monthly trends, barrier heatmap
- **Opportunities** — Ranked product opportunities with evidence, experiments, interview questions
- **Segments** — 5 behavioural user segments ranked by evidence share and severity
- **Themes** — Auto-detected discovery themes with source mix and representative evidence
- **Evidence** — Full-corpus explorer with search, filters, and pagination
- **Copilot** — Ask questions answered with evidence-grounded retrieval
- **Methodology** — Pipeline stages, validation approach, source coverage, claim boundaries

## Tech Stack

- Next.js 16 (App Router, Turbopack)
- TypeScript, React 19, Tailwind CSS
- Server components with `loadActiveRelease()` data layer
- Cursor-based pagination, Zod schema validation
- Deterministic classification pipeline (no external LLM calls at runtime)

## Scripts

```bash
npm run dev              # Dev server (port 3000)
npm run build            # Production build
npm run start            # Serve production build
npm run typecheck        # TypeScript check
npm run test             # Unit tests
npm run test:e2e         # End-to-end tests
```

## Data

Evidence data lives in `data/releases/`. The provisional release (`myntra-provisional-20260823-005`) contains 11,903 canonical public evidence units from 4 sources. All data is PII-stripped and derived from public reviews/discussions.

## License

Private — not for redistribution.
