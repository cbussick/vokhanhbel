export const findings = [
  {
    title: "Text buttons do not share a component",
    sources:
      "src/components/Dialog.module.css; src/components/IconButton.module.css; src/routes/login.module.css; src/routes/review.module.css; src/components/ErrorScreen.module.css; src/components/review/reviewSession.module.css",
    observation:
      "Dialog action buttons use 44px minimum height and weight 700. IconButton, login, review and error actions have separate rules, commonly weight 800 and different sizing. IconButton contains both an icon and a visible label despite its name. Hover and pending rules also live in multiple stylesheets.",
    decision:
      "Decide whether to extract a text Button and rename or document IconButton. Keep the existing variants visible until the intended differences are agreed; do not make every action look identical by default.",
  },
  {
    title: "Color roles are not completely tokenized",
    sources:
      "src/components/Dialog.module.css; src/components/ConnectivityBanner.module.css; src/components/review/reviewSession.module.css",
    observation:
      "White/black literals coexist with --color-surface, white is also used as an on-danger foreground, the modal scrim is rgb(36 54 66 / 45%), and the forgotten Grade uses #e7edf1. Many component-local color-mix expressions derive additional surfaces rather than using shared semantic names.",
    decision:
      "Consider on-danger, scrim and neutral-Grade tokens, and decide which derived state surfaces deserve names. Do not replace every white foreground with the surface token: those are different semantic roles. LocalColorsAndArtwork lists literal usage, not just the global palette.",
  },
  {
    title: "A 12px radius has no radius token",
    sources:
      "src/components/audio/AudioPlayer.module.css: .player; src/components/CardFormDialog.module.css: face tabs",
    observation:
      "AudioPlayer uses --space-3 for border-radius (12px at a 16px root), while the Card form derives 12px with calc(--radius-medium - --space-1). The global radius scale jumps from 4px to 16px.",
    decision:
      "Decide whether 12px is a reusable radius token or intentionally an inset relationship. Spacing tokens should not silently become the radius API.",
  },
  {
    title: "Font roles stop at families and sizes",
    sources:
      "src/styles/global.css; src/styles/fonts.css; src/components/Dialog.module.css; src/routes/me.module.css; src/components/review/reviewSession.module.css",
    observation:
      "Families and size tokens already exist. Weights 400/500/600/700/800 and line heights such as 1.2, 1.3, 1.5 and 1.65 remain local values. Baloo 2 is loaded only at weight 800. Display headings and UI field headings deliberately use different families.",
    decision:
      "Agree on weight and line-height roles before adding tokens. The typography stories show all shipped weights and German/Vietnamese samples; this ticket does not infer a new hierarchy.",
  },
  {
    title: "Spacing and control dimensions are mixed",
    sources:
      "src/components/Dialog.module.css; src/components/LanguageSelect.tsx; src/components/review/reviewSession.module.css",
    observation:
      "The global spacing scale is widely used, but control heights, small geometry, popover gap (4px), borders, breakpoints and some local rem values are independent. Not every literal is an accidental spacing inconsistency.",
    decision:
      "Keep --space-* as the spacing contract. Audit recurring layout gaps separately from target sizes, border widths and breakpoint decisions rather than mechanically replacing all numbers.",
  },
  {
    title: "Cards and fields are mostly compositions, not generic primitives",
    sources:
      "src/components/audio/CardFace.tsx; src/components/audio/VisualCardFace.tsx; src/routes/cards.$collectionId.tsx; src/components/Dialog.module.css",
    observation:
      "CardFace and VisualCardFace are shared, while list rows, Collection tiles, exercise panels and summary cards have different semantics and implementations. Text inputs and textareas inherit styling from the Dialog body; there is no standalone Field/Input component or universal Card component.",
    decision:
      "Only extract a primitive once its shared behavior is clear. App pages and review stories display actual implementations instead of inventing a generic Card or reproducing route markup in Storybook.",
  },
  {
    title: "Accessibility states need component-specific review",
    sources:
      "src/styles/global.css; src/components/audio/PronunciationGenerator.tsx; src/components/review/reviewSession.module.css",
    observation:
      "Native disabled controls get global opacity; some blocked controls intentionally remain focusable with aria-disabled and explanatory text. Success uses dark text; white on --color-success would fail normal-text contrast. These are not equivalent state mechanisms.",
    decision:
      "Use the accessibility panel plus keyboard stories to review real pairings. Existing findings are reported in todo mode, not suppressed or automatically fixed. Manual reduced-motion, forced-colors and assistive-technology review remains necessary.",
  },
  {
    title: "Artwork palettes are not UI status tokens",
    sources: "src/components/CollectionIcon.tsx; src/components/TutopherAvatar.tsx",
    observation:
      "Flags and Tutopher have illustration-specific colors, unlike semantic success/warning/danger UI colors. CollectionIcon deliberately documents this distinction.",
    decision:
      "Keep artwork colors independent unless an artwork palette is explicitly requested. Do not recolor national flags or the mascot to fit the UI palette.",
  },
];
