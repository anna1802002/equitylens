"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { postCoach } from "@/lib/api";

type Mode = "educator" | "analyst" | "quick_take";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  suggested_followups?: string[];
}

const MODES: {
  key: Mode;
  title: string;
  who: string;
  description: string;
}[] = [
  {
    key: "educator",
    title: "Educator",
    who: "New to investing? Start here.",
    description: "Simple terms and real-world analogies.",
  },
  {
    key: "quick_take",
    title: "Quick Take",
    who: "Busy? Just want the answer.",
    description: "Short, sharp, 2-3 sentences max.",
  },
  {
    key: "analyst",
    title: "Analyst",
    who: "Know your way around markets?",
    description: "Full technical analysis and valuation.",
  },
];

const STARTER_QUESTIONS = [
  "Should I invest in Apple right now?",
  "Explain what P/E ratio means",
  "Is Tesla a good long term investment?",
  "What is dollar cost averaging?",
  "Compare Apple and Microsoft for me",
  "I have $1000 to invest, where should I start?",
];

function formatTime(d: Date): string {
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export default function CoachPage() {
  const [mode, setMode] = useState<Mode>("educator");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      scrollRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  }, []);

  const sendMessage = useCallback(
    async (text: string) => {
      const msg = text.trim();
      if (!msg || loading) return;

      const userMsg: Message = {
        id: `u-${Date.now()}`,
        role: "user",
        content: msg,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setLoading(true);
      scrollToBottom();

      try {
        const history = messages
          .filter((m) => m.role === "user" || m.role === "assistant")
          .map((m) => ({ role: m.role, content: m.content }));

        const res = await postCoach(msg, mode, history);

        const assistantMsg: Message = {
          id: `a-${Date.now()}`,
          role: "assistant",
          content: res.response || "I'm sorry, I couldn't generate a response.",
          timestamp: new Date(),
          suggested_followups: res.suggested_followups,
        };
        setMessages((prev) => [...prev, assistantMsg]);
        scrollToBottom();
      } catch (e) {
        const errMsg: Message = {
          id: `e-${Date.now()}`,
          role: "assistant",
          content: `Error: ${e instanceof Error ? e.message : "Request failed"}`,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errMsg]);
        scrollToBottom();
      } finally {
        setLoading(false);
      }
    },
    [mode, messages, loading, scrollToBottom]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleStarterClick = (q: string) => {
    sendMessage(q);
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col bg-[#0a0a0f] text-gray-200">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-[#1e1e2e] bg-[#0a0a0f] px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-4xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Investment Coach</h1>
            <p className="mt-0.5 text-sm text-gray-400">
              Your personal AI-powered financial advisor
            </p>
          </div>
          <span className="inline-flex w-fit rounded-full border border-violet-500/40 bg-violet-500/10 px-4 py-2 text-sm font-medium text-violet-300">
            Powered by Llama 3.1
          </span>
        </div>

        {/* Mode selector cards */}
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {MODES.map((m) => {
            const selected = mode === m.key;
            return (
              <button
                key={m.key}
                onClick={() => setMode(m.key)}
                className={`flex h-[60px] max-h-[60px] items-center gap-3 rounded-xl border px-3 py-2 text-left transition ${
                  selected
                    ? "border-violet-500 bg-violet-500/10"
                    : "border-[#1e1e2e] bg-[#0d0d12] hover:border-violet-500/40"
                }`}
              >
                <div className="min-w-0 flex-1 overflow-hidden">
                  <h3 className="text-sm font-semibold text-white">
                    {m.title}
                  </h3>
                  <p className="truncate text-xs text-gray-500">
                    {m.who} {m.description}
                  </p>
                </div>
                {selected && (
                  <span className="flex-shrink-0 rounded-full bg-violet-500/30 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-violet-200">
                    Active
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-center text-xs text-gray-500">
          You can switch modes anytime during your conversation
        </p>
      </div>

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
        <div className="mx-auto max-w-3xl">
          <AnimatePresence>
            {messages.length === 0 && !loading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mb-6 text-center"
              >
                <p className="mb-4 text-sm text-gray-500">
                  Pick a mode above, then ask anything about investing
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  {STARTER_QUESTIONS.map((q) => (
                    <button
                      key={q}
                      onClick={() => handleStarterClick(q)}
                      className="rounded-xl border border-violet-500/40 bg-violet-500/10 px-4 py-2.5 text-sm font-medium text-violet-200 transition hover:bg-violet-500/20"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`mb-4 flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] sm:max-w-[75%] ${
                    msg.role === "user"
                      ? "rounded-2xl rounded-br-md bg-violet-600 px-4 py-3 text-white"
                      : "rounded-2xl rounded-bl-md border-l-4 border-violet-500/60 bg-[#13131f] px-4 py-3"
                  }`}
                >
                  {msg.role === "assistant" && (
                    <p className="mb-1 text-xs font-semibold text-violet-300">
                      Investment Coach
                    </p>
                  )}
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">
                    {msg.content}
                  </p>
                  <p className="mt-2 text-[10px] text-gray-500">
                    {formatTime(msg.timestamp)}
                  </p>
                  {msg.role === "assistant" && msg.suggested_followups?.length && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {msg.suggested_followups.map((s) => (
                        <button
                          key={s}
                          onClick={() => sendMessage(s)}
                          className="rounded-lg border border-violet-500/40 bg-violet-500/10 px-2.5 py-1 text-xs font-medium text-violet-200 transition hover:bg-violet-500/20"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            ))}

            {loading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mb-4 flex justify-start"
              >
                <div className="rounded-2xl rounded-bl-md border-l-4 border-violet-500/60 bg-[#13131f] px-4 py-3">
                  <p className="mb-1 text-xs font-semibold text-violet-300">
                    Investment Coach
                  </p>
                  <p className="text-sm text-gray-400">
                    Coach is thinking
                    <span className="inline-flex animate-pulse">
                      <span className="ml-0.5">.</span>
                      <span className="ml-0">.</span>
                      <span className="ml-0">.</span>
                    </span>
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <div ref={scrollRef} />
        </div>
      </div>

      {/* Input bar */}
      <div className="flex-shrink-0 border-t border-[#1e1e2e] bg-[#0a0a0f] px-4 py-4 sm:px-6">
        <form
          onSubmit={handleSubmit}
          className="mx-auto flex max-w-3xl gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask anything about investing..."
            disabled={loading}
            className="flex-1 rounded-xl border border-[#1e1e2e] bg-[#13131f] px-4 py-3 text-sm text-white outline-none transition placeholder:text-gray-500 focus:border-violet-500 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="rounded-xl bg-violet-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:opacity-50"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
