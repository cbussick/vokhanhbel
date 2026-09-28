import { useTranslation } from "react-i18next";
import type { Collection } from "../contracts/collection";
import { AddIcon } from "./AddIcon";
import { CollectionIcon } from "./CollectionIcon";
import { Select } from "./Select";

export function CollectionSelect({
  collections,
  onCreate,
  ...props
}: {
  id: string;
  collections: readonly Collection[];
  value: string;
  onChange: (collectionId: string) => void;
  onCreate?: () => void;
  required?: boolean;
  disabled?: boolean;
}) {
  const { t } = useTranslation();

  return (
    <Select
      {...props}
      options={collections.map((collection) => ({
        value: collection.id,
        label: collection.name,
        icon: <CollectionIcon icon={collection.icon} size="compact" />,
      }))}
      {...(onCreate
        ? { action: { label: t("collections.create"), icon: <AddIcon />, onSelect: onCreate } }
        : {})}
    />
  );
}
