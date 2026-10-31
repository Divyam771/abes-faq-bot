"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import type { KeyboardEvent, ReactNode } from "react";

/* ------------------------------------------------------------------ */
/* Types and constants                                                 */
/* ------------------------------------------------------------------ */

type Message = {
  id: number;
  role: "user" | "assistant";
  content: string;
  time: string;
  sources?: string[];
  isError?: boolean;
};

type SourceItem = { label: string; href?: string };

const QUESTIONS = [
  "What courses does ABES offer?",
  "What is the fee structure?",
  "How is the placement record?",
  "How can I contact the college?",
];

// Answers that mean "nothing useful was found": showing sources under
// them would suggest the answer came from those pages.
const NO_SOURCES = /^(i couldn['\u2019]t find|the assistant is very busy)/i;

let nextId = 1;

function makeMessage(
  role: Message["role"],
  content: string,
  extra: Partial<Message> = {}
): Message {
  return {
    id: nextId++,
    role,
    content,
    time: new Date().toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    }),
    ...extra,
  };
}

/* ------------------------------------------------------------------ */
/* Sources                                                             */
/* ------------------------------------------------------------------ */

function describeSource(source: string): SourceItem | null {
  if (!source || source === "Unknown source") return null;

  if (/^https?:\/\//i.test(source)) {
    try {
      const url = new URL(source);
      const path = url.pathname === "/" ? "" : url.pathname;
      return {
        label: url.hostname.replace(/^www\./, "") + path,
        href: source,
      };
    } catch {
      return { label: source };
    }
  }

  // Local file such as "data/mandatory-disclosure.pdf"
  const file = source.split(/[\\/]/).pop() ?? source;
  const extension = file.includes(".") ? file.split(".").pop()!.toUpperCase() : "";
  const title = file
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
  return { label: extension ? `${title} (${extension})` : title };
}

function SourceList({ sources }: { sources: string[] }) {
  const items = sources
    .map(describeSource)
    .filter((item): item is SourceItem => item !== null);

  if (items.length === 0) return null;

  return (
    <div className="mt-3 border-l-2 border-[#22A6B3] pl-3">
      <p className="text-xs font-medium text-[#5A6B80]">Sources</p>
      <ul className="mt-1 space-y-0.5 text-sm">
        {items.map((item) => (
          <li key={item.label} className="break-words">
            {item.href ? (
              <a
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#0F4C81] underline decoration-[#0F4C81]/30 underline-offset-2 hover:decoration-[#0F4C81]"
              >
                {item.label}
              </a>
            ) : (
              <span>{item.label}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Answer formatting                                                   */
/* Gemini answers with Markdown (**bold**, "* " lists, tables). This   */
/* small renderer turns that into real elements. It never uses         */
/* dangerouslySetInnerHTML, so answer text cannot inject HTML.         */
/* ------------------------------------------------------------------ */

const INLINE_PATTERN =
  /(\*\*[^*\n]+\*\*|`[^`\n]+`|\[[^\]\n]+\]\(https?:\/\/[^\s)]+\)|https?:\/\/[^\s<>)]+|[\w.+-]+@[\w-]+(?:\.[\w-]+)+|\*[^\s*](?:[^*\n]*[^\s*])?\*)/g;

const LINK_CLASS =
  "break-words text-[#0F4C81] underline decoration-[#0F4C81]/30 underline-offset-2 hover:decoration-[#0F4C81]";

function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let last = 0;
  let key = 0;

  for (const match of text.matchAll(INLINE_PATTERN)) {
    const token = match[0];
    const start = match.index ?? 0;
    if (start > last) nodes.push(text.slice(last, start));
    last = start + token.length;

    if (token.startsWith("**")) {
      nodes.push(
        <strong key={key++} className="font-semibold text-[#0B1B2E]">
          {renderInline(token.slice(2, -2))}
        </strong>
      );
    } else if (token.startsWith("`")) {
      nodes.push(
        <code
          key={key++}
          className="rounded bg-[#EEF2F7] px-1 py-0.5 font-mono text-[0.85em]"
        >
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith("[")) {
      const parts = token.match(/^\[([^\]]+)\]\((.+)\)$/);
      if (parts) {
        nodes.push(
          <a
            key={key++}
            href={parts[2]}
            target="_blank"
            rel="noopener noreferrer"
            className={LINK_CLASS}
          >
            {parts[1]}
          </a>
        );
      } else {
        nodes.push(token);
      }
    } else if (token.startsWith("http")) {
      const url = token.replace(/[.,;:!?]+$/, "");
      nodes.push(
        <a
          key={key++}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className={LINK_CLASS}
        >
          {url}
        </a>
      );
      if (url.length < token.length) nodes.push(token.slice(url.length));
    } else if (token.startsWith("*")) {
      nodes.push(<em key={key++}>{token.slice(1, -1)}</em>);
    } else {
      nodes.push(
        <a key={key++} href={`mailto:${token}`} className={LINK_CLASS}>
          {token}
        </a>
      );
    }
  }

  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

const BULLET = /^\s*[*\-\u2022]\s+/;
const NUMBERED = /^\s*\d+[.)]\s+/;
const HEADING = /^\s*#{1,6}\s+(.*)$/;
const RULE = /^\s*([-*_])\1{2,}\s*$/;
const TABLE_SEPARATOR = /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/;

function splitRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function startsBlock(line: string, next?: string): boolean {
  return (
    BULLET.test(line) ||
    NUMBERED.test(line) ||
    HEADING.test(line) ||
    RULE.test(line) ||
    (line.trim().startsWith("|") && next !== undefined && TABLE_SEPARATOR.test(next))
  );
}

function MessageContent({ text }: { text: string }) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      i++;
      continue;
    }

    // Table
    if (
      line.trim().startsWith("|") &&
      i + 1 < lines.length &&
      TABLE_SEPARATOR.test(lines[i + 1])
    ) {
      const header = splitRow(line);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        rows.push(splitRow(lines[i]));
        i++;
      }
      blocks.push(
        <div
          key={key++}
          className="my-3 overflow-x-auto rounded-lg border border-[#D8E0EA]"
        >
          <table className="w-full text-left text-sm">
            <thead className="bg-[#F4F6F9] text-[#0B1B2E]">
              <tr>
                {header.map((cell, index) => (
                  <th key={index} className="px-3 py-2 font-semibold">
                    {renderInline(cell)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E6ECF3]">
              {rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex} className="px-3 py-2 align-top">
                      {renderInline(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    // Heading
    const heading = line.match(HEADING);
    if (heading) {
      blocks.push(
        <p key={key++} className="mb-1 mt-4 font-semibold text-[#0B1B2E]">
          {renderInline(heading[1])}
        </p>
      );
      i++;
      continue;
    }

    // Divider
    if (RULE.test(line)) {
      blocks.push(<hr key={key++} className="my-3 border-[#D8E0EA]" />);
      i++;
      continue;
    }

    // Lists
    if (BULLET.test(line) || NUMBERED.test(line)) {
      const ordered = NUMBERED.test(line);
      const pattern = ordered ? NUMBERED : BULLET;
      const items: string[] = [];
      while (i < lines.length && pattern.test(lines[i])) {
        items.push(lines[i].replace(pattern, ""));
        i++;
      }
      const listItems = items.map((item, index) => (
        <li key={index}>{renderInline(item)}</li>
      ));
      blocks.push(
        ordered ? (
          <ol
            key={key++}
            className="my-2 list-decimal space-y-1 pl-5 marker:text-[#5A6B80]"
          >
            {listItems}
          </ol>
        ) : (
          <ul
            key={key++}
            className="my-2 list-disc space-y-1 pl-5 marker:text-[#22A6B3]"
          >
            {listItems}
          </ul>
        )
      );
      continue;
    }

    // Paragraph (consecutive lines keep their line breaks)
    const paragraph = [line];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() &&
      !startsBlock(lines[i], lines[i + 1])
    ) {
      paragraph.push(lines[i]);
      i++;
    }
    blocks.push(
      <p key={key++} className="my-2">
        {paragraph.map((part, index) => (
          <Fragment key={index}>
            {index > 0 && <br />}
            {renderInline(part)}
          </Fragment>
        ))}
      </p>
    );
  }

  return (
    <div className="[&>*:first-child]:mt-0 [&>*:last-child]:mb-0">{blocks}</div>
  );
}

function toPlainText(markdown: string): string {
  return markdown.replace(/\*\*(.+?)\*\*/g, "$1").replace(/^\s*[*-]\s+/gm, "\u2022 ");
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

const FOCUS_RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#22A6B3]";

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const hasMessages = messages.length > 0;

  // Keep the newest message in view.
  useEffect(() => {
    if (messages.length === 0) return;
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    endRef.current?.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "end",
    });
  }, [messages.length, loading]);

  // Grow the text box with its content, up to a limit.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [input]);

  const send = async (text: string, base: Message[] = messages) => {
    const question = text.trim();
    if (!question || loading) return;

    const thread = [...base, makeMessage("user", question)];
    setMessages(thread);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: thread.map(({ role, content }) => ({ role, content })),
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || data.error || typeof data.content !== "string") {
        throw new Error(
          data.error || "The assistant could not answer. Please try again."
        );
      }

      setMessages([
        ...thread,
        makeMessage("assistant", data.content, {
          sources: Array.isArray(data.sources) ? data.sources : [],
        }),
      ]);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Something went wrong. Please try again.";
      setMessages([...thread, makeMessage("assistant", message, { isError: true })]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const retry = (index: number) => {
    const question = messages[index - 1];
    if (!question || question.role !== "user" || loading) return;
    send(question.content, messages.slice(0, index - 1));
  };

  const reset = () => {
    setMessages([]);
    setInput("");
    inputRef.current?.focus();
  };

  const copy = async (message: Message) => {
    try {
      await navigator.clipboard.writeText(toPlainText(message.content));
      setCopiedId(message.id);
      window.setTimeout(
        () => setCopiedId((id) => (id === message.id ? null : id)),
        1500
      );
    } catch {
      // Clipboard access can be blocked by the browser; nothing to do.
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      send(input);
    }
  };

  return (
    <div className="flex h-dvh flex-col bg-[#F4F6F9] font-sans text-[#14243A]">
      <header className="shrink-0 bg-[#0F4C81] text-white">
        <div className="mx-auto flex w-full max-w-3xl items-center gap-3 px-4 py-3.5">
          <div
            aria-hidden="true"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-lg font-bold text-[#0F4C81]"
          >
            A
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-semibold leading-tight">
              ABES FAQ Assistant
            </h1>
            <p className="truncate text-sm text-white/75">
              ABES Engineering College, Ghaziabad
            </p>
          </div>
          {hasMessages && (
            <button
              type="button"
              onClick={reset}
              disabled={loading}
              className={`rounded-lg bg-white/10 px-3 py-1.5 text-sm font-medium transition-colors hover:bg-white/20 disabled:opacity-50 ${FOCUS_RING}`}
            >
              New chat
            </button>
          )}
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto [scrollbar-color:#B9C5D3_transparent] [scrollbar-width:thin]">
        <div className="mx-auto w-full max-w-3xl px-4 py-6">
          {!hasMessages ? (
            <section className="pt-4 sm:pt-12">
              <h2 className="text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
                Hi, I&apos;m the ABES FAQ Assistant 👋
              </h2>
              <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-[#5A6B80]">
                Ask about courses, fees, admissions, placements or campus life.
                Answers come from the college&apos;s official website and its
                Mandatory Disclosure document.
              </p>

              <h3 className="mt-10 text-sm font-medium text-[#5A6B80]">
                Common questions
              </h3>
              <ul className="mt-2 border-b border-[#D8E0EA]">
                {QUESTIONS.map((question) => (
                  <li key={question}>
                    <button
                      type="button"
                      onClick={() => send(question)}
                      disabled={loading}
                      className={`flex w-full items-center justify-between gap-4 border-t border-[#D8E0EA] py-3.5 text-left text-[15px] transition-colors hover:text-[#0F4C81] disabled:opacity-60 ${FOCUS_RING}`}
                    >
                      {question}
                      <svg
                        viewBox="0 0 24 24"
                        className="h-4 w-4 shrink-0 text-[#5A6B80]"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="m9 6 6 6-6 6" />
                      </svg>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ) : (
            <div
              role="log"
              aria-live="polite"
              aria-label="Conversation"
              className="space-y-6"
            >
              {messages.map((message, index) =>
                message.role === "user" ? (
                  <div key={message.id} className="flex flex-col items-end gap-1">
                    <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-[#0F4C81] px-4 py-2.5 text-[15px] leading-relaxed text-white">
                      {message.content}
                    </div>
                    <span className="text-xs text-[#5A6B80]">{message.time}</span>
                  </div>
                ) : (
                  <div
                    key={message.id}
                    className="flex flex-col items-start gap-1.5"
                  >
                    <div
                      className={`max-w-[92%] rounded-2xl rounded-tl-md border px-4 py-3 text-[15px] leading-relaxed ${
                        message.isError
                          ? "border-[#E8C48A] bg-[#FFF8EC] text-[#6B4106]"
                          : "border-[#D8E0EA] bg-white"
                      }`}
                    >
                      {message.isError ? (
                        <p>{message.content}</p>
                      ) : (
                        <MessageContent text={message.content} />
                      )}
                      {!message.isError &&
                        !NO_SOURCES.test(message.content) &&
                        message.sources &&
                        message.sources.length > 0 && (
                          <SourceList sources={message.sources} />
                        )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-[#5A6B80]">
                      <span>{message.time}</span>
                      {message.isError ? (
                        <button
                          type="button"
                          onClick={() => retry(index)}
                          disabled={loading}
                          className={`font-medium text-[#0F4C81] underline underline-offset-2 disabled:opacity-50 ${FOCUS_RING}`}
                        >
                          Try again
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => copy(message)}
                          className={`font-medium hover:text-[#0F4C81] ${FOCUS_RING}`}
                        >
                          {copiedId === message.id ? "Copied" : "Copy"}
                        </button>
                      )}
                    </div>
                  </div>
                )
              )}

              {loading && (
                <div
                  role="status"
                  className="flex items-center gap-2 text-sm text-[#5A6B80]"
                >
                  <span className="flex gap-1" aria-hidden="true">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#22A6B3] motion-safe:animate-pulse" />
                    <span className="h-1.5 w-1.5 rounded-full bg-[#22A6B3] motion-safe:animate-pulse [animation-delay:200ms]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-[#22A6B3] motion-safe:animate-pulse [animation-delay:400ms]" />
                  </span>
                  Searching ABES sources&hellip;
                </div>
              )}
            </div>
          )}
          <div ref={endRef} />
        </div>
      </main>

      <footer className="shrink-0 border-t border-[#D8E0EA] bg-white">
        <div className="mx-auto w-full max-w-3xl px-4 pb-3 pt-3">
          <div className="flex items-end gap-2 rounded-xl border border-[#C5D0DD] bg-white p-1.5 focus-within:border-[#22A6B3] focus-within:ring-2 focus-within:ring-[#22A6B3]/30">
            <label htmlFor="question" className="sr-only">
              Your question
            </label>
            <textarea
              id="question"
              ref={inputRef}
              rows={1}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about admissions, fees, courses..."
              className="max-h-40 min-h-10 flex-1 resize-none bg-transparent px-2.5 py-2 text-[15px] leading-6 outline-none placeholder:text-[#66768B]"
            />
            <button
              type="button"
              onClick={() => send(input)}
              disabled={loading || !input.trim()}
              aria-label="Send message"
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#0F4C81] text-white transition-colors hover:bg-[#0B3C69] disabled:cursor-not-allowed disabled:bg-[#C5D0DD] ${FOCUS_RING}`}
            >
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M12 19V5" />
                <path d="m5 12 7-7 7 7" />
              </svg>
            </button>
          </div>
          <p className="mt-2 text-xs text-[#5A6B80]">
            Answers come from official ABES sources and can be incomplete.
            Check important details with the college.
          </p>
        </div>
      </footer>
    </div>
  );
}