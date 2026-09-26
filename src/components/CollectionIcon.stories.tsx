import type { Meta, StoryObj } from "@storybook/react-vite";
import { collectionIconKeys } from "../contracts/collection";
import { CollectionIcon } from "./CollectionIcon";
import styles from "../storybook/Foundations.module.css";
const meta = {
  title: "Components/CollectionIcon",
  component: CollectionIcon,
  tags: ["autodocs"],
  args: { icon: "book" },
  argTypes: { icon: { control: "select", options: collectionIconKeys } },
} satisfies Meta<typeof CollectionIcon>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const AllIconsAndSizes: Story = {
  render: () => (
    <div className={styles.grid}>
      {collectionIconKeys.map((icon) => (
        <section key={icon} className={styles.sample}>
          <h2>{icon}</h2>
          <div className={styles.row}>
            {(["compact", "default", "large"] as const).map((size) => (
              <CollectionIcon key={size} icon={icon} size={size} />
            ))}
          </div>
        </section>
      ))}
    </div>
  ),
};
