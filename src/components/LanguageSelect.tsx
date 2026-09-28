import { useTranslation } from "react-i18next";
import { collectionLanguages, offeredCollectionLanguage } from "../contracts/collection";
import { Select } from "./Select";

/**
 * The unset option is the stored null, not a locale standing in for "not a language". Offering it
 * in the list is what lets the Learner say a face has no language, so the field needs no separate
 * yes/no step.
 */
export function LanguageSelect({
  value,
  ...props
}: {
  id: string;
  describedBy?: string;
  value: string | null;
  onChange: (language: string | null) => void;
  disabled?: boolean;
  escapeClipping?: boolean;
}) {
  const { t } = useTranslation();
  const languages: (string | null)[] = [
    null,
    ...collectionLanguages,
    // A newer build may have declared this locale. Keep it selectable rather than rewriting it.
    ...(value !== null && !offeredCollectionLanguage(value) ? [value] : []),
  ];

  const label = (language: string | null) => {
    if (language === null) return t("collections.noLanguage");

    const offered = offeredCollectionLanguage(language);

    return offered ? t(`collections.languages.${offered}`) : language;
  };

  return (
    <Select
      {...props}
      value={value}
      options={languages.map((language) => ({ value: language, label: label(language) }))}
      keyboard="basic"
    />
  );
}
