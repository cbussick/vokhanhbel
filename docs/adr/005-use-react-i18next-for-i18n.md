# ADR-005: Use react-i18next For UI Translation

## Status

Accepted

## Date

2026-07-11

## Context

The app's UI is German for V1 (Khanh's primary language), and its canonical study
direction is English prompts to German meanings or explanations. Card fields remain
free-form, so their content may expand beyond that language pair later. Hardcoding German
strings directly in components would work for V1 but would require a rewrite — hunting
down every hardcoded string — if a second UI locale (e.g. English) is ever needed. A
translation layer set up now, even with only one locale shipped, keeps that door open
cheaply.

## Decision

Use `react-i18next` (with `i18next`) for all user-facing UI copy. All strings are routed
through translation keys from the start; only a `de` locale file ships in V1. Locale
setup and translation files live under `src/i18n/`.

A shared, allowlisted `appLocale` is fixed to `de` in V1. The frontend uses it to
initialize `react-i18next`, and the backend maps it to German as Khunpap's explanation
language. Khunpap may infer the language being studied from Card content, but it does
not independently infer the language in which it teaches.

## Alternatives Considered

### Hardcoded German strings, no i18n library

- Pros: zero extra dependency, simplest possible V1.
- Cons: adding a second locale later means finding and replacing every hardcoded string
  across components — a rewrite, not a config change.
- Rejected because Card content remains free-form and future product expansion may still
  require another UI locale; routing copy through translation keys now avoids a later
  component-by-component rewrite.

### react-intl (FormatJS)

- Pros: mature, ICU MessageFormat support, used widely outside the React ecosystem too.
- Cons: more verbose API for this app's needs (no complex ICU formatting required yet);
  slightly heavier setup for a single-locale V1.
- Rejected in favor of `react-i18next`'s simpler interpolation/pluralization API, which is
  a more common pairing with a Vite + React stack.

## Consequences

- All new UI copy must be added as translation keys under `src/i18n/`, not inline
  strings, even though only German ships in V1.
- Adding a second locale later is a new locale file plus a locale switch, not a
  component-by-component rewrite.
- Any future client-selected locale must be checked against the server's supported
  locale allowlist before it can influence the tutor prompt.
- Slightly more setup/boilerplate for V1 than hardcoding strings would have been.
