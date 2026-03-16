with cleaned as (
    select
        id,
        upper(ticker) as ticker,
        company_name,
        cast(added_price as float) as added_price,
        datetime(added_at) as added_at
    from watchlist
    where ticker is not null
)
select * from cleaned