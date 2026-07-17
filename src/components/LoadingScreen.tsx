import { useTranslation } from "react-i18next";
import styles from "./LoadingScreen.module.css";
import { KhunhphapAvatar } from "./KhunhphapAvatar";

export function LoadingScreen() {
  const { t } = useTranslation();

  return (
    <main className={styles.screen}>
      <KhunhphapAvatar />
      <p>{t("loading")}</p>
    </main>
  );
}
