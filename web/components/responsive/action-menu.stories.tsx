import type { Meta, StoryObj } from "@storybook/react";
import { Trash2, Edit } from "lucide-react";

import { ActionMenu } from "./action-menu";

const meta: Meta<typeof ActionMenu> = {
  title: "Responsive/ActionMenu",
  component: ActionMenu,
  args: {
    ariaLabel: "Member actions",
    items: [
      { label: "Edit", icon: <Edit className="h-4 w-4" /> },
      {
        label: "Remove",
        icon: <Trash2 className="h-4 w-4" />,
        destructive: true,
      },
    ],
  },
};

export default meta;

type Story = StoryObj<typeof ActionMenu>;

export const Default: Story = {};
