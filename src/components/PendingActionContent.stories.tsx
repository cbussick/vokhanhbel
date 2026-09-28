import type { Meta, StoryObj } from "@storybook/react-vite";
import { PendingActionContent } from "./PendingActionContent";
import styles from "./Dialog.module.css";
const meta = {
  title: "Components/PendingActionContent",
  component: PendingActionContent,
  tags: ["autodocs"],
  args: { pending: false, label: "Speichern", pendingLabel: "Wird gespeichert …" },
  render: (args) => (
    <div className={styles.actions}>
      <button
        type="button"
        className={styles.primary}
        disabled={args.pending}
        aria-busy={args.pending}
      >
        <PendingActionContent {...args} />
      </button>
    </div>
  ),
} satisfies Meta<typeof PendingActionContent>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Idle: Story = {};
export const Pending: Story = { args: { pending: true } };
export const LongLabel: Story = {
  args: { pending: true, pendingLabel: "Deine neue Sammlung wird gespeichert …" },
};
