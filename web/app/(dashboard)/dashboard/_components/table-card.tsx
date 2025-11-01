"use client";

import { ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface TableRowData {
  key: string;
  cells: ReactNode[];
}

interface TableCardProps {
  title: string;
  description: string;
  columns: string[];
  rows: TableRowData[];
  loading?: boolean;
  emptyMessage: string;
  skeletonHeight?: number;
}

export function TableCard({
  title,
  description,
  columns,
  rows,
  loading,
  emptyMessage,
  skeletonHeight = 40,
}: TableCardProps) {
  return (
    <Card className="rounded-3xl border border-border/50 bg-card/80 backdrop-blur">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="overflow-hidden rounded-3xl" style={{ height: skeletonHeight }}>
            <Skeleton className="h-full w-full" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {columns.map((column) => (
                    <TableHead key={column}>{column}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length > 0 ? (
                  rows.map((row) => (
                    <TableRow key={row.key}>
                      {row.cells.map((cell, index) => (
                        <TableCell key={index}>{cell}</TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={columns.length} className="text-center text-sm text-muted-foreground">
                      {emptyMessage}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
