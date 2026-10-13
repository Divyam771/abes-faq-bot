"use client";

import { useState } from "react";

type Message = {
  role: "user" | "assistant";
  content: string;
};

const EXAMPLE_QUESTIONS = [
  "What courses does ABES offer?",
  "What is the fee structure?",
  "How is the placement record?",
  "How can I contact the college?",
];

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "👋 Hi! I'm the ABES Engineering College FAQ Assistant. Ask me about courses, fees, admissions, placements, or campus life!",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const sendMessage = async (overrideText?: string) => {
    const text = overrideText ?? input;
    if (!text.trim() || loading) return;

    const userMessage: Message = { role: "user", content: text };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages }),
      });

      const data = await res.json();

      if (data.error) {
        setMessages([
          ...newMessages,
          { role: "assistant", content: `âš ï¸ Error: ${data.error}` },
        ]);
      } else {
        setMessages([...newMessages, { role: "assistant", content: data.content }]);
      }
    } catch  {
      setMessages([
        ...newMessages,
        { role: "assistant", content: "âš ï¸ Something went wrong. Please try again." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") sendMessage();
  };

  return (
    <div className="flex flex-col flex-1 items-center justify-center min-h-screen bg-slate-950 text-white font-sans">
      <div className="flex flex-col w-full max-w-2xl h-screen py-6 px-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-full bg-gradient-to-br from-sky-500 to-teal-400 flex items-center justify-center font-bold text-lg">
            A
          </div>
          <div>
            <h1 className="text-xl font-bold leading-tight">ABES FAQ Assistant</h1>
            <p className="text-xs text-slate-400">ABES Engineering College, Ghaziabad</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2 whitespace-pre-wrap ${
                  msg.role === "user" ? "bg-sky-600 text-white" : "bg-slate-800 text-slate-100"
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-slate-800 text-slate-400 rounded-2xl px-4 py-2">Thinking...</div>
            </div>
          )}
        </div>

        {messages.length === 1 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {EXAMPLE_QUESTIONS.map((q) => (
              <button
                key={q}
                onClick={() => sendMessage(q)}
                className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-full border border-slate-700"
              >
                {q}
              </button>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about admissions, fees, courses..."
            className="flex-1 rounded-full bg-slate-800 px-4 py-3 text-white placeholder-slate-500 outline-none focus:ring-2 focus:ring-sky-500"
          />
          <button
            onClick={() => sendMessage()}
            disabled={loading}
            className="rounded-full bg-sky-600 px-6 py-3 font-medium hover:bg-sky-700 disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
