import type { Meta, StoryObj } from "@storybook/react-vite";
import { tokensWith } from "./tokenInventory";
import styles from "./Foundations.module.css";
const meta = { title: "Foundations/Radii", parameters: { layout: "fullscreen" } } satisfies Meta;
export default meta;
export const Scale: StoryObj<typeof meta> = {
  render: () => (
    <main className={styles.page}>
      <h1>Corner radii</h1>
      <p>
        Existing global tokens. AudioPlayer uses --space-3 as a radius and the Card form uses a
        calculated inset radius. Those remain unchanged and are flagged in the audit.
      </p>
      <div className={styles.grid}>
        {tokensWith("--radius-").map(({ name, value }) => (
          <section className={styles.sample} key={name}>
            <div className={styles.radius} style={{ borderRadius: `var(${name})` }} />
            <h2 style={{ fontSize: "var(--font-md)" }}>{name}</h2>
            <code>{value}</code>
          </section>
        ))}
      </div>
    </main>
  ),
};
