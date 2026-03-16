with cleaned as (
    select
        id,
        upper(ticker) as ticker,
        lower(company_name) as company_name,
        cast(risk_score as float) as risk_score,
        upper(recommendation) as recommendation,
        cast(price as float) as current_price,
        datetime(created_at) as researched_at,
        case 
            when risk_score < 33 then 'Low Risk'
            when risk_score < 66 then 'Medium Risk'
            else 'High Risk'
        end as risk_category
    from reports
    where ticker is not null
      and risk_score between 0 and 100
      and price > 0
)
select * from cleaned