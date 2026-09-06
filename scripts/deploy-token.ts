import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import solc from 'solc';
import {
  createPublicClient,
  createWalletClient,
  http,
  type Address,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';

/**
 * Deploys contracts/TestToken.sol to the env-configured chain (default Base
 * Sepolia) and prints the deployed address.
 *
 * Requires in .env:
 *   RPC_URL          (default https://sepolia.base.org)
 *   DEPLOYER_KEY     0x-hex EVM private key, funded with testnet ETH.
 *
 * Usage: npm run deploy-token [initialSupplyTokens=1000000]
 */
function rpcUrl(): string {
  return process.env['RPC_URL'] ?? 'https://sepolia.base.org';
}

function deployerAccount() {
  const key = process.env['DEPLOYER_KEY'];
  if (!key) {
    throw new Error(
      'Missing DEPLOYER_KEY in env (0x-hex private key of the funded deployer).',
    );
  }
  return privateKeyToAccount(key as `0x${string}`);
}

function compiledTestToken(): { abi: unknown[]; bytecode: `0x${string}` } {
  const source = readFileSync(resolve('contracts/TestToken.sol'), 'utf8');
  const input = {
    language: 'Solidity',
    sources: { 'TestToken.sol': { content: source } },
    settings: {
      optimizer: { enabled: true, runs: 200 },
      outputSelection: {
        '*': { '*': ['abi', 'evm.bytecode.object'] },
      },
    },
  };
  const output = JSON.parse(solc.compile(JSON.stringify(input))) as {
    contracts: Record<string, Record<string, { abi: unknown[]; evm: { bytecode: { object: string } } }>>;
    errors?: { severity: string; formattedMessage: string }[];
  };
  if (output.errors?.some((e) => e.severity === 'error')) {
    throw new Error(
      `Compilation failed:\n${output.errors
        .filter((e) => e.severity === 'error')
        .map((e) => e.formattedMessage)
        .join('\n')}`,
    );
  }
  const artifact = output.contracts['TestToken.sol']['TestToken'];
  return { abi: artifact.abi, bytecode: `0x${artifact.evm.bytecode.object}` };
}

async function main() {
  const initialSupplyTokens = Number(process.argv[2] ?? '1000000');
  const account = deployerAccount();
  const rpc = rpcUrl();
  const { abi, bytecode } = compiledTestToken();

  const walletClient = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http(rpc),
  });
  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(rpc),
  });

  console.log(`Deploying TestToken on ${baseSepolia.name} (${baseSepolia.id})...`);
  console.log(`  deployer:        ${account.address}`);
  console.log(`  initial supply:  ${initialSupplyTokens} PS3 (6-decimal)`);

  const hash = await walletClient.deployContract({
    abi,
    bytecode,
    args: [initialSupplyTokens],
  });
  console.log(`  deploy tx:       ${hash}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  const address = receipt.contractAddress as Address | undefined;
  if (!address) {
    throw new Error('Deployment succeeded but no contract address was returned.');
  }
  console.log(`  PS3 contract:    ${address}`);
  console.log('\nSet CONTRIBUTION_TOKEN_ADDRESS to the address above and');
  console.log("mint member balances with: npm run mint-token <address> [...addresses]");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});