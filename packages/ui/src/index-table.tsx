import * as React from "react";
import { cn } from "./lib/cn";

export type IndexColumn<T> = {
  key: string;
  header: string;
  className?: string;
  cell: (row: T) => React.ReactNode;
};

export function IndexTable<T extends { id: string }>({
  columns,
  rows,
  empty,
  onRowClick,
  className,
}: {
  columns: IndexColumn<T>[];
  rows: T[];
  empty?: React.ReactNode;
  onRowClick?: (row: T) => void;
  className?: string;
}) {
  if (rows.length === 0) {
    return <>{empty}</>;
  }

  return (
    <div
      className={cn(
        "overflow-x-auto rounded-[var(--ds-radius-md)] border border-[var(--ds-border-subdued)] bg-[var(--ds-surface)]",
        className,
      )}
    >
      <table className="w-full min-w-[640px] border-collapse text-left text-[14px]">
        <thead>
          <tr className="border-b border-[var(--ds-border-subdued)] bg-[var(--ds-bg)]">
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn(
                  "px-4 py-3 text-[12px] font-medium uppercase tracking-wide text-[var(--ds-text-secondary)]",
                  col.className,
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              className={cn(
                "border-b border-[var(--ds-border-subdued)] last:border-0",
                onRowClick && "cursor-pointer hover:bg-[var(--ds-bg)]",
              )}
              onClick={() => onRowClick?.(row)}
            >
              {columns.map((col) => (
                <td key={col.key} className={cn("px-4 py-3 align-middle", col.className)}>
                  {col.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
