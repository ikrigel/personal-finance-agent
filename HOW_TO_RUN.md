# How to Run the Personal Finance Agent

This is an npm workspaces monorepo with a React frontend and Express backend. Both start together with a single command.

## Prerequisites

- **Node.js** 18+ (check with `node --version`)
- **Google Generative AI API Key** (free at https://aistudio.google.com/app/apikey)

## Quick Start

### 1. Install Dependencies

From the **project root** (`c:\personal-finance-agent-main`):

```bash
npm install
```

This installs dependencies for:
- Root package
- `/public` (React frontend)
- `/server` (Express backend + AI agent)

### 2. Set Up Environment Variables

Create `.env` file in the `/server` directory:

```bash
echo "GOOGLE_GENERATIVE_AI_API_KEY=your_api_key_here" > server/.env
```

**For Windows PowerShell:**
```powershell
"GOOGLE_GENERATIVE_AI_API_KEY=your_api_key_here" | Out-File -FilePath server/.env -Encoding utf8
```

Replace `your_api_key_here` with your actual API key from https://aistudio.google.com/app/apikey.

### 3. Start Both Services

```bash
npm run dev
```

This starts concurrently:
- **Frontend**: Vite dev server at `http://localhost:5173`
- **Backend**: Express server at `http://localhost:3000`

The frontend will automatically proxy API requests to the backend.

## Accessing the Application

Open your browser and go to:
```
http://localhost:5173
```

You'll see the chat interface with guiding questions about personal finances.

## Port Management

### If ports are already in use:

**Set custom port for backend (Linux/Mac):**
```bash
PORT=4000 npm run dev
```

**Set custom port for backend (Windows PowerShell):**
```powershell
$env:PORT=4000; npm run dev
```

### Free up ports if needed:

**Find and kill process on port 3000 (Linux/Mac):**
```bash
lsof -ti:3000 | xargs kill -9
```

**Find and kill process on port 3000 (Windows, run as Admin):**
```powershell
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

Replace `<PID>` with the actual process ID from the previous command.

## Project Structure

```
personal-finance-agent/
├── public/                          # React frontend (Vite)
│   ├── src/
│   │   ├── App.tsx                 # Main app component
│   │   ├── components/             # UI components
│   │   └── index.css
│   ├── vite.config.ts
│   └── package.json
│
├── server/                          # Express backend
│   ├── agent/
│   │   ├── index.ts                # FinanceAgent implementation (MAIN FILE)
│   │   └── types.ts                # Expense interface
│   ├── controllers/
│   │   └── financeAssistantController.ts
│   ├── services/
│   │   └── financeAssistantService.ts
│   ├── routes/
│   │   └── financeAssistantRoutes.ts
│   ├── utils/
│   │   ├── math-helpers.ts         # sum, mean, median, min, max
│   │   ├── array-helpers.ts        # groupBy utility
│   │   ├── date-helpers.ts         # date utilities
│   │   ├── anomaly-helper.ts       # outlier detection
│   │   └── general.ts              # deepDelete, sleep, etc.
│   ├── expenses_data/
│   │   └── expenses_2024-2025.csv  # 294 expense records
│   ├── server.ts
│   ├── .env                        # Add API key here
│   └── package.json
│
├── tsconfig.json
├── package.json
├── claude.md                        # Project guidance
├── ARCHITECTURE.md                  # System design docs
└── README.md                        # Project description
```

## Troubleshooting

### Error: "Cannot find module 'ai'" or "Cannot find module '@ai-sdk/google'"

**Solution:** Run `npm install` from the project root:
```bash
npm install
```

### Error: "GOOGLE_GENERATIVE_AI_API_KEY not found"

**Solution:** Check that `/server/.env` exists and contains your API key:
```bash
cat server/.env
```

If the file doesn't exist, create it:
```bash
echo "GOOGLE_GENERATIVE_AI_API_KEY=your_key_here" > server/.env
```

### Error: "Port 3000 is already in use"

**Solution:** Kill the process on that port or use a different port:

```bash
PORT=4000 npm run dev
```

Or find and kill the existing process (see Port Management section above).

### Error: "You exceeded your quota" on API calls

**Solution:** Google's free tier has a rate limit of 20 requests/minute. Wait for the quota to reset (~1 minute) before making more requests.

### Frontend shows "Internal server error"

**Solution:** Check the backend logs. Run with better error visibility:

```bash
npm run dev
```

Look at the terminal output in the `[1]` section (backend logs) for error messages. Common issues:
- Missing or invalid `GOOGLE_GENERATIVE_AI_API_KEY`
- API quota exceeded
- Network connectivity issues

## Development Notes

### Frontend-Backend Communication

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3000`
- API Endpoint: `POST /api/ask_finance_assistant`

The frontend automatically proxies to the backend (configured in Vite).

### Hot Reload

- **Frontend**: Changes auto-reload in browser
- **Backend**: Changes auto-reload via `tsx watch` (may need manual refresh in browser)

### API Usage

**Request:**
```json
{
  "question": "What did I spend on groceries last month?"
}
```

**Response:**
```json
{
  "answer": "<p>You spent <strong>$288.75</strong> on groceries...</p>"
}
```

The answer is returned as HTML (converted from Markdown by the backend).

## Useful Commands

```bash
# Install all dependencies
npm install

# Start both frontend and backend
npm run dev

# Build frontend for production
npm run build -w public

# Build backend TypeScript
npm run build -w server

# Start production backend (after building)
npm run start -w server
```

## Next Steps

1. Open http://localhost:5173
2. Click on one of the guiding questions, like "How much did I spend on groceries last month?"
3. The agent will analyze your expense data and respond with formatted results
4. Try asking follow-up questions to explore the data further

## Support

For more details:
- See [claude.md](claude.md) for project setup guidance
- See [ARCHITECTURE.md](ARCHITECTURE.md) for system design details
- See [README.md](README.md) for project description
