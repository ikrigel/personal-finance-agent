# Architecture — Personal Finance Agent

## System Overview

A stateful conversational AI agent that processes natural language queries about personal expenses. The agent maintains conversation memory, delegates computations to specialized tools, and returns formatted responses.

```
User Input
    ↓
React UI (App.tsx)
    ↓ POST /api/ask_finance_assistant
Express Controller
    ↓
Service Layer (singleton FinanceAgent instance)
    ↓
FinanceAgent.run(query)
    ├─ Add user message to history
    ├─ generateText() with Gemini 2.5 Flash
    │  ├─ If finishReason = 'stop' → return text
    │  └─ If finishReason = 'tool-calls' → execute tools
    │     ├─ filter_expenses
    │     ├─ calculate_statistics
    │     └─ get_spending_by_category
    └─ Return Markdown response
    ↓
showdown (Markdown → HTML)
    ↓
JSON response { answer: "..." }
    ↓
React ChatBubble (dangerouslySetInnerHTML)
```

---

## Core Components

### 1. FinanceAgent Class (`server/agent/index.ts`)

**Instance State:**
- `expenses: Expense[]` — full 294-row dataset, loaded once at startup
- `messages: Array<{ role, content }>` — conversation history, persists across `run()` calls

**Entry Point:**
```typescript
async run(query: string): Promise<string>
```

Implements a manual agentic loop:
1. Push user query onto `messages`
2. Call `generateText()` with Gemini model + tools
3. Strip `providerOptions` bloat via `deepDelete()`
4. Append assistant message to `messages`
5. **If tool calls are needed:** Execute each tool, aggregate results, push tool-result message, loop back to step 2
6. **If done (finishReason = 'stop'):** Return the final text response

**Key Memory Discipline:**
- Raw Expense[] arrays are **never** stored in messages
- Only formatted strings/objects go into conversation history
- `deepDelete()` is called every iteration to strip SDK metadata

### 2. Three Self-Contained Tools

Each tool accepts optional filters directly (category, date range, amount, anomalies flag) so the LLM doesn't have to chain calls.

#### Tool 1: `filter_expenses`

**Purpose:** Retrieve a list of expenses matching criteria.

**Input Schema:**
```typescript
{
  category?: string,        // "groceries", "dining", etc.
  startDate?: string,       // "2025-11-01"
  endDate?: string,         // "2025-11-30"
  minAmount?: number,       // e.g., 50
  maxAmount?: number,       // e.g., 500
  excludeAnomalies?: boolean,
  limit?: number
}
```

**Output:**
Markdown table string (NOT raw array):
```
Found 15 expenses:

| Date | Vendor | Category | Amount |
|------|--------|----------|--------|
| 2025-11-05 | Trader Joe's | Groceries | $85.32 |
| ...
```

**Logic:**
1. Apply filters via `applyFilters()`
2. If `excludeAnomalies`: subtract outliers (detect with multiplier=2)
3. Sort by amount descending
4. Apply `limit` if provided
5. Format as markdown table

---

#### Tool 2: `calculate_statistics`

**Purpose:** Compute a single aggregate metric on filtered data.

**Input Schema:**
```typescript
{
  metric: enum['sum', 'mean', 'median', 'min', 'max'],
  category?: string,
  startDate?: string,
  endDate?: string,
  minAmount?: number,
  maxAmount?: number,
  excludeAnomalies?: boolean
}
```

**Output:**
```typescript
{
  metric: 'sum',
  value: 288.75,           // rounded to 2dp
  count: 12,               // how many expenses went into this
  category: 'groceries',
  startDate: '2025-11-01',
  endDate: '2025-11-30'
}
```

**Logic:**
1. Filter via `applyFilters()`
2. If `excludeAnomalies`: subtract outliers
3. Extract amounts, call appropriate math-helper (sum/mean/median/min/max)
4. Return as structured object (compact, self-documenting)

---

#### Tool 3: `get_spending_by_category`

**Purpose:** Group expenses by category and compute an aggregate per group.

**Input Schema:**
```typescript
{
  startDate?: string,
  endDate?: string,
  metric: enum['sum', 'mean', 'median', 'count'],  // default 'sum'
  excludeAnomalies?: boolean,
  topN?: number           // if provided, return only top N by metric
}
```

**Output:**
```typescript
{
  metric: 'sum',
  categories: [
    { name: 'groceries', value: 288.75, count: 12 },
    { name: 'dining', value: 72.69, count: 8 },
    { name: 'utilities', value: 148.90, count: 3 }
  ],
  period: { startDate: '2025-11-01', endDate: '2025-11-30' }
}
```

**Logic:**
1. Filter by date range (if provided)
2. Group with `groupBy()` → `Record<category, Expense[]>`
3. Per group:
   - If `excludeAnomalies`: detect & subtract outliers within that group
   - Extract amounts, compute metric
   - Push to categories array
4. Sort descending by metric value
5. If `topN`: slice to that count
6. Return structured object

---

## Shared Utilities

### `applyFilters(expenses, params)`
Internal helper. Chains filter operations in order:
1. Category (case-insensitive)
2. Date range (via `isBetween()`)
3. Amount range (`minAmount`, `maxAmount`)

Returns filtered array.

### `executeTool(toolName, input, expenses)`
Dispatcher. Routes tool calls to execution logic, returns result (string or object).

---

## Expense Data

### Source File
`server/expenses_data/expenses_2024-2025.csv`

### Structure
294 rows, columns: `date`, `amount`, `category`, `vendor`

### Date Range
2024-01-02 through 2025-12-30

### Categories
- `groceries`
- `dining`
- `entertainment`
- `shopping`
- `transportation`
- `utilities`
- `subscriptions`
- `health`

### Key Statistics (all time)
- Total expenses: 11,742.45
- Categories: 8
- Avg expense: 39.95
- Median expense: 31.25
- Min: $0.50, Max: $1,190.00

### Anomalies (with multiplier=2)
Notable outliers include: $1,190 (electronics), $1,049 (IKEA), $980 (sushi), $899 (shopping), $650 (dining, 2x), $480 (escape room), etc.

---

## 13 Guiding Questions → Tool Mapping

| # | Question | Tool(s) | Key Parameters |
|---|----------|---------|----------------|
| 1 | Groceries last month? | `calculate_statistics` | metric=sum, category=groceries, dates=Nov 2025 |
| 2 | All expenses from September? | `filter_expenses` | startDate=2025-09-01, endDate=2025-09-30 |
| 3 | Expenses over $200? | `filter_expenses` | minAmount=200 |
| 4 | Average dining expense? | `calculate_statistics` | metric=mean, category=dining |
| 5 | Spending by category last month? | `get_spending_by_category` | dates=Nov 2025 |
| 6 | Total entertainment last month? | `calculate_statistics` | metric=sum, category=entertainment, dates=Nov 2025 |
| 7 | Compare grocery Sept vs Oct? | `calculate_statistics` (2×) | (1) Sept+groceries (2) Oct+groceries |
| 8 | Median dining, exclude outliers? | `calculate_statistics` | metric=median, category=dining, excludeAnomalies=true |
| 9 | Top 3 categories last month? | `get_spending_by_category` | dates=Nov 2025, topN=3 |
| 10 | Avg entertainment this month vs last? | `calculate_statistics` (2×) | (1) Dec+entertainment (2) Nov+entertainment |
| 11 | Median groceries >$50, vs last month? | `calculate_statistics` (2×) | (1) all + groceries + minAmount=50 (2) Nov + groceries + minAmount=50 |
| 12 | Groceries >$100 last month, exclude weird? | `filter_expenses` | category=groceries, minAmount=100, dates=Nov 2025, excludeAnomalies=true |
| 13 | Total by category Sept vs Oct? | `get_spending_by_category` (2×) | (1) Sept (2) Oct |

---

## Validation Answers

Expected responses with **today = December 30, 2025**:

| Query | Expected Answer |
|-------|-----------------|
| Groceries last month | **$288.75** |
| Average dining (all time) | **$161.16** |
| Spending by category last month | Groceries: 288.75, Utilities: 148.90, Entertainment: 79.41, Dining: 72.69, Transportation: 34.94, Subscriptions: 27.03 |
| Median dining, exclude outliers | **$81.16** |
| Median groceries >$50: all time vs last month | **$60.70 vs $91.41** |

---

## API Endpoints

### Single Endpoint
```
POST /api/ask_finance_assistant
```

**Request:**
```json
{
  "question": "How much did I spend on groceries last month?"
}
```

**Response:**
```json
{
  "answer": "<p>You spent <strong>$288.75</strong> on groceries in November 2025...</p>"
}
```

The `answer` field contains **HTML** (converted from Markdown by showdown).

---

## Memory & Context Management

### What's Stored in Conversation History
- User queries (small strings)
- Assistant turns with text/tool-call parts (moderate size, `providerOptions` stripped)
- Tool results (compact summaries, not raw arrays)

### What's NOT Stored
- The 294-row Expense[] array
- Raw JSON from tool executions
- `providerOptions` metadata (stripped via `deepDelete`)

### Why This Matters
- Context window is limited (~100K tokens in Gemini 2.5 Flash)
- Each message adds to the window; storing raw expense arrays wastes tokens
- Formatted strings (markdown tables, summary objects) are ~10× smaller than equivalent arrays

---

## System Prompt Design

The system prompt anchors the date and guides tool usage:

```
Today's date is December 30, 2025.
- "last month" = November 2025 (Nov 1-30)
- "this month" = December 2025 (Dec 1-30)

For comparisons, make multiple tool calls in one step.
For "top N" questions, use get_spending_by_category with topN parameter.

Response format: Markdown with $ prefix on amounts, 2 decimal places.
Anomaly threshold: mean + 2 × stddev.
```

This ensures:
1. Relative dates resolve correctly
2. The LLM makes efficient tool calls (batch comparisons)
3. Responses are consistent and formatted for HTML rendering

---

## Error Handling

### Tool Execution Failures
If a tool call fails (e.g., invalid category name):
- The LLM receives the error in the tool-result message
- The LLM can retry with corrected parameters
- The loop continues until `finishReason = 'stop'`

### LLM Errors
If `finishReason` is anything other than `'stop'` or `'tool-calls'`:
- Return a fallback error message: `"I encountered an issue processing your request. Please try again."`

### Missing Data
- Empty results return user-friendly messages: `"No expenses found matching the criteria."`
- Zero-count metrics return 0 (not undefined)

---

## Testing Checklist

- [ ] Run `npm run dev`
- [ ] Open http://localhost:5173
- [ ] Test Q1: "What did I spend on groceries last month?" → Should return **$288.75**
- [ ] Test Q4: "What's my average dining expense?" → Should return **$161.16**
- [ ] Test Q8: "What's my median dining expense, excluding outliers?" → Should return **$81.16**
- [ ] Test follow-up: After Q4, ask "What about groceries?" → Agent should remember context
- [ ] Test comparison: "Compare my grocery spending in September vs October" → Should call tool twice
- [ ] Verify all responses are in Markdown format with $ prefix and 2 decimal places

---

## Files Reference

| File | Purpose |
|------|---------|
| `server/agent/index.ts` | FinanceAgent class + 3 tools + agentic loop |
| `server/agent/types.ts` | Expense interface |
| `server/services/financeAssistantService.ts` | Singleton agent instance + Markdown→HTML conversion |
| `server/routes/financeAssistantRoutes.ts` | Route definition |
| `server/controllers/financeAssistantController.ts` | Request validation + response |
| `server/utils/*.ts` | Reusable helpers (math, array, date, anomaly, general) |
| `public/src/App.tsx` | React UI (do not modify) |
| `server/expenses_data/expenses_2024-2025.csv` | Data source (294 rows) |

