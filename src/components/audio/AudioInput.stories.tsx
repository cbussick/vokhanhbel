import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { fn } from "storybook/test";
import { audio, generatedAudio } from "../../storybook/fixtures";
import { AudioInput } from "./AudioInput";
const meta = {
  title: "Components/Audio/AudioInput",
  component: AudioInput,
  args: {
    face: "front",
    draft: null,
    existing: null,
    existingRemoved: false,
    onDraftChange: fn(),
    onExistingRemovedChange: fn(),
  },
  render: function Example(args) {
    const [draft, setDraft] = useState(args.draft);
    const [removed, setRemoved] = useState(args.existingRemoved);

    return (
      <AudioInput
        {...args}
        draft={draft}
        existingRemoved={removed}
        onDraftChange={setDraft}
        onExistingRemovedChange={setRemoved}
      />
    );
  },
  parameters: {
    docs: {
      description: {
        component:
          "File picking and microphone recording use your browser only when explicitly activated. Generation is mocked. Existing Clips use the local test tone.",
      },
    },
  },
} satisfies Meta<typeof AudioInput>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Empty: Story = {};
export const Recording: Story = { args: { existing: audio } };
export const GeneratedClip: Story = {
  args: { existing: generatedAudio, pronunciation: { language: "vi-VN", faceText: "xin chào" } },
};
export const LegacyClip: Story = { args: { existing: { ...audio, source: null } } };
export const RemovedClip: Story = { args: { existing: audio, existingRemoved: true } };
export const StagedClip: Story = {
  args: { draft: { origin: "staged", metadata: generatedAudio } },
};
export const WithPronunciation: Story = {
  args: { pronunciation: { language: "vi-VN", faceText: "xin chào" } },
};
