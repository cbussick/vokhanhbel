import { delay, http, HttpResponse } from "msw";
import { handlers } from "./handlers";

export const saving = {
  msw: {
    handlers: {
      app: [
        http.patch("/api/*", async () => {
          await delay("infinite");
        }),
        ...handlers,
      ],
    },
  },
};
export const saveFailed = {
  msw: {
    handlers: {
      app: [
        http.patch("/api/*", () =>
          HttpResponse.json(
            { type: "about:blank", title: "Unavailable", status: 503 },
            { status: 503 },
          ),
        ),
        ...handlers,
      ],
    },
  },
};
