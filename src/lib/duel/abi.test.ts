import { describe, expect, test } from "bun:test";
import { encodeSubmitFeedbackFromProof, encodeSubmitGuess } from "./abi";

const MATCH_ID =
  "0x1234567890abcdef000000000000000000000000000000000000000000000000";

describe("duel ABI helpers", () => {
  test("encodes a word string guess", () => {
    expect(encodeSubmitGuess(MATCH_ID, "crane")).toMatch(/^0x[0-9a-f]+$/);
  });

  test("rejects malformed guess arrays before ABI encoding", () => {
    expect(() => encodeSubmitGuess(MATCH_ID, [2, 17, 0, 13])).toThrow(
      /exactly 5/,
    );
    expect(() => encodeSubmitGuess(MATCH_ID, [2, 17, 0, 13, 26])).toThrow(
      /invalid guess letter/,
    );
  });

  test("encodes submitFeedback from proof bytes", () => {
    const calldata = encodeSubmitFeedbackFromProof(MATCH_ID, {
      feedback: 293,
      proof: new Uint8Array([1, 2, 3]),
    });
    expect(calldata).toMatch(/^0x[0-9a-f]+$/);
  });
});
