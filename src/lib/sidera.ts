/**
 * Sidera provider layer.
 *
 * `NEXT_PUBLIC_SIDERIA_CONTRACT_ID` set  → resolves through the real
 *   registry via @sidera-protocol/sdk (Soroban RPC reads).
 * Contract ID empty (default) → demo mode backed by an in-memory mock
 *   registry, so the UI is fully explorable before deployment.
 *
 * NOTE: the github-hosted SDK dependency is commented out in package.json
 * because this sandbox disables git-package fetches. The SDK is vendored in
 * `src/lib/sdk-shim.ts` with the identical API surface; re-enable the
 * dependency and swap the import to `@sidera-protocol/sdk` once built
 * locally (`npm pack`/`npm link`) or when git deps are permitted.
 */

import type { ParsedMemo } from "./sdk-shim";
import { DEMO_OWNER, MOCK_REGISTRY } from "./mock-registry";

export { DEMO_OWNER };

export interface NameRecordView {
  name: string;
  fullName: string;
  owner: string;
  address: string;
  memo: ParsedMemo | null;
  /** Where the record came from — surfaced in the UI. */
  source: "demo" | "chain";
  /** Mock-only: available names report no record yet. */
  available: boolean;
}

export type LookupResult =
  | { status: "found"; record: NameRecordView }
  | { status: "available"; name: string; fullName: string; source: "demo" | "chain" }
  | { status: "invalid"; name: string; reason: string };

const CONTRACT_ID = process.env.NEXT_PUBLIC_SIDERIA_CONTRACT_ID ?? "";
export const DEMO_MODE = CONTRACT_ID.length === 0;

const NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Client-side validation mirroring the contract's rules. */
export function checkName(raw: string): { ok: true; name: string } | { ok: false; reason: string } {
  const name = raw.trim().toLowerCase().replace(/\.sid$/, "");
  if (name.length < 3) return { ok: false, reason: "at least 3 characters" };
  if (name.length > 32) return { ok: false, reason: "at most 32 characters" };
  if (!NAME_RE.test(name)) {
    return { ok: false, reason: "only a–z, 0–9 and inner hyphens" };
  }
  return { ok: true, name };
}

/** Look up a name; returns a typed union the UI renders directly. */
export async function lookupName(raw: string): Promise<LookupResult> {
  const check = checkName(raw);
  if (!check.ok) {
    return { status: "invalid", name: raw, reason: check.reason };
  }
  const { name } = check;

  if (DEMO_MODE) {
    const hit = MOCK_REGISTRY[name];
    if (hit == null) {
      return { status: "available", name, fullName: `${name}.sid`, source: "demo" };
    }
    return { status: "found", record: { name, fullName: `${name}.sid`, ...hit, source: "demo", available: false } };
  }

  // Live path via the real SDK (swap import once the git dep is enabled).
  const { SideraClient } = await import("./sdk-shim");
  const client = new SideraClient({
    contractId: CONTRACT_ID,
    network: (process.env.NEXT_PUBLIC_SIDERIA_NETWORK as "testnet" | "futurenet") ?? "testnet",
  });
  try {
    const res = await client.resolve(name);
    return {
      status: "found",
      record: {
        name: res.name,
        fullName: res.fullName,
        owner: res.owner,
        address: res.address,
        memo: res.memo,
        source: "chain",
        available: false,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/not registered|NotFound/i.test(message)) {
      return { status: "available", name, fullName: `${name}.sid`, source: "chain" };
    }
    throw err;
  }
}

/** Names owned by an address. Demo mode filters the mock registry. */
export async function namesOwnedBy(owner: string): Promise<NameRecordView[]> {
  if (DEMO_MODE) {
    return Object.entries(MOCK_REGISTRY)
      .filter(([, rec]) => rec.owner.toLowerCase() === owner.toLowerCase())
      .map(([name, rec]) => ({
        name,
        fullName: `${name}.sid`,
        owner: rec.owner,
        address: rec.address,
        memo: rec.memo,
        source: "demo" as const,
        available: false,
      }));
  }

  const { SideraClient } = await import("./sdk-shim");
  const client = new SideraClient({
    contractId: CONTRACT_ID,
    network: (process.env.NEXT_PUBLIC_SIDERIA_NETWORK as "testnet" | "futurenet") ?? "testnet",
  });
  const owned: string[] = await client.namesOfOwner(owner);
  return Promise.all(
    owned.map(async (name) => {
      const res = await client.resolve(name);
      return {
        name: res.name,
        fullName: res.fullName,
        owner: res.owner,
        address: res.address,
        memo: res.memo,
        source: "chain" as const,
        available: false,
      };
    }),
  );
}
