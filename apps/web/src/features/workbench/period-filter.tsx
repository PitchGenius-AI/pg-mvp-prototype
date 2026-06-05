import { Select } from '@mantine/core';
import { IconCalendarEvent } from '@tabler/icons-react';
import { PERIOD_LABELS, workbenchPeriods, type WorkbenchPeriod } from '../../lib/period';

interface PeriodFilterProps {
  value: WorkbenchPeriod;
  onChange: (period: WorkbenchPeriod) => void;
  counts: Record<WorkbenchPeriod, number>;
}

// The Workbench's top-level recency scope (daily-loop filter). A deal is "Today"
// when it was imported, created, or worked today. Each option carries its bucket
// count so the rep can see where their deals sit before switching. Scopes both
// Board and List; the List's stage/readiness filters run on top of the result.
export function PeriodFilter({ value, onChange, counts }: PeriodFilterProps) {
  return (
    <Select
      size="sm"
      w={190}
      leftSection={<IconCalendarEvent size={15} />}
      allowDeselect={false}
      checkIconPosition="right"
      value={value}
      onChange={(next) => {
        if (next) onChange(next as WorkbenchPeriod);
      }}
      data={workbenchPeriods.map((period) => ({
        value: period,
        label: `${PERIOD_LABELS[period]} (${counts[period]})`,
      }))}
    />
  );
}
