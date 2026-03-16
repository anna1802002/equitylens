'use client';

import { useEffect, useRef } from 'react';

export default function TradingViewMini({ ticker }: { ticker: string }) {
  const container = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!container.current) return;
    container.current.innerHTML = '';

    const script = document.createElement('script');
    script.src =
      'https://s3.tradingview.com/external-embedding/embed-widget-mini-symbol-overview.js';
    script.type = 'text/javascript';
    script.async = true;
    script.innerHTML = JSON.stringify({
      symbol: ticker,
      width: '100%',
      height: '150',
      locale: 'en',
      dateRange: '3M',
      colorTheme: 'dark',
      trendLineColor: 'rgba(96, 165, 250, 1)',
      underLineColor: 'rgba(96, 165, 250, 0.1)',
      underLineBottomColor: 'rgba(0, 0, 0, 0)',
      isTransparent: true,
      autosize: true,
      largeChartUrl: '',
    });

    container.current.appendChild(script);

    return () => {
      if (container.current) {
        container.current.innerHTML = '';
      }
    };
  }, [ticker]);

  return <div ref={container} style={{ height: '150px', width: '100%' }} />;
}

