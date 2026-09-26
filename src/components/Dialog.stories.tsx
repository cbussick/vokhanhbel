import type { Meta, StoryObj } from "@storybook/react-vite";
import { useRef, useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { Dialog } from "./Dialog";
import styles from "./Dialog.module.css";
function Example({
  busy = false,
  confirmation = false,
  long = false,
}: {
  busy?: boolean;
  confirmation?: boolean;
  long?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(true);
  const [confirming, setConfirming] = useState(confirmation);
  const close = () => {
    ref.current?.close();
    setOpen(false);
  };

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Dialog öffnen
      </button>
      {open && (
        <Dialog
          dialogRef={ref}
          titleId="example-title"
          title={confirming ? "Karte löschen?" : "Karte bearbeiten"}
          onClose={close}
          busy={busy}
          isConfirming={confirming}
          onDismissConfirmation={() => setConfirming(false)}
          footer={
            <div className={styles.actions}>
              <button type="button" disabled={busy} className={styles.secondary} onClick={close}>
                Abbrechen
              </button>
              <button
                type="button"
                disabled={busy}
                className={confirming ? styles.danger : styles.primary}
                onClick={close}
              >
                {confirming ? "Löschen" : "Speichern"}
              </button>
            </div>
          }
        >
          {confirming ? (
            <p>Diese Karte wird dauerhaft gelöscht. Deine bisherigen Punkte bleiben erhalten.</p>
          ) : (
            <>
              <label htmlFor="example-front">Vorderseite</label>
              <input id="example-front" defaultValue="xin chào" disabled={busy} />
            </>
          )}
          {long &&
            Array.from({ length: 15 }, (_, index) => (
              <p key={index}>
                Längerer Inhalt {index + 1}: cảm ơn – Danke. Der Dialogkörper scrollt, die Aktionen
                bleiben erreichbar.
              </p>
            ))}
        </Dialog>
      )}
    </>
  );
}
const meta = {
  title: "Components/Dialog",
  component: Example,
  parameters: { layout: "fullscreen" },
  args: { busy: false, confirmation: false, long: false },
} satisfies Meta<typeof Example>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Open: Story = {};
export const Busy: Story = { args: { busy: true } };
export const DestructiveConfirmation: Story = { args: { confirmation: true } };
export const ScrollingBody: Story = { args: { long: true } };
export const CloseButtonCloses: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(async () => {
      await expect(canvas.getByRole("dialog")).toBeVisible();
    });
    await userEvent.click(canvas.getByRole("button", { name: /Schließen|Zurück/ }));
    await expect(canvas.queryByRole("dialog")).not.toBeInTheDocument();
  },
};
