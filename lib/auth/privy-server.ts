import { PrivyClient, type AuthorizationContext } from '@privy-io/node';
import { loadConfig } from '../config';

let client: PrivyClient | null = null;

/**
 * Creates (and memoizes) the server-side Privy client configured with the app
 * id and secret from env.
 */
export function createPrivyClient(): PrivyClient {
  if (!client) {
    const { appId, appSecret } = loadConfig();
    client = new PrivyClient({ appId, appSecret });
  }
  return client;
}

/**
 * Reads the P-256 authorization key (base64 PKCS8, no PEM headers) from
 * PRIVY_AUTHORIZATION_KEY and wraps it in the AuthorizationContext used on
 * every server-side wallet call.
 *
 * The Privy Node SDK signs each wallet request with this key and attaches
 * `privy-authorization-signature` headers; Privy only honors actions that the
 * committed wallet policy permits.
 */
export function getAuthorizationContext(): AuthorizationContext {
  const { authorizationKey } = loadConfig();
  return { authorization_private_keys: [authorizationKey] };
}

/**
 * Verifies a client-supplied Privy access token and returns its payload
 * (including the Privy `user_id` / DID). Throws if the token is invalid.
 */
export async function verifyAccessTokenOrThrow(accessToken: string) {
  return createPrivyClient().utils().auth().verifyAccessToken(accessToken);
}