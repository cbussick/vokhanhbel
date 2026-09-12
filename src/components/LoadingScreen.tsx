import { useTranslation } from "react-i18next";
import { TutopherAvatar } from "./TutopherAvatar";
import styles from "./LoadingScreen.module.css";

export function LoadingScreen() {
  const { t } = useTranslation();

  return (
    <main className={styles.screen}>
      <div className={styles.avatar}>
        <TutopherAvatar />
      </div>
      <p className={styles.status} role="status">
        {t("loading")}
      </p>
    </main>
  );
}
