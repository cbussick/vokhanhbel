import { createContext, type ReactNode, useContext } from "react";
import type { ReviewSubmission } from "./review/reviewSubmission";
import {
  useReviewSubmissionQueue,
  type ReviewSubmissionRejectedHandler,
} from "./review/useReviewSubmissionQueue";

interface ReviewSubmissionSync {
  optimisticPoints: number;
  outstandingCount: number;
  failedCount: number;
  syncing: boolean;
  retryFailedSubmissions: () => void;
}

interface ReviewSubmissionState {
  submissionSync: ReviewSubmissionSync;
  enqueueSubmission: (
    submission: ReviewSubmission,
    onRejected: ReviewSubmissionRejectedHandler,
  ) => void;
  discardAllSubmissions: () => void;
}

const ReviewSubmissionContext = createContext<ReviewSubmissionState | undefined>(undefined);

export function ReviewSubmissionProvider({ children }: { children: ReactNode }) {
  const {
    enqueueSubmission,
    retryFailedSubmissions,
    discardAllSubmissions,
    optimisticPoints,
    outstandingCount,
    failedCount,
    syncing,
  } = useReviewSubmissionQueue();

  const value: ReviewSubmissionState = {
    submissionSync: {
      optimisticPoints,
      outstandingCount,
      failedCount,
      syncing,
      retryFailedSubmissions,
    },
    enqueueSubmission,
    discardAllSubmissions,
  };

  return (
    <ReviewSubmissionContext.Provider value={value}>{children}</ReviewSubmissionContext.Provider>
  );
}

export function useReviewSubmissions(): ReviewSubmissionState {
  const value = useContext(ReviewSubmissionContext);

  if (!value) throw new Error("ReviewSubmissionProvider missing");

  return value;
}
