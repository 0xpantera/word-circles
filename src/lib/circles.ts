"use client";

import {
  isMiniappMode,
  onAppData,
  onWalletChange,
  sendTransactions,
  type Transaction,
} from "@aboutcircles/miniapp-sdk";
import { getAddress } from "viem";
import {
  encodeApprove,
  encodeGroupMint,
  encodeWrap,
  getErc20Balance,
  getPersonalCrcBalance,
  getTokenAvatar,
  HUB_ADDRESS,
  staticToDemurrage,
} from "./contract";

export { isMiniappMode };

export const CIRCLES_MINIAPP_URL =
  "https://circles.gnosis.io/miniapps/word-circles";

export function circlesProfileUrl(address: string): string {
  return `https://app.gnosis.io/${address}`;
}

export type WalletListener = (address: string | null) => void;

const listeners: Set<WalletListener> = new Set();
let currentAddress: string | null = null;
let initialized = false;
let sessionReported = false;
// Referrer forwarded by the Circles host via ?data= (see buildInviteUrl). The
// host posts app_data during the handshake, before the wallet propagates, so
// this is set by the time we report the first session.
let stashedReferrer: string | null = null;

function reportMiniappSession(wallet: string, referrer?: string) {
  fetch("/api/event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      wallet,
      kind: "miniapp_open",
      ...(referrer ? { referrer } : {}),
    }),
    keepalive: true,
  }).catch(() => {});
}

export function initCircles() {
  if (initialized) return;
  initialized = true;

  if (!isMiniappMode()) return;

  onAppData((data: string) => {
    try {
      stashedReferrer = getAddress(data);
    } catch {
      // malformed ?data= — ignore, treat the session as unreferred
    }
  });

  onWalletChange((address: string | null) => {
    try {
      currentAddress = address ? getAddress(address) : null;
    } catch {
      currentAddress = null;
    }
    if (currentAddress && !sessionReported) {
      sessionReported = true;
      // The referrer (if any) rides along on the session event; the server
      // attributes atomically and drops self-referrals.
      const referrer =
        stashedReferrer && stashedReferrer !== currentAddress
          ? stashedReferrer
          : undefined;
      reportMiniappSession(currentAddress, referrer);
    }
    listeners.forEach((fn) => fn(currentAddress));
  });
}

// Invite URL handed to other players: the Circles host forwards everything after
// ?data= to the embedded app via onAppData, so we stash the referrer there.
export function buildInviteUrl(referrer: string): string {
  return `${CIRCLES_MINIAPP_URL}?data=${referrer}`;
}

// Number of invite-driven new wallets attributed to `address`. Best-effort:
// returns 0 on any error so the stats tile degrades gracefully.
export async function getReferralCount(address: string): Promise<number> {
  try {
    const res = await fetch(
      `/api/referrals/count?address=${encodeURIComponent(address)}`,
    );
    if (!res.ok) return 0;
    const body: { count?: number } = await res.json();
    return body.count ?? 0;
  } catch {
    return 0;
  }
}

export function subscribeWallet(fn: WalletListener): () => void {
  listeners.add(fn);
  fn(currentAddress);
  return () => listeners.delete(fn);
}

export function getConnectedAddress(): string | null {
  return currentAddress;
}

export async function submitGameResult(
  contractAddress: string,
  calldata: string,
) {
  return sendTransactions([
    { to: contractAddress, data: calldata, value: "0x0" },
  ]);
}

// Thrown when the player can't be lifted into the stake token because their
// personal CRC balance is below the demurraged collateral the groupMint needs.
// Carries both amounts so the UI can show the shortfall in CRC units.
export class NoCirclesError extends Error {
  readonly available: bigint;
  readonly required: bigint;
  constructor(available: bigint, required: bigint) {
    super("no-circles");
    this.name = "NoCirclesError";
    this.available = available;
    this.required = required;
  }
}

export interface JoinPvpParams {
  escrow: string;
  token: string;
  approveData: string;
  joinData: string;
  // Player address and static stake. When provided and the player holds < stake
  // of the group token (s-gCRC), we prepend groupMint + wrap to mint it from their
  // personal CRC. Omit to skip the lift (assumes the player already holds enough).
  player?: string;
  stake?: bigint;
}

// Enter PvP matchmaking in a single batched submission. If the player lacks the
// stake token, the batch is [groupMint, wrap, approve, join]; otherwise just
// [approve, join] (join does safeTransferFrom, so approval must come first). The
// (group, type=1) wrapper is already deployed and equals `token`, so approve can
// target it directly without reading wrap()'s return value. The group avatar is
// read from the token itself (token.avatar()), so no extra config is needed. The
// escrow assigns the gameId on-chain; discover it afterwards via
// GET /api/games?player=<address>.
//
// Throws NoCirclesError if the player holds neither the stake token nor any
// personal CRC the group can mint — i.e. they can't play.
export async function joinPvpGame(params: JoinPvpParams) {
  const { escrow, token, approveData, joinData, player, stake } = params;

  const lift: Transaction[] = [];
  if (player && stake !== undefined) {
    const held = await getErc20Balance(token, player);
    if (held < stake) {
      // Need to mint the shortfall from personal CRC. The wrap math runs in
      // demurraged units, so check the player has at least that much before
      // building the batch — otherwise groupMint reverts silently (0x) in the
      // wallet and the user sees a generic failure.
      const group = await getTokenAvatar(token);
      const wrapAmount = await staticToDemurrage(token, stake);
      const personal = await getPersonalCrcBalance(player);
      if (personal < wrapAmount) {
        throw new NoCirclesError(personal, wrapAmount);
      }
      lift.push(
        {
          to: HUB_ADDRESS,
          data: encodeGroupMint(group, [player], [wrapAmount]),
          value: "0x0",
        },
        { to: HUB_ADDRESS, data: encodeWrap(group, wrapAmount), value: "0x0" },
      );
    }
  }

  return sendTransactions([
    ...lift,
    { to: token, data: approveData, value: "0x0" },
    { to: escrow, data: joinData, value: "0x0" },
  ]);
}

// Re-exported so call sites build the approve calldata without a second import.
export { encodeApprove };

export interface CirclesProfile {
  name: string;
  address: string;
  previewImageUrl: string | null;
}

const profileCache = new Map<string, CirclesProfile>();

const PROFILES_API = "https://rpc.aboutcircles.com/profiles/search/addresses";

export async function fetchCirclesProfiles(
  addresses: string[],
): Promise<Map<string, CirclesProfile>> {
  const uncached = addresses.filter((a) => !profileCache.has(a.toLowerCase()));
  if (uncached.length > 0) {
    try {
      const res = await fetch(PROFILES_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          addresses: uncached,
          fetchComplete: true,
        }),
      });
      if (res.ok) {
        const profiles: CirclesProfile[] = await res.json();
        for (const p of profiles) {
          profileCache.set(p.address.toLowerCase(), p);
        }
      }
    } catch {
      // profiles are best-effort; fall back to truncated addresses
    }
  }
  const result = new Map<string, CirclesProfile>();
  for (const a of addresses) {
    const cached = profileCache.get(a.toLowerCase());
    if (cached) result.set(a.toLowerCase(), cached);
  }
  return result;
}
