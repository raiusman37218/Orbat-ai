import {
  getWidgetStudioBundleAction,
  saveWidgetStudioSettingsAction,
  type WidgetStudioBundle,
} from '@/app/actions/public-portal';
import type {
  WidgetColorMode,
  WidgetDesignId,
  WidgetIconChoice,
} from '@/lib/widget/launcher-icons';

export type { WidgetStudioBundle };

// TODO(backend): Add headless site-crawler verification to confirm `<script data-workspace>` is live on the customer's production domain.
export async function loadWidgetStudio(workspaceKey?: string | null): Promise<WidgetStudioBundle> {
  return getWidgetStudioBundleAction(workspaceKey);
}

export async function saveWidgetStudioSettings(
  workspaceId: string,
  patch: {
    brandColor?: string;
    secondaryColor?: string;
    widgetIcon?: WidgetIconChoice;
    widgetDesign?: WidgetDesignId;
    widgetColorMode?: WidgetColorMode;
    widgetPosition?: 'left' | 'right';
    greetingTitle?: string;
    greetingMessage?: string;
    showHelpTab?: boolean;
    helpCenterTabLabel?: string;
  },
) {
  return saveWidgetStudioSettingsAction(workspaceId, patch);
}
