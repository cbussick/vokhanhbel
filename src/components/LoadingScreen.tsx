import { useTranslation } from "react-i18next";
import styles from "./LoadingScreen.module.css";
import { TutopherAvatar } from "./TutopherAvatar";

export function LoadingScreen() {
  const { t } = useTranslation();

  return (
    <main className={styles.screen}>
      <TutopherAvatar />
      <p>{t("loading")}</p>
    </main>
  );
}
