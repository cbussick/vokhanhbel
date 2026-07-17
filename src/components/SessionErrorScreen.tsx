import { useTranslation } from "react-i18next";
import { useAuth } from "../state/AuthContext";
import { ErrorScreen } from "./ErrorScreen";

export function SessionErrorScreen() {
  const { t } = useTranslation();
  const auth = useAuth();

  return (
    <ErrorScreen
      actionLabel={t("common.retry")}
      message={t("errors.session")}
      onAction={() => void auth.retrySession()}
      title={t("errors.sessionTitle")}
    />
  );
}
