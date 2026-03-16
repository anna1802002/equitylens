const API_BASE = "http://127.0.0.1:8000/api";

function isLikelyTicker(input: string): boolean {
  const q = input.trim();
  // Simple heuristic: short, no spaces, alphanumeric only.
  return !!q && q.length <= 6 && /^[A-Za-z0-9.]+$/.test(q);
}

export async function runResearch(query: string) {
  const trimmed = query.trim();
  const params = new URLSearchParams();
  if (isLikelyTicker(trimmed)) {
    params.set("ticker", trimmed.toUpperCase());
  } else {
    // Let the backend resolve company name -> ticker.
    params.set("ticker", trimmed);
  }

  const res = await fetch(`${API_BASE}/research?${params.toString()}`, {
    method: "POST",
  });
  const json = await res.json().catch(() => null);

  if (!res.ok || !json) {
    const detail = (json as any)?.detail ?? res.statusText;
    throw new Error(detail || "Research request failed");
  }

  if (json.success === false) {
    throw new Error(json.error || "Research failed");
  }

  return json;
}

export async function getReports() {
  const res = await fetch(`${API_BASE}/reports`);
  if (!res.ok) throw new Error("Failed to load reports");
  return res.json();
}

export async function deleteReport(id: number) {
  const res = await fetch(`${API_BASE}/reports/${id}`, { method: "DELETE" });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error((json as any)?.detail || "Failed to delete report");
  }
  return res.json();
}

export async function getEvalResults() {
  const res = await fetch(`${API_BASE}/eval`);
  if (!res.ok) throw new Error("Failed to load eval results");
  return res.json();
}

export async function getFinancials(ticker: string, period = "1Y") {
  const params = new URLSearchParams({ ticker: ticker.trim().toUpperCase(), period });
  const res = await fetch(`${API_BASE}/financials?${params}`);
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error((json as any)?.detail || "Failed to load financials");
  }
  return res.json();
}

export async function postCoach(
  message: string,
  mode: string,
  history: { role: string; content: string }[]
) {
  const res = await fetch(`${API_BASE}/coach`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, mode, history }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((json as any)?.detail || "Failed to get coach response");
  }
  return json;
}

export async function getCompare(ticker1: string, ticker2: string) {
  const params = new URLSearchParams({
    ticker1: ticker1.trim().toUpperCase(),
    ticker2: ticker2.trim().toUpperCase(),
  });
  const res = await fetch(`${API_BASE}/compare?${params}`);
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error((json as any)?.detail || "Failed to load comparison");
  }
  return res.json();
}

export async function getWatchlist() {
  const res = await fetch(`${API_BASE}/watchlist`);
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error((json as any)?.detail || "Failed to load watchlist");
  }
  return res.json();
}

export async function addToWatchlist(ticker: string) {
  const res = await fetch(`${API_BASE}/watchlist`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ticker: ticker.trim().toUpperCase() }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((json as any)?.detail || "Failed to add to watchlist");
  }
  return json;
}

export async function removeFromWatchlist(ticker: string) {
  const sym = ticker.trim().toUpperCase();
  const res = await fetch(`${API_BASE}/watchlist/${encodeURIComponent(sym)}`, {
    method: "DELETE",
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((json as any)?.detail || "Failed to remove from watchlist");
  }
  return json;
}

export async function getSentiment(ticker: string) {
  const params = new URLSearchParams({ ticker: ticker.trim().toUpperCase() });
  const res = await fetch(`${API_BASE}/sentiment?${params}`);
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error((json as any)?.detail || "Failed to load sentiment");
  }
  return res.json();
}
