import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { fn } from "storybook/test";
import { audio, options } from "../../storybook/fixtures";
import { MultipleChoiceOptions } from "./MultipleChoiceOptions";
const meta = {
  title: "Components/Review/MultipleChoiceOptions",
  component: MultipleChoiceOptions,
  tags: ["autodocs"],
  args: {
    options,
    resolved: false,
    language: "de-DE",
    disabled: false,
    audioUnavailable: false,
    onOptionAvailabilityChange: fn(),
    onChoose: fn(),
  },
} satisfies Meta<typeof MultipleChoiceOptions>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Question: Story = {};
export const WrongAttempt: Story = {
  args: { options: options.map((option, index) => ({ ...option, dead: index === 1 })) },
};
export const Resolved: Story = {
  args: {
    resolved: true,
    options: options.map((option, index) => ({
      ...option,
      dead: index === 1,
      revealedCorrect: index === 0,
    })),
  },
};
export const Disabled: Story = { args: { disabled: true } };
export const AudioOptions: Story = {
  args: { options: options.map((option) => ({ ...option, text: null, audio })) },
};
export const AudioUnavailable: Story = {
  ...AudioOptions,
  args: { ...AudioOptions.args, audioUnavailable: true },
};
export const Interactive: Story = {
  render: function Example(args) {
    const [items, setItems] = useState(args.options);
    const [resolved, setResolved] = useState(false);

    return (
      <MultipleChoiceOptions
        {...args}
        options={items}
        resolved={resolved}
        onChoose={(id) => {
          const correct = id === items[0]!.id;
          setItems(
            items.map((item) => ({
              ...item,
              dead: item.dead || (!correct && item.id === id),
              revealedCorrect: correct && item.id === id,
            })),
          );
          setResolved(correct);
        }}
      />
    );
  },
};
