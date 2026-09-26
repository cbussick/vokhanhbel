import type { Meta, StoryObj } from "@storybook/react-vite";
import { localColors, tokensWith } from "./tokenInventory";
import styles from "./Foundations.module.css";

const meta = { title: "Foundations/Colors", parameters: { layout: "fullscreen" } } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Palette: Story = {
  render: () => (
    <main className={styles.page}>
      <h1>Colors in the app</h1>
      <p>
        Live swatches from src/styles/global.css. These are the existing semantic tokens, including
        derived hover surfaces. This catalog does not introduce a new palette.
      </p>
      <div className={styles.grid}>
        {tokensWith("--color-").map(({ name, value }) => (
          <section key={name} className={styles.sample}>
            <div className={styles.swatch} style={{ backgroundColor: `var(${name})` }} />
            <h2 style={{ fontFamily: "var(--font-ui)", fontSize: "var(--font-sm)" }}>{name}</h2>
            <code>{value}</code>
          </section>
        ))}
      </div>
    </main>
  ),
};
export const LocalColorsAndArtwork: Story = {
  render: () => (
    <main className={styles.page}>
      <h1>Colors outside the global tokens</h1>
      <p>
        Source-scanned CSS and inline SVG literals. Flags and mascot artwork are intentional artwork
        palettes, not UI status colors. White text, the modal scrim, and the neutral Grade
        background are candidates for semantic tokens; they have not been changed.
      </p>
      <div className={styles.grid}>
        {localColors
          .filter(({ value }) => !value.startsWith("color-mix("))
          .map(({ value, paths }) => (
            <section key={value} className={styles.sample}>
              <div className={styles.swatch} style={{ backgroundColor: value }} />
              <h2 style={{ fontSize: "var(--font-lg)" }}>{value}</h2>
              {paths.map((path) => (
                <small key={path}>{path}</small>
              ))}
            </section>
          ))}
      </div>
    </main>
  ),
};
export const DerivedSurfaces: Story = {
  render: () => (
    <main className={styles.page}>
      <h1>Component-local color mixes</h1>
      <p>
        These expressions are used in the app but do not yet have shared semantic names. Translucent
        samples are shown over the surface color. Context-dependent expressions are listed without
        an invented swatch; inspect their component stories for each pairing.
      </p>
      <div className={styles.grid}>
        {localColors
          .filter(({ value }) => value.startsWith("color-mix("))
          .map(({ value, paths, contextual }) => (
            <section key={value} className={styles.sample}>
              {contextual ? (
                <p>Context-dependent color</p>
              ) : (
                <div className={styles.swatch} style={{ backgroundColor: value }} />
              )}
              <code>{value}</code>
              {paths.map((path) => (
                <small key={path}>{path}</small>
              ))}
            </section>
          ))}
      </div>
    </main>
  ),
};
export const SemanticPairings: Story = {
  render: () => (
    <main className={styles.page}>
      <h1>Existing foreground / surface pairs</h1>
      <p>
        Inspect real pairings with the accessibility panel. Success uses dark text, not white.
        Disabled opacity and hover colors should be checked in their component stories too.
      </p>
      <div className={styles.grid}>
        {[
          ["Primary", "--color-primary", "--color-primary-text"],
          ["Surface", "--color-surface", "--color-text"],
          ["Secondary text", "--color-surface", "--color-text-secondary"],
          ["Warning", "--color-warning", "--color-warning-text"],
          ["Success", "--color-success", "--color-primary-text"],
          ["Danger (literal white foreground)", "--color-danger", "white"],
        ].map(([label, background, foreground]) => (
          <section
            key={label}
            className={styles.sample}
            style={{
              background: `var(${background})`,
              color: foreground === "white" ? "white" : `var(${foreground})`,
            }}
          >
            <h2>{label}</h2>
            <p>xin chào · Hallo · cảm ơn</p>
          </section>
        ))}
      </div>
    </main>
  ),
};
