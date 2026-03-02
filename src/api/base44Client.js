import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';

const { appId, token, functionsVersion, appBaseUrl } = appParams;

export const base44 = createClient({
  appId,
  token,
  functionsVersion,
  serverUrl: appBaseUrl,

  // ✅ IMPORTANTE:
  // permite páginas públicas (landing/login/register)
  requiresAuth: false
});