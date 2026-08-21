import type { ReactNode } from "react";
import styles from "./VisualCardFace.module.css";

/** Presentation seam for composing arbitrary text and media within either Card face. */
export function VisualCardFace({ children }: { children: ReactNode }) {
  return <div className={styles.content}>{children}</div>;
}
