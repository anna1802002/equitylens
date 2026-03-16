with reports as (
    select * from {{ ref('stg_research_reports') }}
),
risk_trends as (
    select
        ticker,
        risk_category,
        count(*) as research_count,
        avg(risk_score) as avg_risk,
        avg(current_price) as avg_price_at_research,
        min(researched_at) as first_seen,
        max(researched_at) as last_seen
    from reports
    group by ticker, risk_category
)
select * from risk_trends