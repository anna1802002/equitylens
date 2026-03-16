# Stock Research Agent – Frontend

Next.js 14 + Tailwind CSS frontend for the AI Stock Research Agent. Connects to the FastAPI backend at `http://127.0.0.1:8000`.

## Setup

```bash
cd frontend
npm install
```

## Run

Start the FastAPI backend first (from project root):

```bash
uvicorn src.api.main:app --reload --port 8000
```

Then start the Next.js dev server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The app redirects to `/research`.

## Pages

- **Research** – Ticker search, KPI cards, risk gauge, Buy/Hold/Sell badge, analyst report
- **Financials** – Price chart, revenue bar, profit margin
- **Sentiment** – Sentiment timeline, headline cards (positive/negative borders)
- **History** – Table of past reports from SQLite
- **Eval Metrics** – Accuracy, hallucination rate, ROUGE-L cards; agent vs baseline bar chart

## Stack

- Next.js 14 (App Router)
- Tailwind CSS
- Recharts
- TypeScript
