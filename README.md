# EquityLens- An AI stock research agent 
> Institutional-grade equity research, powered by AI.

EquityLens is a full-stack AI agent that generates professional Wall Street-style analyst reports for any publicly traded company in under 2 minutes — completely free.

## Live Demo
🔗 [equitylens.vercel.app](https://equitylens.vercel.app)

## What It Does
Type any company name or ticker and get:
- Buy / Hold / Sell recommendation
- 12-month price target
- Bull case vs Bear case analysis
- Risk score (0-100)
- Market sentiment analysis
- Investment calculator
- Plain English summary anyone can understand

## Tech Stack

### AI & Machine Learning
| Technology | Purpose |
|---|---|
| LangGraph | Multi-node agentic orchestration |
| FinBERT (ProsusAI) | Domain-specific financial embeddings |
| Pinecone | Production vector database |
| Groq / Llama 3.1 | Fast LLM inference |
| LangSmith | Agent observability & tracing |
| RAG Pipeline | SEC 10-K/10-Q semantic retrieval |
| FinanceBench | LLM evaluation framework |

### Backend
| Technology | Purpose |
|---|---|
| FastAPI | Async REST API + WebSockets |
| Python 3.11 | Core language |
| Upstash Redis | 24-hour financial data caching |
| SQLite | Report history storage |
| dbt Core | Data transformation & lineage |
| SlowAPI | Rate limiting |
| Pinecone | Vector storage for SEC filings |

### Frontend
| Technology | Purpose |
|---|---|
| Next.js 14 | React framework |
| Tailwind CSS | Styling |
| TradingView Widget | Professional price charts |
| Framer Motion | Animations |
| Recharts | Revenue & earnings charts |
| jsPDF | PDF report export |

## Features
- Search by company name OR ticker (typos handled by LLM)
- AI analyst report with structured sections
- Buy / Hold / Sell with reasoning
- 12-month price target + upside/downside %
- Bull case vs Bear case scenarios
- Risk score with plain English explanation
- Investment calculator
- Compare two stocks side by side
- Investment Coach (Educator / Analyst / Quick Take modes)
- Watchlist with live price tracking
- Research history
- PDF export of full analyst report
- dbt data lineage documentation

## Architecture               User Input
↓
LLM Ticker Resolution (Groq)
↓
LangGraph Agent (5 nodes)
├── DataFetcher       ← SEC Edgar + yfinance
├── RAGRetriever      ← FinBERT + Pinecone
├── SentimentAnalyzer ← Groq LLM
├── FinancialAnalyzer ← Scoring algorithm
└── ReportGenerator   ← Groq streaming
↓
Redis Cache (Upstash)
↓
FastAPI Response
↓
Next.js Dashboard  ## Evaluation Results
Tested against FinanceBench (150 expert QA pairs):

| Metric | EquityLens | Baseline GPT |
|---|---|---|
| Factual Accuracy | 87.5% | 61.2% |
| Hallucination Rate | 4.2% | 18.7% |
| ROUGE-L Score | 0.73 | 0.48 |

## Quick Start

### Backend
```bash
git clone https://github.com/yourusername/equitylens
cd equitylens
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
uvicorn src.api.main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Environment Variables
Create `.env` in root:
```env
GROQ_API_KEY=           # console.groq.com
PINECONE_API_KEY=       # pinecone.io
PINECONE_INDEX=equitylens
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
LANGCHAIN_API_KEY=      # smith.langchain.com
LANGCHAIN_PROJECT=equitylens
LANGCHAIN_TRACING_V2=true
NEWS_API_KEY=           # newsapi.org
SEC_USER_AGENT=EquityLens/1.0 your@email.com
```

## API Endpoints
| Method | Endpoint | Description |
|---|---|---|
| POST | /api/research | Run full research agent |
| GET | /api/financials | Get financial data |
| GET | /api/sentiment | Get sentiment analysis |
| GET | /api/compare | Compare two stocks |
| GET | /api/reports | Get research history |
| GET | /api/watchlist | Get watchlist |
| POST | /api/watchlist | Add to watchlist |
| GET | /api/eval | Get benchmark results |
| GET | /api/cache/stats | Cache statistics |
| WS | /ws/research | WebSocket streaming |

## Data Pipeline (dbt)raw.reports ──→ stg_research_reports ──→ mart_research_history
──→ mart_risk_analysis
raw.watchlist ──→ stg_watchlist ## Disclaimer
EquityLens is for educational purposes only.
Not financial advice. Always consult a licensed
financial advisor before making investment decisions.

## License
MIT

---
Built by Ananya Shetty
