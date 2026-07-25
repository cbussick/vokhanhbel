# Treat Offline Grading as Best-Effort

V1's optimistic grading uses TanStack Query's in-memory paused mutations, which replay after reconnecting only while the app remains alive. We do not add persisted offline mutation storage, so a Grade taken offline may be lost if the app closes before replay.
