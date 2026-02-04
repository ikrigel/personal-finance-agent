# Claude Code Guidance — Personal Finance Agent

## Project Overview

A conversational AI agent that analyzes personal expense data (Jan 2024 — Dec 2025) through natural dialogue. Uses Vercel AI SDK with Google Gemini 2.5 Flash as the LLM backend.

**Tech Stack:**
- **Frontend:** React 19 + Vite + Mantine UI
- **Backend:** Express + TypeScript + Vercel AI SDK v5
- **Architecture:** npm workspaces monorepo (`/public` frontend, `/server` backend)
- **Data:** 294 expense records in CSV format

## Getting Started

### Prerequisites
- Node.js (18+)
- Google Generative AI API key (free tier at https://aistudio.google.com/app/apikey)

### Setup

```bash
# Install dependencies in root and server directories
npm i

# Create .env file in /server
# Add: GOOGLE_GENERATIVE_AI_API_KEY=your_key_here
echo "GOOGLE_GENERATIVE_AI_API_KEY=your_key_here" > server/.env

# Run development server (frontend on :5173, backend on :3000)
npm run dev

# Open http://localhost:5173
```

## Key Constraints & Principles

### 1. Do Not Modify the Frontend
All UI components (`public/src/**`) are complete and tested. **Do not change them.** All development work happens in `server/agent/index.ts` only.

### 2. Memory Management
- **Never store the entire 294-row expense dataset in conversation memory.** It bloats context and burns tokens.
- Only store formatted results (strings or small summaries), not raw Expense[] arrays.
- Use `deepDelete()` to strip `providerOptions` from SDK responses before appending to conversation history.

### 3. Agent Design
- The agent is **stateful** — it maintains conversation history across multiple user messages (the class instance is a singleton).
- Use **manual tool execution** — no automatic SDK looping. You control exactly what gets stored in memory.
- **Three tools** handle all 13 guiding questions: `filter_expenses`, `calculate_statistics`, `get_spending_by_category`.
- Each tool is **self-contained** — accepts optional filter parameters directly (category, date range, amount threshold, excludeAnomalies).

### 4. Anomaly Detection
- Uses threshold multiplier = **2** (mean + 2 × standard deviation).
- `detectAnomalies()` returns the **outlier array** — subtract these from your filtered results.

### 5. Date Handling
- **Today is December 30, 2025.** This is baked into the system prompt.
- "last month" = November 2025, "this month" = December 2025.
- All tool calls use `YYYY-MM-DD` format for dates.

### 6. Response Format
- The agent returns **Markdown-formatted text** (never plain text or JSON).
- Use tables, bold, bullet points for clarity.
- Round all dollar amounts to 2 decimal places with `$` prefix.
- The service layer automatically converts Markdown → HTML via showdown.

## Project Structure

```
personal-finance-agent/
├── public/                      # Frontend (React + Vite) — DO NOT MODIFY
│   ├── src/
│   │   ├── App.tsx             # Main app, message state, guiding questions
│   │   ├── components/         # ChatBubble, ChatContainer, FinanceInput, GuidingQuestions
│   │   └── index.css
│   ├── vite.config.ts
│   └── package.json
│
├── server/                      # Backend (Express + AI SDK)
│   ├── agent/
│   │   ├── index.ts            # ✅ FinanceAgent class — MAIN IMPLEMENTATION
│   │   └── types.ts            # Expense interface
│   ├── routes/
│   │   └── financeAssistantRoutes.ts
│   ├── controllers/
│   │   └── financeAssistantController.ts
│   ├── services/
│   │   └── financeAssistantService.ts
│   ├── utils/
│   │   ├── anomaly-helper.ts   # detectAnomalies(expenses, multiplier)
│   │   ├── array-helpers.ts    # groupBy<T>()
│   │   ├── date-helpers.ts     # parseDate(), isBetween()
│   │   ├── general.ts          # sleep(), deepDelete()
│   │   ├── math-helpers.ts     # sum, mean, median, min, max
│   │   └── csv-loader.ts       # loadExpensesFromCSV()
│   ├── expenses_data/
│   │   └── expenses_2024-2025.csv
│   ├── server.ts
│   ├── tsconfig.json
│   └── package.json
│
├── tsconfig.json               # Covers both workspaces
├── .prettierrc
├── eslint.config.js
├── README.md
├── claude.md                   # This file
└── ARCHITECTURE.md             # Detailed design docs
```

## Environment Variables

| Variable | Location | Purpose |
|----------|----------|---------|
| `GOOGLE_GENERATIVE_AI_API_KEY` | `server/.env` | Authenticates calls to Google Gemini API |
| `PORT` | `server/.env` (optional) | Express listen port; defaults to 3000 |

**Important:** The `.env` file is in `.gitignore` — never commit API keys.

## Utilities — Reuse These

All utilities in `server/utils/` are battle-tested. Reuse them in the agent implementation:

| Function | Signature | Purpose |
|----------|-----------|---------|
| `sum` | `(numbers: number[]) => number` | Sum array of amounts |
| `mean` | `(numbers: number[]) => number` | Average (returns 0 if empty) |
| `median` | `(numbers: number[]) => number` | Median (handles even/odd) |
| `min` / `max` | `(numbers: number[]) => number` | Min/max value |
| `groupBy<T>` | `(array: T[], keyFn) => Record<string, T[]>` | Group by key function |
| `isBetween` | `(date, startDate?, endDate?) => boolean` | Inclusive date range check |
| `parseDate` | `(dateString: string) => Date` | Parse YYYY-MM-DD |
| `detectAnomalies` | `(expenses, multiplier) => Expense[]` | Returns **outlier array** (subtract them) |
| `deepDelete` | `(obj, key) => obj` | Recursively delete property (strips `providerOptions`) |

## Testing

There is **no test suite** in this repo. Verification is manual via the UI:

1. Run `npm run dev`
2. Open http://localhost:5173
3. Test each of the 13 guiding questions
4. Verify responses match expected validation answers in [README.md](README.md)
5. Test follow-up questions (agent should remember context without re-asking)

## Common Issues

### 500 Error on API Calls
If you see `API Error: 500 {...}` — check:
1. `GOOGLE_GENERATIVE_AI_API_KEY` is set in `server/.env`
2. The key is valid (test at https://aistudio.google.com/app/apikey)
3. Your internet connection is working

### Dates Not Resolving Correctly
The system prompt anchors today to **December 30, 2025**. If the LLM ignores this, remind it in the prompt.

### Memory Growing Too Large
If context grows rapidly, check:
1. Are you storing raw Expense[] arrays in messages? (You shouldn't be)
2. Are you calling `deepDelete(messages, 'providerOptions')`?
3. Are `filter_expenses` results compact strings, not raw objects?

## References

- [README.md](README.md) — Project exercise description and validation answers
- [ARCHITECTURE.md](ARCHITECTURE.md) — Detailed system design, tool catalog, data flow
- [Vercel AI SDK Docs](https://sdk.vercel.ai/)
- [Google Generative AI](https://ai.google.dev/)
- [Zod Schema Validation](https://zod.dev/)
