import type { Card } from "../../contracts/card";
import type { ReviewSubmissionInput } from "../../contracts/review";

export interface ReviewSubmission {
  input: ReviewSubmissionInput;
  reviewSessionId: string;
  card: Card;
  optimisticPoints: number;
  cardIndex: number;
}
