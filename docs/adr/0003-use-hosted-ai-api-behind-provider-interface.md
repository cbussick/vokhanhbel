# Use a Hosted AI API Behind a Provider Interface

Khunhphap needs high-quality, low-volume assistance without exposing API credentials or tightly coupling the product to one provider. We call OpenAI's Responses API only from backend code through a small `aiProvider` interface, send only the current Card and bounded conversation context, and keep conversations ephemeral, plain-text, rate-limited, and free of tool access.
