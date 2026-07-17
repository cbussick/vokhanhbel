import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Card } from "../contracts/card";
import { apiPaths } from "../contracts/apiPaths";
import {
  khunhphapLimits,
  khunhphapStreamEventSchema,
  type KhunhphapInput,
} from "../contracts/khunhphap";
import { problemSchema, problemTypes } from "../contracts/problem";
import { useOnlineStatus } from "../lib/browserState";
import { publishSessionExpired } from "../lib/sessionEvents";
import styles from "./KhunhphapDialog.module.css";

interface Message {
  role: "user" | "assistant";
  content: string;
}

type RequestState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "thinking" }
  | { status: "streaming" }
  | { status: "error"; message: string; retryAfter: number };

class KhunhphapRequestError extends Error {
  constructor(
    message: string,
    public readonly retryAfter?: number,
  ) {
    super(message);
  }
}

export function KhunhphapDialog({ card, onClose }: { card: Card; onClose: () => void }) {
  const { t } = useTranslation();

  const dialogRef = useRef<HTMLDialogElement>(null);
  const abortRef = useRef<AbortController | undefined>(undefined);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [request, setRequest] = useState<RequestState>({ status: "idle" });
  const [truncated, setTruncated] = useState(false);
  const [following, setFollowing] = useState(true);

  const online = useOnlineStatus();
  const pending =
    request.status === "submitting" ||
    request.status === "thinking" ||
    request.status === "streaming";
  const thinking = request.status === "thinking";
  const error = request.status === "error" ? request.message : undefined;
  const retryAfter = request.status === "error" ? request.retryAfter : 0;

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  useEffect(() => {
    if (request.status !== "submitting") return;

    const timer = window.setTimeout(() => {
      setRequest((state) =>
        state.status === "submitting" ? { status: "thinking" } : state,
      );
    }, 300);

    return () => window.clearTimeout(timer);
  }, [request.status]);

  useEffect(() => {
    if (retryAfter <= 0) return;

    const timer = window.setInterval(
      () =>
        setRequest((state) =>
          state.status === "error"
            ? { ...state, retryAfter: Math.max(0, state.retryAfter - 1) }
            : state,
        ),
      1_000,
    );

    return () => window.clearInterval(timer);
  }, [retryAfter]);

  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    if (following) endRef.current?.scrollIntoView?.();
  }, [messages, following, thinking]);

  const close = () => {
    abortRef.current?.abort();
    dialogRef.current?.close();
    onClose();
  };

  const send = async (text = question) => {
    const trimmed = text.trim();

    if (!trimmed || pending || !online || retryAfter > 0) return;

    const history = messages.slice(-khunhphapLimits.conversationMessages);
    const historyLength = messages.length;
    const input: KhunhphapInput = { message: trimmed, messages: history };
    const controller = new AbortController();

    abortRef.current = controller;
    setQuestion("");
    setTruncated(false);
    setRequest({ status: "submitting" });
    setMessages((items) => [
      ...items,
      { role: "user", content: trimmed },
      { role: "assistant", content: "" },
    ]);

    try {
      const response = await fetch(apiPaths.khunhphapReplies(card.id), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
        signal: controller.signal,
        credentials: "same-origin",
      });

      if (!response.ok || !response.body) {
        const problem = problemSchema.safeParse(await response.json().catch(() => undefined));

        if (response.status === 401) {
          publishSessionExpired();
          throw new KhunhphapRequestError("expired");
        }

        const retryHeader = response.headers.get("retry-after");
        const retrySeconds = retryHeader && /^\d+$/u.test(retryHeader) ? Number(retryHeader) : 0;

        if (problem.success && problem.data.type === problemTypes.khunhphapSessionLimit)
          throw new KhunhphapRequestError("session-limit", Math.max(1, retrySeconds));
        if (problem.success && problem.data.type === problemTypes.khunhphapDailyLimit)
          throw new KhunhphapRequestError("daily-limit", Math.max(1, retrySeconds));

        throw new Error("failed");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let completed = false;

      while (true) {
        const { value, done } = await reader.read();

        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const blocks = buffer.split("\n\n");
        buffer = blocks.pop() ?? "";

        for (const block of blocks) {
          const event = /^event: (.+)$/m.exec(block)?.[1];
          const dataText = /^data: (.+)$/m.exec(block)?.[1];

          if (!event || !dataText) throw new Error("failed");
          const data: unknown = JSON.parse(dataText);
          const streamEvent = khunhphapStreamEventSchema.parse({ event, data });

          if (streamEvent.event === "delta") {
            setRequest((state) =>
              state.status === "streaming" ? state : { status: "streaming" },
            );
            setMessages((items) =>
              items.map((message, index) =>
                index === items.length - 1
                  ? { ...message, content: message.content + streamEvent.data.text }
                  : message,
              ),
            );
          } else if (streamEvent.event === "done") {
            completed = true;
            setTruncated(streamEvent.data.truncated);
          } else throw new Error("failed");
        }
      }

      if (!completed) throw new Error("failed");
      setRequest({ status: "idle" });
    } catch (value) {
      if (controller.signal.aborted) return;

      const code = value instanceof Error ? value.message : "failed";

      setMessages((items) => items.slice(0, historyLength));
      setQuestion(trimmed);
      setRequest({
        status: "error",
        message:
          code === "session-limit"
          ? t("khunhphap.sessionLimit")
          : code === "daily-limit"
            ? t("khunhphap.dailyLimit")
            : t("khunhphap.error"),
        retryAfter:
          value instanceof KhunhphapRequestError && value.retryAfter
            ? Math.ceil(value.retryAfter)
            : 0,
      });
    }
  };

  const onScroll = () => {
    const element = scrollerRef.current;

    if (element) setFollowing(element.scrollHeight - element.scrollTop - element.clientHeight < 48);
  };

  const latest = () => {
    const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
    endRef.current?.scrollIntoView?.({ behavior: reduceMotion ? "auto" : "smooth" });
    setFollowing(true);
  };

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      aria-labelledby="khunhphap-title"
    >
      <section className={styles.sheet}>
        <header>
          <h2 id="khunhphap-title">{t("khunhphap.title")}</h2>
          <button type="button" onClick={close} aria-label={t("common.close")}>
            ×
          </button>
        </header>
        <p className={styles.disclosure}>{t("khunhphap.disclosure")}</p>
        <div ref={scrollerRef} className={styles.messages} onScroll={onScroll} aria-live="polite">
          {messages.map((message, index) => (
            <article
              key={`${message.role}-${index}`}
              className={message.role === "user" ? styles.user : styles.assistant}
            >
              <strong>{message.role === "user" ? "Khanh" : t("khunhphap.title")}</strong>
              {message.content && <p>{message.content}</p>}
            </article>
          ))}
          {thinking && <p className={styles.thinking}>{t("khunhphap.thinking")}</p>}
          {truncated && <p className={styles.notice}>{t("khunhphap.truncated")}</p>}
          {error && (
            <div className={styles.error} role="alert">
              <p>
                {error}
                {retryAfter > 0 ? ` (${retryAfter} s)` : ""}
              </p>
              <button
                type="button"
                disabled={retryAfter > 0 || !online}
                onClick={() => void send()}
              >
                {t("common.retry")}
              </button>
            </div>
          )}
          <div ref={endRef} />
        </div>
        {!following && (
          <button type="button" className={styles.latest} onClick={latest}>
            {t("khunhphap.latest")}
          </button>
        )}
        <div className={styles.prompts}>
          {(["simple", "example", "memory"] as const).map((key) => (
            <button
              key={key}
              type="button"
              disabled={pending}
              onClick={() => void send(t(`khunhphap.${key}`))}
            >
              {t(`khunhphap.${key}`)}
            </button>
          ))}
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void send();
          }}
        >
          <label htmlFor="khunhphap-question">{t("khunhphap.question")}</label>
          <textarea
            id="khunhphap-question"
            minLength={1}
            maxLength={khunhphapLimits.messageCharacters}
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            disabled={pending || !online || retryAfter > 0}
          />
          <button type="submit" disabled={pending || !question.trim() || !online || retryAfter > 0}>
            {t("khunhphap.send")}
          </button>
          {!online && <p>{t("khunhphap.offline")}</p>}
        </form>
      </section>
    </dialog>
  );
}
