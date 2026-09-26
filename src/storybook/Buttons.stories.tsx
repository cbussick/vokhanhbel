import type { Meta, StoryObj } from "@storybook/react-vite";
import { PendingActionContent } from "../components/PendingActionContent";
import dialog from "../components/Dialog.module.css";
import review from "../components/review/reviewSession.module.css";
import styles from "./Foundations.module.css";
const meta = {
  title: "Patterns/Existing buttons",
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "These are the app’s actual CSS compositions, not a new Button API. Their differences are deliberately preserved. See Foundations/Audit.",
      },
    },
  },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;
function DialogButtons({
  disabled = false,
  pending = false,
}: {
  disabled?: boolean;
  pending?: boolean;
}) {
  return (
    <div className={dialog.actions}>
      <button type="button" className={dialog.secondary} disabled={disabled}>
        Abbrechen
      </button>
      <button type="button" className={dialog.primary} disabled={disabled} aria-busy={pending}>
        <PendingActionContent
          pending={pending}
          label="Speichern"
          pendingLabel="Wird gespeichert …"
        />
      </button>
      <button type="button" className={dialog.danger} disabled={disabled} aria-busy={pending}>
        <PendingActionContent pending={pending} label="Löschen" pendingLabel="Wird gelöscht …" />
      </button>
    </div>
  );
}
export const DialogActions: Story = { render: () => <DialogButtons /> };
export const Disabled: Story = { render: () => <DialogButtons disabled /> };
export const Pending: Story = { render: () => <DialogButtons disabled pending /> };
export const Hover: Story = { ...DialogActions, globals: { pseudo: { hover: true } } };
export const Pressed: Story = { ...DialogActions, globals: { pseudo: { active: true } } };
export const KeyboardFocus: Story = {
  ...DialogActions,
  globals: { pseudo: { focusVisible: true } },
};
export const ReviewActions: Story = {
  render: () => (
    <div className={styles.page}>
      <button type="button" className={review.revealButton}>
        Antwort zeigen
      </button>
      <fieldset className={review.grades}>
        <legend>Wie gut konntest du dich erinnern?</legend>
        <button type="button">Vergessen</button>
        <button type="button">Fast gewusst</button>
        <button type="button">Gewusst</button>
      </fieldset>
    </div>
  ),
};
