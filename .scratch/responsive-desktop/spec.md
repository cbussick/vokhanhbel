# Responsive desktop layout

Status: ready-for-agent

## Goal

Make the mobile-first app feel intentional on desktop without changing the existing mobile
experience or visual language.

## Requirements

- Preserve the existing mobile layout.
- Between `48rem` and `64rem`, allow a wider tablet layout while retaining bottom navigation.
- At `64rem` and above, use a sticky, full-height left sidebar containing the app name, the three
  primary navigation links, and the Points badge.
- Keep the page title at the top of the main content.
- Cap standard main content at approximately `72rem`.
- Show Cards in a two-column grid on desktop while retaining the existing editor interaction.
- Keep total Points as the full-width hero on the progress page and place the other three stats in
  a three-column row beneath it.
- Keep an active Review Session centered and distraction-free, with a maximum width of
  approximately `48rem`.
- Keep dialogs as centered modals on desktop and widen them modestly to approximately `36–40rem`;
  retain their mobile bottom-sheet behavior.
- Preserve the current colors, typography, rounded surfaces, and overall visual tone.

## Verification seam

Verify rendered browser behavior at `320`, `768`, `1024`, and `1440px`. Assertions should use
visible navigation, content, and element geometry rather than CSS implementation details.
