/**
 * Vendored slice of @sidera-protocol/sdk with the identical public surface
 * the app consumes. Present because this sandbox forbids git-dependency
 * fetches; once the published package (or `npm link`) is available, swap
 * `./sdk-shim` imports to `@sidera-protocol/sdk` and delete this file.
 *
 * Only the client-side pure logic lives here (memo parsing, name checks,
 * client construction). Network calls still go through stellar-sdk's RPC.
 */

export interface ParsedMemo {
  type: "id" | "text";
  value: string;
}

export interface ResolutionResult {
  name: string;
  fullName: string;
  address: string;
  memo: ParsedMemo | null;
  owner: string;
}

export class SideraError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "SideraError";
    this.code = code;
  }
}

/** Byte-aware memo parsing — mirrors the SDK's parseMemoHint exactly. */
export function parseMemoHint(raw: string | null | undefined): ParsedMemo | null {
  if (raw == null) return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  if (/^\d{1,20}$/.test(trimmed)) return { type: "id", value: trimmed };
  if (Buffer.byteLength(trimmed, "utf8") > 28) {
    return { type: "text", value: truncateUtf8(trimmed, 28) };
  }
  return { type: "text", value: trimmed };
}

function truncateUtf8(value: string, maxBytes: number): string {
  let out = "";
  let used = 0;
  for (const ch of value) {
    const size = Buffer.byteLength(ch, "utf8");
    if (used + size > maxBytes) break;
    out += ch;
    used += size;
  }
  return out;
}

export interface SideraClientConfig {
  contractId: string;
  network: "testnet" | "futurenet" | "mainnet";
  rpcUrl?: string;
}

/**
 * Thin live-mode client. Only what the app needs; the full-featured
 * version (write path, signer plumbing) lives in @sidera-protocol/sdk.
 */
export class SideraClient {
  private readonly contractId: string;

  constructor(config: SideraClientConfig) {
    if (!config.contractId.startsWith("C")) {
      throw new SideraError("InvalidConfig", "contractId must be a C... contract ID");
    }
    this.contractId = config.contractId;
  }

  /**
   * Live resolution via Soroban RPC. Kept in one place so the app has a
   * single seam to the network.
   */
  async resolve(name: string): Promise<ResolutionResult> {
    const stellar = await import("@stellar/stellar-sdk");
    const { rpc, Contract, Networks, TransactionBuilder, Account, xdr } = stellar;
    const rpcUrl =
      process.env.NEXT_PUBLIC_SIDERIA_RPC_URL ??
      (process.env.NEXT_PUBLIC_SIDERIA_NETWORK === "futurenet"
        ? "https://soroban-rpc.stellar.org"
        : "https://soroban-testnet.stellar.org");
    const server = new rpc.Server(rpcUrl, { allowHttp: rpcUrl.startsWith("http://") });

    const tx = new TransactionBuilder(
      // Simulation source is irrelevant to the result; a fixed dummy keeps
      // reads signer- and sequence-free.
      new Account("GCQENHS2BDU2BQG3TKPBOE7OF7AGU3XKJ4K7WGCVB7GGEP2POB2OJAKQ", "0"),
      { fee: "100", networkPassphrase: Networks.TESTNET },
    )
      .addOperation(new Contract(this.contractId).call("resolve", xdr.ScVal.scvString(name)))
      .setTimeout(30)
      .build();

    const sim = await server.simulateTransaction(tx);
    if ("error" in sim && sim.error != null) {
      throw new SideraError("Rpc", sim.error);
    }
    const retval = "result" in sim ? sim.result?.retval : undefined;
    if (retval == null) {
      throw new SideraError("NotFound", `Name "${name}" is not registered`);
    }
    return decodeResolution(retval, name);
  }

  /** Live owner-of-address listing — resolved off the mock in demo only. */
  async namesOfOwner(_owner: string): Promise<string[]> {
    // Requires the contract's enumerable listing tranche; until then the
    // live dashboard reads resolve() per known name (see sidera.ts).
    return [];
  }
}

function decodeResolution(v: unknown, name: string): ResolutionResult {
  // Narrow the decoded ScVal map into the Resolution shape.
  const record = v as { address?: string; owner?: string; memo?: string | null };
  if (record.address == null) {
    throw new SideraError("NotFound", `Name "${name}" is not registered`);
  }
  return {
    name,
    fullName: `${name}.sid`,
    address: record.address,
    owner: record.owner ?? "",
    memo: parseMemoHint(record.memo ?? null),
  };
}
