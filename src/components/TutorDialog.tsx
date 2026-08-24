import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { apiPaths } from "../contracts/apiPaths";
import type { Card } from "../contracts/card";
import { problemSchema, problemTypes } from "../contracts/problem";
import { tutorLimits, tutorStreamEventSchema, type TutorInput } from "../contracts/tutor";
import { useOnlineStatus } from "../lib/browserState";
import { publishSessionExpired } from "../lib/sessionEvents";
import type { TutorConversationMessage } from "../state/ReviewSessionContext";
import { Dialog } from "./Dialog";
import { TutopherAvatar } from "./TutopherAvatar";
import styles from "./TutorDialog.module.css";

type RequestState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "thinking" }
  | { status: "streaming" }
  | { status: "error"; message: string; retryAfter: number };

class TutorRequestError extends Error {
  constructor(
    message: string,
    public readonly retryAfter?: number,
  ) {
    super(message);
  }
}

export function TutorDialog({
  card,
  messages,
  updateMessages,
  onClose,
}: {
  card: Card;
  messages: TutorConversationMessage[];
  updateMessages: (
    update: (messages: TutorConversationMessage[]) => TutorConversationMessage[],
  ) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();

  const dialogRef = useRef<HTMLDialogElement>(null);
  const activeRequestRef = useRef<
    { controller: AbortController; historyLength: number } | undefined
  >(undefined);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const [question, setQuestion] = useState("");
  const [request, setRequest] = useState<RequestState>({ status: "idle" });
  const [announcement, setAnnouncement] = useState("");
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
  const remainingLearnerMessages = Math.max(
    0,
    (tutorLimits.conversationMessageCeiling - messages.length) / 2,
  );
  const atConversationCeiling = remainingLearnerMessages === 0;
  const conversationFull = atConversationCeiling && !pending;
  const composerDisabled = pending || !online || retryAfter > 0 || atConversationCeiling;

  useEffect(() => {
    if (request.status !== "submitting") return;

    const timer = window.setTimeout(() => {
      setRequest((state) => (state.status === "submitting" ? { status: "thinking" } : state));
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

  useEffect(() => () => activeRequestRef.current?.controller.abort(), []);

  // messages and thinking are deliberate triggers, not values the callback reads: they are what
  // makes the view follow a new Tutor reply. Removing them would only scroll when the Learner
  // toggles following.
  useEffect(() => {
    if (following) endRef.current?.scrollIntoView?.();
    // oxlint-disable-next-line react/exhaustive-effect-dependencies -- deliberate scroll triggers
  }, [messages, following, thinking]);

  const close = () => {
    const activeRequest = activeRequestRef.current;

    if (activeRequest) {
      activeRequest.controller.abort();
      updateMessages((items) => items.slice(0, activeRequest.historyLength));
      activeRequestRef.current = undefined;
    }

    dialogRef.current?.close();
    onClose();
  };

  const send = async (text = question) => {
    const trimmed = text.trim();

    if (!trimmed || composerDisabled) return;

    const historyLength = messages.length;
    const input: TutorInput = { message: trimmed, messages };
    const controller = new AbortController();

    activeRequestRef.current = { controller, historyLength };
    setQuestion("");
    setAnnouncement("");
    setTruncated(false);
    setRequest({ status: "submitting" });
    updateMessages((items) => [
      ...items,
      { role: "user", content: trimmed },
      { role: "assistant", content: "" },
    ]);

    try {
      const response = await fetch(apiPaths.tutorReplies(card.id), {
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
          throw new TutorRequestError("expired");
        }

        const retryHeader = response.headers.get("retry-after");
        const retrySeconds = retryHeader && /^\d+$/u.test(retryHeader) ? Number(retryHeader) : 0;

        if (problem.success && problem.data.type === problemTypes.tutorSessionLimit)
          throw new TutorRequestError("session-limit", Math.max(1, retrySeconds));
        if (problem.success && problem.data.type === problemTypes.tutorDailyLimit)
          throw new TutorRequestError("daily-limit", Math.max(1, retrySeconds));

        throw new Error("failed");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let completed = false;
      let assistantReply = "";

      while (true) {
        const { value, done } = await reader.read();

        if (controller.signal.aborted) return;
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const blocks = buffer.split("\n\n");
        buffer = blocks.pop() ?? "";

        for (const block of blocks) {
          const event = /^event: (.+)$/m.exec(block)?.[1];
          const dataText = /^data: (.+)$/m.exec(block)?.[1];

          if (!event || !dataText) throw new Error("failed");
          const data: unknown = JSON.parse(dataText);
          const streamEvent = tutorStreamEventSchema.parse({ event, data });

          if (streamEvent.event === "delta") {
            assistantReply += streamEvent.data.text;
            setRequest((state) => (state.status === "streaming" ? state : { status: "streaming" }));
            updateMessages((items) =>
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
      activeRequestRef.current = undefined;
      setAnnouncement(`${t("tutor.title")}: ${assistantReply}`);
      setRequest({ status: "idle" });
    } catch (value) {
      if (controller.signal.aborted) return;

      activeRequestRef.current = undefined;
      const code = value instanceof Error ? value.message : "failed";

      updateMessages((items) => items.slice(0, historyLength));
      setQuestion(trimmed);
      setRequest({
        status: "error",
        message:
          code === "session-limit"
            ? t("tutor.sessionLimit")
            : code === "daily-limit"
              ? t("tutor.dailyLimit")
              : t("tutor.error"),
        retryAfter:
          value instanceof TutorRequestError && value.retryAfter ? Math.ceil(value.retryAfter) : 0,
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

  const startOver = () => {
    updateMessages(() => []);
    setQuestion("");
    setRequest({ status: "idle" });
    setAnnouncement("");
    setTruncated(false);
    setFollowing(true);
  };

  if (!card.front.text || !card.back.text) {
    return (
      <Dialog dialogRef={dialogRef} titleId="tutor-title" title={t("tutor.title")} onClose={close}>
        <p>{t("tutor.audioOnly")}</p>
      </Dialog>
    );
  }

  return (
    <Dialog
      dialogRef={dialogRef}
      className={styles.tutorDialog}
      titleId="tutor-title"
      title={t("tutor.title")}
      onClose={close}
      footer={
        <form
          className={styles.composer}
          onSubmit={(event) => {
            event.preventDefault();
            void send();
          }}
        >
          <label htmlFor="tutor-question">{t("tutor.question")}</label>
          <textarea
            id="tutor-question"
            aria-describedby={conversationFull ? "tutor-conversation-full" : undefined}
            minLength={1}
            maxLength={tutorLimits.messageCharacters}
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            disabled={composerDisabled}
          />
          <button type="submit" disabled={composerDisabled || !question.trim()}>
            {t("tutor.send")}
          </button>
          {!online && <p>{t("tutor.offline")}</p>}
          {conversationFull && (
            <>
              <p id="tutor-conversation-full">{t("tutor.conversationFull")}</p>
              <button type="button" onClick={startOver}>
                {t("tutor.startOver")}
              </button>
            </>
          )}
        </form>
      }
    >
      <div className={styles.conversation}>
        <p className={styles.disclosure}>{t("tutor.reliability")}</p>
        <div className={styles.transcript}>
          <div
            ref={scrollerRef}
            className={styles.messages}
            role="region"
            aria-label={t("tutor.conversation")}
            onScroll={onScroll}
          >
            {messages.length === 0 && (
              <div className={styles.emptyState}>
                <TutopherAvatar size="large" />
                <p className={styles.promptHint}>{t("tutor.promptHint")}</p>
                <p className={styles.disclosure}>{t("tutor.dataFlow")}</p>
              </div>
            )}
            {messages.map((message, index) => (
              <article
                key={`${message.role}-${index}`}
                className={message.role === "user" ? styles.user : styles.assistant}
                aria-label={message.role === "assistant" ? t("tutor.title") : undefined}
              >
                {message.role === "user" ? (
                  <>
                    <strong>Khanh</strong>
                    {message.content && <p>{message.content}</p>}
                  </>
                ) : (
                  <>
                    <TutopherAvatar size="small" />
                    <div className={styles.reply}>
                      {message.content && <p>{message.content}</p>}
                    </div>
                  </>
                )}
              </article>
            ))}
            {thinking && <p className={styles.thinking}>{t("tutor.thinking")}</p>}
            {truncated && <p className={styles.notice}>{t("tutor.truncated")}</p>}
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
              <svg aria-hidden="true" viewBox="0 0 24 24">
                <path d="m5 9 7 7 7-7" />
              </svg>
              {t("tutor.latest")}
            </button>
          )}
        </div>
        <p className={styles.visuallyHidden} role="status" aria-atomic="true">
          {announcement}
        </p>
        {remainingLearnerMessages > 0 && remainingLearnerMessages <= 3 && (
          <p className={styles.notice}>
            {t("tutor.remainingMessages", { count: remainingLearnerMessages })}
          </p>
        )}
        <div className={`${styles.prompts} ${messages.length === 0 ? styles.emptyPrompts : ""}`}>
          {(["simple", "example", "memory"] as const).map((key) => (
            <button
              key={key}
              type="button"
              disabled={composerDisabled}
              onClick={() => void send(t(`tutor.${key}`))}
            >
              {t(`tutor.${key}`)}
            </button>
          ))}
        </div>
      </div>
    </Dialog>
  );
}
