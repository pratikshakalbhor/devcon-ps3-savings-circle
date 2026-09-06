export interface AppConfig {
  appId: string;
  appSecret: string;
  authorizationKey: string;
  signerId: string;
  tokenAddress: string;
  potRecipient: string;
  amountCeiling: string;
  expiryDays: number;
  chain: string;
  cronSecret: string;
}

export function requiredEnv(name: string, env: NodeJS.ProcessEnv): string {
  const value = env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function numberEnv(name: string, env: NodeJS.ProcessEnv, fallback: number): number {
  const raw = env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Environment variable ${name} must be a number, got: ${raw}`);
  }
  return parsed;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return {
    appId: requiredEnv('PRIVY_APP_ID', env),
    appSecret: requiredEnv('PRIVY_APP_SECRET', env),
    authorizationKey: requiredEnv('PRIVY_AUTHORIZATION_KEY', env),
    signerId: requiredEnv('SIGNER_ID', env),
    tokenAddress: requiredEnv('CONTRIBUTION_TOKEN_ADDRESS', env),
    potRecipient: requiredEnv('POT_RECIPIENT_ADDRESS', env),
    amountCeiling: requiredEnv('CONTRIBUTION_AMOUNT', env),
    expiryDays: numberEnv('CONTRIBUTION_EXPIRY_DAYS', env, 90),
    chain: env['CONTRIBUTION_CHAIN'] ?? 'base_sepolia',
    cronSecret: requiredEnv('CRON_SECRET', env),
  };
}

export interface GrantBounds {
  tokenAddress: string;
  potRecipient: string;
  amountCeiling: string;
  chain: string;
  expiresAt: number;
}

export function grantBounds(now: Date, config: AppConfig): GrantBounds {
  const expiresAt = now.getTime() + config.expiryDays * 24 * 60 * 60 * 1000;
  return {
    tokenAddress: config.tokenAddress,
    potRecipient: config.potRecipient,
    amountCeiling: config.amountCeiling,
    chain: config.chain,
    expiresAt: Math.floor(expiresAt / 1000),
  };
}