import type { Meta, StoryObj } from "@storybook/react";

import { Badge } from "@/components/ui/badge";
import { ResponsiveTable, type ResponsiveTableColumn } from "./responsive-table";

interface SampleRow {
  id: string;
  name: string;
  role: string;
  status: "active" | "inactive";
  joined: string;
}

const sampleData: SampleRow[] = [
  { id: "1", name: "Kyuto", role: "Guild admin", status: "active", joined: "2024-07-12" },
  { id: "2", name: "Aruna", role: "Officer", status: "active", joined: "2024-05-03" },
  { id: "3", name: "Laena", role: "Member", status: "inactive", joined: "2023-11-19" },
];

const columns: ResponsiveTableColumn<SampleRow>[] = [
  { header: "Name", cell: (row) => row.name },
  { header: "Role", cell: (row) => row.role },
  {
    header: "Joined",
    cell: (row) => new Date(row.joined).toLocaleDateString(),
    stackedLabel: "Joined on",
    hideOnMobile: true,
  },
  {
    header: "Status",
    cell: (row) => (
      <Badge variant={row.status === "active" ? "success" : "secondary"}>
        {row.status.toUpperCase()}
      </Badge>
    ),
  },
];

const meta: Meta<typeof ResponsiveTable<SampleRow>> = {
  title: "Responsive/ResponsiveTable",
  component: ResponsiveTable,
  parameters: {
    layout: "padded",
  },
  render: (args) => <ResponsiveTable {...args} />,
};

export default meta;

type Story = StoryObj<typeof ResponsiveTable<SampleRow>>;

export const Default: Story = {
  args: {
    columns,
    data: sampleData,
    getRowId: (row) => row.id,
    emptyMessage: "No members yet.",
  },
};
