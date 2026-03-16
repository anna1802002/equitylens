"""FastAPI application entry point.

This module creates the FastAPI app, loads environment variables, configures
basic CORS, and includes all API routes.
"""

from __future__ import annotations

import os

from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from src.api.limiter import limiter
from src.api.routes import router as api_router


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""

    # Load environment variables from .env if present.
    load_dotenv()

    app = FastAPI(
        title="Stock Research Agent API",
        version="0.1.0",
        description="Backend API for the AI-powered stock research agent.",
    )
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

    # CORS configuration – allow local Dash frontend and typical dev origins.
    allowed_origins = os.getenv(
        "CORS_ALLOWED_ORIGINS",
        "http://localhost:3000,http://127.0.0.1:3000,http://localhost:8050,http://127.0.0.1:8050,http://localhost:8000,http://127.0.0.1:8000",
    ).split(",")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=[o.strip() for o in allowed_origins if o.strip()],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Include versioned API routes.
    app.include_router(api_router, prefix="/api")

    @app.get("/health", tags=["health"])
    async def health_check() -> dict:
        """Lightweight health endpoint for uptime checks."""
        return {"status": "ok"}

    @app.on_event("startup")
    def run_dbt_on_startup() -> None:
        """Run dbt models on API startup."""
        import subprocess
        try:
            result = subprocess.run(
                ["dbt", "run", "--project-dir", "dbt", "--profiles-dir", "dbt"],
                capture_output=True,
                text=True,
                timeout=60,
                cwd=os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
            )
            if result.returncode == 0:
                print("dbt models built successfully")
            else:
                print(f"dbt warning: {result.stderr}")
        except Exception as e:
            print(f"dbt skipped: {e}")

    @app.on_event("startup")
    def _log_routes() -> None:
        """Print all registered routes on startup for debugging."""
        print("\n--- Registered API routes ---")
        for route in app.routes:
            if hasattr(route, "methods") and hasattr(route, "path"):
                for method in sorted(route.methods - {"HEAD", "OPTIONS"}):
                    print(f"  {method:6} {route.path}")
        print("---\n")

    return app


app = create_app()

