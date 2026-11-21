FROM mcr.microsoft.com/playwright:v1.61.1-noble@sha256:5b8f294aff9041b7191c34a4bab3ac270157a28774d4b0660e9743297b697e48

# Ubuntu CI includes DejaVu. The app's text arrow falls back to it because the bundled UI
# font has no arrow glyph; the stock Playwright image otherwise chooses a different font.
RUN apt-get update \
    && apt-get install --no-install-recommends -y fonts-dejavu-core=2.37-8 fonts-dejavu-mono=2.37-8 \
    && rm -rf /var/lib/apt/lists/*
