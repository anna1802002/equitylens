'use client';

import { useEffect, useRef } from 'react';

interface TradingViewChartProps {
  ticker: string;
  exchange?: string;
}

function resolveExchange(ticker: string, exchange?: string): string {
  if (exchange && exchange.trim()) return exchange;
  const upper = ticker.trim().toUpperCase();
  const nyseTickers = new Set([
    'WMT',
    'KO',
    'PEP',
    'MCD',
    'DIS',
    'JPM',
    'GS',
    'V',
    'MA',
    'XOM',
    'CVX',
    'BA',
    'GE',
    'F',
    'GM',
  ]);
  if (nyseTickers.has(upper)) return 'NYSE';
  return 'NASDAQ';
}

export default function TradingViewChart({
  ticker,
  exchange,
}: TradingViewChartProps) {
  const container = useRef<HTMLDivElement | null>(null);
  const resolvedExchange = resolveExchange(ticker, exchange);

  useEffect(() => {
    if (!container.current) return;

    container.current.innerHTML = '';

    const script = document.createElement('script');
    script.src =
      'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.type = 'text/javascript';
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: `${resolvedExchange}:${ticker}`,
      interval: 'D',
      timezone: 'Etc/UTC',
      theme: 'dark',
      style: '1',
      locale: 'en',
      backgroundColor: 'rgba(13, 13, 31, 1)',
      gridColor: 'rgba(30, 30, 46, 1)',
      hide_top_toolbar: false,
      hide_legend: false,
      save_image: true,
      calendar: false,
      hide_volume: false,
      support_host: 'https://www.tradingview.com',
    });

    container.current.appendChild(script);

    return () => {
      if (container.current) {
        container.current.innerHTML = '';
      }
    };
  }, [ticker, resolvedExchange]);

  return (
    <div
      className="tradingview-widget-container"
      ref={container}
      style={{ height: '500px', width: '100%' }}
    >
      <div
        className="tradingview-widget-container__widget"
        style={{ height: 'calc(100% - 32px)', width: '100%' }}
      />
      <div className="tradingview-widget-copyright">
        <a
          href="https://www.tradingview.com/"
          rel="noopener nofollow"
          target="_blank"
        >
          <span className="text-xs text-gray-600">
            Charts powered by TradingView
          </span>
        </a>
      </div>
    </div>
  );
}

