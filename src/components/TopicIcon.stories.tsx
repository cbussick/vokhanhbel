import type { Meta, StoryObj } from "@storybook/react-vite";
import { topicIconKeys } from "../contracts/topic";
import { TopicIcon } from "./TopicIcon";
import styles from "../storybook/Foundations.module.css";
const meta = {
  title: "Components/TopicIcon",
  component: TopicIcon,
  tags: ["autodocs"],
  args: { icon: "shapes" },
  argTypes: { icon: { control: "select", options: topicIconKeys } },
} satisfies Meta<typeof TopicIcon>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const AllIconsAndSizes: Story = {
  render: () => (
    <div className={styles.grid}>
      {topicIconKeys.map((icon) => (
        <section key={icon} className={styles.sample}>
          <h2>{icon}</h2>
          <div className={styles.row}>
            <TopicIcon icon={icon} />
            <TopicIcon icon={icon} size="compact" />
          </div>
        </section>
      ))}
    </div>
  ),
};
