import type { Meta, StoryObj } from "@storybook/react-vite";
import { tokensWith } from "./tokenInventory";
import styles from "./Foundations.module.css";
const meta = { title: "Foundations/Spacing", parameters: { layout: "fullscreen" } } satisfies Meta;
export default meta;
export const Scale: StoryObj<typeof meta> = {
  render: () => (
    <main className={styles.page}>
      <h1>Spacing</h1>
      <p>
        The app’s existing rem scale. Use --space-* for padding, margins and gaps; control sizes and
        breakpoints are not automatically spacing tokens.
      </p>
      {tokensWith("--space-").map(({ name, value }) => (
        <section className={styles.sample} key={name}>
          <h2 style={{ fontSize: "var(--font-md)" }}>
            {name} · {value}
          </h2>
          <div className={styles.bar} style={{ inlineSize: `var(${name})` }} />
        </section>
      ))}
    </main>
  ),
};
