# Stock Research Agent — dbt Project

Data transformation and lineage documentation for the stock research agent.

## Setup

```bash
pip install dbt-core dbt-postgres
cd dbt
dbt deps  # if using packages
dbt run
dbt test
```

## Structure

- **models/staging/** — Cleans and validates raw data
- **models/marts/** — Business-ready aggregated tables
- **tests/** — Data quality assertions

## Environment

Set `DBT_DATABASE` to point to your SQLite database (default: `data/reports.db`).
