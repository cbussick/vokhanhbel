import { useTranslation } from "react-i18next";
import { useAuth } from "../state/AuthContext";
import { ErrorScreen } from "./ErrorScreen";

export function SessionErrorScreen() {
  const { t } = useTranslation();
  const auth = useAuth();
  const message = auth.errorRequestId
    ? `${t("errors.session")} ${t("errors.reference", { requestId: auth.errorRequestId })}`
    : t("errors.session");

  return (
    <ErrorScreen
      actionLabel={t("common.retry")}
      message={message}
      onAction={() => void auth.retrySession()}
      title={t("errors.sessionTitle")}
    />
  );
}
