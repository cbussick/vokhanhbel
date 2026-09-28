import type { Meta, StoryObj } from "@storybook/react-vite";
import { tokensWith } from "./tokenInventory";
import styles from "./Foundations.module.css";
const meta = {
  title: "Foundations/Typography",
  parameters: { layout: "fullscreen" },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;
export const FamiliesAndScale: Story = {
  render: () => (
    <main className={styles.page}>
      <h1>Typography</h1>
      <p>
        Self-hosted Be Vietnam Pro for UI and Baloo 2 (800) for display, as specified in ADR-0010.
        Samples include German and Vietnamese diacritics.
      </p>
      {tokensWith("--font-").map(({ name, value }) => (
        <section className={styles.sample} key={name}>
          <h2 style={{ fontSize: "var(--font-sm)", fontFamily: "var(--font-ui)" }}>
            {name} · {value}
          </h2>
          <p
            lang="vi"
            style={
              name === "--font-ui" || name === "--font-display"
                ? {
                    fontFamily: `var(${name})`,
                    fontSize: "var(--font-2xl)",
                    fontWeight: name === "--font-display" ? 800 : 400,
                  }
                : { fontSize: `var(${name})` }
            }
          >
            Xin chào! Cảm ơn. Äpfel, Grüße &amp; Spaß.
          </p>
        </section>
      ))}
    </main>
  ),
};
export const ExistingWeights: Story = {
  render: () => (
    <main className={styles.page}>
      <h1>Loaded font weights</h1>
      <p>
        These are existing values, not yet named tokens. Line heights and weight roles still need a
        design decision.
      </p>
      {[400, 500, 600, 700, 800].map((weight) => (
        <p key={weight} style={{ fontWeight: weight, fontSize: "var(--font-xl)" }}>
          Be Vietnam Pro {weight} · Grüße und cảm ơn
        </p>
      ))}
      <p
        style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "var(--font-3xl)" }}
      >
        Baloo 2 800 · Weiter lernen
      </p>
    </main>
  ),
};
