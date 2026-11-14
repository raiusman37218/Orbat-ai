import {
  getChannelsWorkspaceDataAction,
  getCommerceConnectionAction,
  saveAppIntegrationAction,
  saveCommerceConnectionAction,
  saveWidgetChannelSettingsAction,
  type ChannelsStudioBundle,
  type CommerceActionsState,
  type CommerceConnectionBundle,
  type IntegrationCategory,
  type MarketplaceAppItem,
} from '@/app/actions/channels-studio';
import {
  checkChannelNowAction,
  connectInstagramManualAction,
  connectTikTokAction,
  connectWhatsAppManualAction,
  disconnectChannelAction,
  sendChannelTestMessageAction,
  setXDmPollingAction,
  startInstagramConnectAction,
  startSocialConnectAction,
} from '@/app/actions/channels';
import {
  enableEmailChannelAction,
  saveEmailSettingsAction,
} from '@/app/actions/email-channel';

export type {
  ChannelsStudioBundle,
  CommerceActionsState,
  CommerceConnectionBundle,
  IntegrationCategory,
  MarketplaceAppItem,
};

export async function fetchChannelsWorkspace(workspaceId: string): Promise<ChannelsStudioBundle> {
  // TODO(backend): Shopify Admin API, HubSpot, Salesforce, Linear, and GitHub store OAuth status in
  // workspace_app_integrations until platform OAuth app client credentials are configured on the server.
  const res = await getChannelsWorkspaceDataAction(workspaceId);
  if (!res.success) {
    throw new Error(res.error);
  }
  return res.data;
}

export async function fetchCommerceConnection(workspaceId: string): Promise<CommerceConnectionBundle> {
  const res = await getCommerceConnectionAction(workspaceId);
  if (!res.success) {
    throw new Error(res.error);
  }
  return res.data;
}

export {
  checkChannelNowAction,
  connectInstagramManualAction,
  connectTikTokAction,
  connectWhatsAppManualAction,
  disconnectChannelAction,
  enableEmailChannelAction,
  saveAppIntegrationAction,
  saveCommerceConnectionAction,
  saveEmailSettingsAction,
  saveWidgetChannelSettingsAction,
  sendChannelTestMessageAction,
  setXDmPollingAction,
  startInstagramConnectAction,
  startSocialConnectAction,
};
