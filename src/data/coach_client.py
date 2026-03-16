"""Groq LLM-based Investment Coach.

This module provides a chat interface for investment advice with
different modes: Educator, Analyst, Quick Take.
"""

from __future__ import annotations

import os
from typing import List

SYSTEM_PROMPTS = {
    "educator": (
        "You are a friendly investment coach helping someone who is completely new to investing. "
        "Explain everything in very simple terms like you are talking to a smart 16-year-old. "
        "Use analogies and real world examples. Never use jargon without explaining it. "
        "When asked about specific stocks use your knowledge to give helpful context. "
        "Keep responses under 150 words. Be encouraging and positive. "
        "Always end with a follow-up question to keep the conversation going."
    ),
    "analyst": (
        "You are a senior equity analyst at a top investment bank. "
        "Give detailed, data-driven analysis. Use proper financial terminology. "
        "Discuss valuation metrics, competitive moats, risk factors, and price targets. "
        "Reference real financial data when possible. Be direct and professional. "
        "Keep responses under 200 words."
    ),
    "quick_take": (
        "You are a fast-talking financial advisor. Give extremely concise answers "
        "in 2-3 sentences maximum. Be direct. No fluff. Just the key point and recommendation. "
        "Use plain English."
    ),
}


def chat_with_coach(
    message: str, mode: str = "educator", history: List[Dict[str, str]] | None = None
) -> dict:
    """Chat with the Investment Coach via Groq LLM.

    Returns: {"response": str, "suggested_followups": list[str]}
    """
    from groq import Groq

    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise RuntimeError(
            "GROQ_API_KEY is not set. Obtain a key from console.groq.com and add to .env"
        )

    mode_key = (mode or "educator").lower()
    if mode_key not in SYSTEM_PROMPTS:
        mode_key = "educator"
    system_prompt = SYSTEM_PROMPTS[mode_key]

    client = Groq(api_key=api_key)
    messages: List[Dict[str, str]] = [{"role": "system", "content": system_prompt}]

    hist = history or []
    for h in hist:
        role = h.get("role")
        content = h.get("content")
        if role and content:
            messages.append({"role": role, "content": str(content)})
    messages.append({"role": "user", "content": message.strip()})

    response = client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=messages,
        max_tokens=400,
        temperature=0.7,
    )

    content = (response.choices[0].message.content or "").strip()

    suggested = [
        "Tell me more about the risk",
        "What are some alternatives?",
        "How does this compare to index funds?",
    ]

    return {"response": content, "suggested_followups": suggested}
