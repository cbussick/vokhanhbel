# Derive Points from the Review Log

The app awards Points for each Review, and a stored running counter would risk divergence from the underlying history. We always calculate the total as `SUM(reviews.points_awarded)` over the append-only Review log.
