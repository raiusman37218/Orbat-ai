'use client';

import {
  deleteCustomReportAction,
  getAnalyticsStudioAction,
  saveCustomReportAction,
  type AnalyticsBreakdownRow,
  type AnalyticsKpi,
  type AnalyticsRangeDays,
  type AnalyticsSection,
  type AnalyticsSeriesPoint,
  type AnalyticsStudioBundle,
  type CustomReportRecord,
  type HeatmapCell,
} from '@/app/actions/analytics-studio';
import { useWorkspaceLive } from '@/lib/realtime/use-workspace-live';
import { downloadCsv } from './csv';

export type {
  AnalyticsBreakdownRow,
  AnalyticsKpi,
  AnalyticsRangeDays,
  AnalyticsSection,
  AnalyticsSeriesPoint,
  AnalyticsStudioBundle,
  CustomReportRecord,
  HeatmapCell,
};

export function getAnalyticsStudio(
  workspaceId: string,
  section: AnalyticsSection,
  rangeDays: AnalyticsRangeDays,
  comparePrevious: boolean,
) {
  return getAnalyticsStudioAction(workspaceId, section, rangeDays, comparePrevious);
}

export function saveCustomReport(
  workspaceId: string,
  input: Parameters<typeof saveCustomReportAction>[1],
) {
  return saveCustomReportAction(workspaceId, input);
}

export function deleteCustomReport(workspaceId: string, reportId: string) {
  return deleteCustomReportAction(workspaceId, reportId);
}

export function exportAnalyticsCsv(bundle: AnalyticsStudioBundle): void {
  const headers = [
    'Date',
    bundle.primarySeriesLabel,
    bundle.secondarySeriesLabel,
    ...(bundle.comparePrevious ? ['Previous period'] : []),
  ];
  const rows = bundle.series.map((pt) => [
    pt.date,
    pt.value,
    pt.secondaryValue,
    ...(bundle.comparePrevious ? [pt.previousValue] : []),
  ]);
  downloadCsv(`orbat-analytics-${bundle.section}-${bundle.rangeDays}d.csv`, headers, rows);
}

export function useAnalyticsLiveSync(
  workspaceId: string | null | undefined,
  onRefresh: () => void,
  enabled = true,
) {
  useWorkspaceLive({
    workspaceId,
    enabled,
    pollMs: 30_000,
    onRefresh,
  });
}
