/**
 * Poseidon Merkle tree over the ANSWERS dictionary, matching the circuit's
 * membership check (leaf = poseidon2([l0..l4]); node = poseidon2([left,right]);
 * depth 12, zero-padded). Runtime module (uses bb.js via ./poseidon).
 *
 * The caller supplies the ordered `answers` list (the public Wordle answer set,
 * e.g. fetched from the pinned IPFS copy). The ordering defines leaf indices and
 * must be the exact list the on-chain DICT_ROOT was pinned to.
 */
import type { Hex } from "viem";
import { DICT_ROOT, wordToLetters } from "./encoding";
import { poseidon2, toHex32 } from "./poseidon";

export const DEPTH = 12; // 2^12 = 4096 >= 2315 answers

export async function leafOf(word: string): Promise<bigint> {
  return poseidon2(wordToLetters(word).map(BigInt));
}

/** Build all tree levels bottom-up. levels[0] = leaves, levels[DEPTH] = [root]. */
export async function buildTree(answers: string[]): Promise<bigint[][]> {
  const size = 1 << DEPTH;
  const leaves: bigint[] = [];
  for (const w of answers) leaves.push(await leafOf(w));
  while (leaves.length < size) leaves.push(0n);

  const levels: bigint[][] = [leaves];
  for (let d = 0; d < DEPTH; d++) {
    const cur = levels[d];
    const next: bigint[] = [];
    for (let i = 0; i < cur.length; i += 2) {
      next.push(await poseidon2([cur[i], cur[i + 1]]));
    }
    levels.push(next);
  }
  return levels;
}

export function rootOf(levels: bigint[][]): bigint {
  return levels[DEPTH][0];
}

/** Sibling path (length DEPTH) for the leaf at `index`. */
export function pathFor(levels: bigint[][], index: number): bigint[] {
  const siblings: bigint[] = [];
  let i = index;
  for (let d = 0; d < DEPTH; d++) {
    siblings.push(levels[d][i ^ 1]);
    i >>= 1;
  }
  return siblings;
}

export interface Membership {
  root: bigint;
  index: number;
  siblings: bigint[];
}

export interface DictionaryTree {
  levels: bigint[][];
  root: bigint;
  indexByWord: Map<string, number>;
}

const treeCache = new Map<string, Promise<DictionaryTree>>();

function cacheKey(answers: readonly string[]): string {
  return answers.join("\0");
}

async function buildDictionaryTree(
  answers: readonly string[],
): Promise<DictionaryTree> {
  const levels = await buildTree([...answers]);
  const indexByWord = new Map<string, number>();
  answers.forEach((word, index) => indexByWord.set(word.toLowerCase(), index));
  return { levels, root: rootOf(levels), indexByWord };
}

/** Build once per ordered answer list and reuse levels for later paths. */
export async function dictionaryTreeFor(
  answers: readonly string[],
): Promise<DictionaryTree> {
  const key = cacheKey(answers);
  let cached = treeCache.get(key);
  if (!cached) {
    cached = buildDictionaryTree(answers);
    treeCache.set(key, cached);
  }
  return cached;
}

export function assertDictionaryRoot(root: bigint, expected: Hex = DICT_ROOT) {
  const actual = toHex32(root);
  if (actual.toLowerCase() !== expected.toLowerCase()) {
    throw new Error(
      `answer list DICT_ROOT mismatch: expected ${expected}, got ${actual}`,
    );
  }
}

export interface MembershipOptions {
  /** Set to null to allow non-pinned trees in scripts/tests. Defaults to DICT_ROOT. */
  expectedRoot?: Hex | null;
}

/** Build/cache the tree and extract the membership proof for `word`. */
export async function membershipFor(
  answers: readonly string[],
  word: string,
  options: MembershipOptions = {},
): Promise<Membership> {
  const expectedRoot =
    options.expectedRoot === undefined ? DICT_ROOT : options.expectedRoot;
  const tree = await dictionaryTreeFor(answers);
  if (expectedRoot !== null) assertDictionaryRoot(tree.root, expectedRoot);

  const index = tree.indexByWord.get(word.toLowerCase()) ?? -1;
  if (index < 0) throw new Error(`"${word}" is not in the answer list`);
  return {
    root: tree.root,
    index,
    siblings: pathFor(tree.levels, index),
  };
}
