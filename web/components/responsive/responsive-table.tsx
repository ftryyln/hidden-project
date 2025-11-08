import { Fragment, type ReactNode } from "react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export interface ResponsiveTableColumn<T> {
  header: string;
  cell: (row: T) => ReactNode;
  stackedLabel?: string;
  className?: string;
  hideOnMobile?: boolean;
}

export interface ResponsiveTableProps<T> {
  columns: ResponsiveTableColumn<T>[];
  data: T[];
  getRowId: (row: T, index: number) => string;
  emptyMessage?: string;
  renderMobileRowExtras?: (row: T) => ReactNode;
  className?: string;
}

export function ResponsiveTable<T>({
  columns,
  data,
  getRowId,
  emptyMessage,
  renderMobileRowExtras,
  className,
}: ResponsiveTableProps<T>) {
  if (data.length === 0 && emptyMessage) {
    return (
      <p className="text-sm text-muted-foreground" role="status">
        {emptyMessage}
      </p>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      <div className="hidden lg:block">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((column) => (
                <TableHead key={column.header} scope="col" className={column.className}>
                  {column.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row, index) => (
              <TableRow key={getRowId(row, index)}>
                {columns.map((column) => (
                  <TableCell key={column.header} className={column.className}>
                    {column.cell(row)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="space-y-3 lg:hidden">
        {data.map((row, index) => (
          <div
            key={getRowId(row, index)}
            className="rounded-2xl border border-border/50 bg-card/80 p-4 shadow-sm"
          >
            <dl className="grid grid-cols-1 gap-3">
              {columns
                .filter((column) => !column.hideOnMobile)
                .map((column) => (
                  <Fragment key={column.header}>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {column.stackedLabel ?? column.header}
                    </dt>
                    <dd className="text-sm font-medium">{column.cell(row)}</dd>
                  </Fragment>
                ))}
            </dl>
            {renderMobileRowExtras && (
              <div className="mt-3 flex justify-end">{renderMobileRowExtras(row)}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
