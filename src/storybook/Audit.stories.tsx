import type { Meta, StoryObj } from "@storybook/react-vite";
import { findings } from "./audit";
import styles from "./Foundations.module.css";
const meta = { title: "Foundations/Audit", parameters: { layout: "fullscreen" } } satisfies Meta;
export default meta;
export const DecisionsNeeded: StoryObj<typeof meta> = {
  render: () => (
    <main className={styles.page}>
      <h1>Design decisions to review</h1>
      <p>
        VOK-32 documents the current app, not a redesign. These observations are flags for
        discussion, not approved changes. No existing component styles or token values were changed
        to hide differences.
      </p>
      {findings.map((finding) => (
        <section className={styles.sample} key={finding.title}>
          <h2>{finding.title}</h2>
          <p>{finding.observation}</p>
          <p>
            <strong>Decision needed: </strong>
            {finding.decision}
          </p>
          <small>{finding.sources}</small>
        </section>
      ))}
    </main>
  ),
};
