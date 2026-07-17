import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { apiPaths } from "../../contracts/apiPaths";
import { apiRequest, isTemporaryError } from "../../lib/apiClient";
import { queryKeys } from "../../lib/queryKeys";
import type { ReviewSubmission } from "./reviewSubmission";

const retryDelays = [1_000, 2_000, 4_000];

interface QueuedReviewSubmission extends ReviewSubmission {
  syncStatus: "pending" | "syncing" | "failed";
  onRejected: ReviewSubmissionRejectedHandler;
}

export type ReviewSubmissionRejectedHandler = (
  submission: ReviewSubmission,
  error: unknown,
) => void;

interface ReviewSubmissionQueue {
  enqueueSubmission: (
    submission: ReviewSubmission,
    onRejected: ReviewSubmissionRejectedHandler,
  ) => void;
  retryFailedSubmissions: () => void;
  discardAllSubmissions: () => void;
  outstandingCount: number;
  failedCount: number;
  syncing: boolean;
  optimisticPoints: number;
}

function waitForRetry(milliseconds: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const finish = () => {
      signal.removeEventListener("abort", cancel);
      resolve();
    };
    const cancel = () => {
      window.clearTimeout(timer);
      resolve();
    };
    const timer = window.setTimeout(finish, milliseconds);
    signal.addEventListener("abort", cancel, { once: true });
  });
}

export function useReviewSubmissionQueue(): ReviewSubmissionQueue {
  const queryClient = useQueryClient();
  const [queuedSubmissions, setQueuedSubmissions] = useState<QueuedReviewSubmission[]>([]);
  const queuedSubmissionsRef = useRef<QueuedReviewSubmission[]>([]);
  const controllers = useRef(new Map<string, AbortController>());
  const generation = useRef(0);

  const updateQueuedSubmissions = (
    update: (submissions: QueuedReviewSubmission[]) => QueuedReviewSubmission[],
  ) => {
    setQueuedSubmissions((submissions) => {
      const nextSubmissions = update(submissions);
      queuedSubmissionsRef.current = nextSubmissions;

      return nextSubmissions;
    });
  };

  const updateQueuedSubmission = (
    id: string,
    update: (submission: QueuedReviewSubmission) => QueuedReviewSubmission | undefined,
  ) => {
    updateQueuedSubmissions((submissions) =>
      submissions.flatMap((submission) => {
        if (submission.input.id !== id) return [submission];
        const updated = update(submission);

        return updated ? [updated] : [];
      }),
    );
  };

  const sendReviewSubmission = async (submission: QueuedReviewSubmission, automatic = true) => {
    if (!navigator.onLine || controllers.current.has(submission.input.id)) return;

    const controller = new AbortController();
    const requestGeneration = generation.current;

    controllers.current.set(submission.input.id, controller);
    updateQueuedSubmission(submission.input.id, (current) => ({
      ...current,
      syncStatus: "syncing",
    }));

    const attempts = automatic ? retryDelays.length + 1 : 1;

    try {
      for (let attempt = 0; attempt < attempts; attempt += 1) {
        try {
          await apiRequest(apiPaths.reviews, {
            method: "POST",
            body: JSON.stringify(submission.input),
            signal: controller.signal,
          });
          if (controller.signal.aborted || requestGeneration !== generation.current) return;
          updateQueuedSubmission(submission.input.id, () => undefined);
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: queryKeys.cards }),
            queryClient.invalidateQueries({ queryKey: queryKeys.stats }),
          ]);

          return;
        } catch (error) {
          if (controller.signal.aborted || requestGeneration !== generation.current) return;
          if (!isTemporaryError(error)) {
            updateQueuedSubmission(submission.input.id, () => undefined);
            submission.onRejected(submission, error);

            return;
          }
          if (attempt < attempts - 1)
            await waitForRetry(retryDelays[attempt] ?? 4_000, controller.signal);
        }
      }

      updateQueuedSubmission(submission.input.id, (current) => ({
        ...current,
        syncStatus: "failed",
      }));
    } finally {
      if (controllers.current.get(submission.input.id) === controller)
        controllers.current.delete(submission.input.id);
    }
  };

  const handleReconnect = useEffectEvent(() => {
    for (const submission of queuedSubmissionsRef.current)
      if (submission.syncStatus !== "syncing") void sendReviewSubmission(submission);
  });

  useEffect(() => {
    window.addEventListener("online", handleReconnect);

    return () => window.removeEventListener("online", handleReconnect);
  }, []);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (queuedSubmissionsRef.current.length > 0) event.preventDefault();
    };

    window.addEventListener("beforeunload", warn);

    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  const enqueueSubmission = (
    submission: ReviewSubmission,
    onRejected: ReviewSubmissionRejectedHandler,
  ) => {
    const queuedSubmission: QueuedReviewSubmission = {
      ...submission,
      syncStatus: "pending",
      onRejected,
    };

    updateQueuedSubmissions((submissions) => [...submissions, queuedSubmission]);
    void sendReviewSubmission(queuedSubmission);
  };

  const retryFailedSubmissions = () => {
    for (const submission of queuedSubmissionsRef.current)
      if (submission.syncStatus === "failed" || submission.syncStatus === "pending")
        void sendReviewSubmission(submission, false);
  };

  const discardAllSubmissions = () => {
    generation.current += 1;
    for (const controller of controllers.current.values()) controller.abort();
    controllers.current.clear();
    updateQueuedSubmissions(() => []);
  };

  return {
    enqueueSubmission,
    retryFailedSubmissions,
    discardAllSubmissions,
    outstandingCount: queuedSubmissions.length,
    failedCount: queuedSubmissions.filter((submission) => submission.syncStatus === "failed")
      .length,
    syncing: queuedSubmissions.some((submission) => submission.syncStatus === "syncing"),
    optimisticPoints: queuedSubmissions.reduce(
      (total, submission) => total + submission.optimisticPoints,
      0,
    ),
  };
}
