import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { fn } from "storybook/test";
import { tutorLimits } from "../contracts/tutor";
import type { TutorConversationMessage } from "../state/ReviewSessionContext";
import { card, tutorExercise } from "../storybook/fixtures";
import { TutorDialog } from "./TutorDialog";
const conversation: TutorConversationMessage[] = [
  { role: "user", content: "Wann sage ich xin chào?" },
  {
    role: "assistant",
    content:
      "Xin chào bedeutet Hallo. Du kannst es als freundliche Begrüßung verwenden. Achte auf die Tonzeichen: chào hat einen fallenden Ton.",
  },
];
const meta = {
  title: "Components/TutorDialog",
  component: TutorDialog,
  parameters: { layout: "fullscreen" },
  args: { card, exercise: tutorExercise, messages: [], updateMessages: fn(), onClose: fn() },
  render: function Example(args) {
    const [messages, setMessages] = useState(args.messages);

    return <TutorDialog {...args} messages={messages} updateMessages={setMessages} />;
  },
} satisfies Meta<typeof TutorDialog>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Empty: Story = {};
export const Conversation: Story = { args: { messages: conversation } };
export const LongConversation: Story = {
  args: { messages: Array.from({ length: 6 }, () => conversation).flat() },
};
export const ConversationLimit: Story = {
  args: {
    messages: Array.from(
      { length: tutorLimits.conversationMessageCeiling / 2 },
      () => conversation,
    ).flat(),
  },
};
