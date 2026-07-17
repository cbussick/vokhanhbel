import { useEffect, useState } from "react";
import styles from "./DelayedSkeleton.module.css";

export function DelayedSkeleton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(true), 200);

    return () => window.clearTimeout(timer);
  }, []);

  return visible ? (
    <div className={styles.stack} aria-hidden="true">
      <span />
      <span />
      <span />
    </div>
  ) : null;
}
