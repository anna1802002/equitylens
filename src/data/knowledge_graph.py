"""Neo4j helper for company relationship graphs."""

from __future__ import annotations

import os
from contextlib import contextmanager
from typing import Iterator

from neo4j import GraphDatabase


@contextmanager
def neo4j_session() -> Iterator:
    uri = os.getenv("NEO4J_URI")
    user = os.getenv("NEO4J_USER")
    password = os.getenv("NEO4J_PASSWORD")
    if not (uri and user and password):
        raise RuntimeError("Neo4j credentials are not configured.")
    driver = GraphDatabase.driver(uri, auth=(user, password))
    try:
        with driver.session() as session:
            yield session
    finally:
        driver.close()


def upsert_company_sector(ticker: str, sector: str | None) -> None:
    """Create company-sector relationship in Neo4j."""
    if not sector:
        return
    with neo4j_session() as session:
        session.run(
            """
            MERGE (c:Company {ticker: $ticker})
            MERGE (s:Sector {name: $sector})
            MERGE (c)-[:BELONGS_TO]->(s)
            """,
            ticker=ticker.upper(),
            sector=sector,
        )
