with reports as (
    select * from {{ ref('stg_research_reports') }}
),
aggregated as (
    select
        ticker,
        company_name,
        count(*) as total_researches,
        avg(risk_score) as avg_risk_score,
        min(risk_score) as min_risk_score,
        max(risk_score) as max_risk_score,
        sum(case when recommendation = 'BUY' then 1 else 0 end) as buy_signals,
        sum(case when recommendation = 'HOLD' then 1 else 0 end) as hold_signals,
        sum(case when recommendation = 'SELL' then 1 else 0 end) as sell_signals,
        max(researched_at) as last_researched_at
    from reports
    group by ticker, company_name
)
select * from aggregated