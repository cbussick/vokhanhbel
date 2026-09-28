import type { Meta, StoryObj } from "@storybook/react-vite";
import styles from "./Foundations.module.css";
const meta = { title: "Foundations/Overview", parameters: { layout: "fullscreen" } } satisfies Meta;
export default meta;
export const StartHere: StoryObj<typeof meta> = {
  render: () => (
    <main className={styles.page}>
      <h1>Vokhanhbel · The app is the design system</h1>
      <p>
        A catalog of the components and visual decisions already in the app. Built in the spirit of
        FeBOp’s foundations and state stories, without a separate component package or token
        directory.
      </p>
      <section className={styles.sample}>
        <h2>Foundations</h2>
        <p>
          Colors, spacing, radii and font families/sizes are read directly from
          src/styles/global.css. The app and Storybook load the same fonts and styles. Local color
          literals and unresolved design decisions are listed separately, not silently turned into
          approved tokens.
        </p>
      </section>
      <section className={styles.sample}>
        <h2>Components and compositions</h2>
        <p>
          Stories live beside the real React components. Patterns show existing CSS compositions
          where a reusable component is missing. Screens show the actual AppShell, Review Exercises
          and routed Card/Collection pages, including their nested private components.
        </p>
      </section>
      <section className={styles.sample}>
        <h2>Inspect states</h2>
        <p>
          Use controls, named state stories and hover/pressed/focus examples. Selects, dialog
          closing, swipe and reveal examples are interactive. Fixed Exercise view stories are
          snapshots; they do not run a Review Session. Resize the canvas to compare narrow screens
          and desktop layouts.
        </p>
      </section>
      <section className={styles.sample}>
        <h2>Safe fixtures</h2>
        <p>
          All API requests are mocked with fictional data and a fresh query cache for each story. An
          audio Clip is a quiet generated test tone, not speech. Microphone and file picking are
          real browser capabilities and only run when you explicitly activate them. No database or
          AI key is required.
        </p>
      </section>
      <section className={styles.sample}>
        <h2>Review, don’t normalize</h2>
        <p>
          Foundations/Audit records inconsistent usage and missing primitives. The accessibility
          panel reports current findings. Existing design decisions need approval before changing
          the production app.
        </p>
      </section>
    </main>
  ),
};
