import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';

const { appId, functionsVersion, appBaseUrl } = appParams;

export const base44 = createClient({
  appId,
  functionsVersion,
  appBaseUrl,
  requiresAuth: true
});