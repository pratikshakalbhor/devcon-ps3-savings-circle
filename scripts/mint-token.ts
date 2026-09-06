import 'dotenv/config';
import { loadConfig } from '../lib/config';
import {
  createPublicClient,
  createWalletClient,
  http,
  parseUnits,
  type Address,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';

/**
 * Mints CONTRIBUTION_AMOUNT PS3 to each member address passed on the CLI.
 * The mint function is owner-gated, so the token contract's deployer key must
 * be set as DEPLOYER_KEY in env.
 *
 * Usage: npm run mint-token <member-address> [member-address...]
 */
function rpcUrl(): string {
  return process.env['RPC_URL'] ?? 'https://sepolia.base.org';
}

async function main() {
  const config = loadConfig();
  const memberAddresses = process.argv.slice(2);
  if (memberAddresses.length === 0) {
    throw new Error('Usage: npm run mint-token <member-address> [...more]');
  }

  const deployerKey = process.env['DEPLOYER_KEY'];
  if (!deployerKey) {
    throw new Error('Missing DEPLOYER_KEY in env (the token owner\'s private key).');
  }
  const account = privateKeyToAccount(deployerKey as `0x${string}`);
  const rpc = rpcUrl();
  const chain = baseSepolia;

  const walletClient = createWalletClient({
    account,
    chain,
    transport: http(rpc),
  });
  const publicClient = createPublicClient({ chain, transport: http(rpc) });

  const token = config.tokenAddress as Address;
  const amount = parseUnits(config.amountCeiling, 6); // 10.0 -> 10_000_000 units
  const abi = [
    {
      type: 'function',
      name: 'mint',
      stateMutability: 'nonpayable',
      inputs: [
        { name: 'to', type: 'address' },
        { name: 'amount', type: 'uint256' },
      ],
      outputs: [],
    },
    {
      type: 'function',
      name: 'balanceOf',
      stateMutability: 'view',
      inputs: [{ name: '', type: 'address' }],
      outputs: [{ name: '', type: 'uint256' }],
    },
  ] as const;

  console.log(`Minting ${config.amountCeiling} PS3 to ${memberAddresses.length} member(s)...`);
  for (const member of memberAddresses) {
    if (!/^0x[a-fA-F0-9]{40}$/.test(member)) {
      console.warn(`  skipping (not an EVM address): ${member}`);
      continue;
    }
    const memberAddress = member as Address;
    const hash = await walletClient.writeContract({
      address: token,
      abi,
      functionName: 'mint',
      args: [memberAddress, amount],
    });
    const balance = await publicClient.readContract({
      address: token,
      abi,
      functionName: 'balanceOf',
      args: [memberAddress],
    });
    console.log(`  ${memberAddress} mint tx ${hash} balance=${balance} units`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});