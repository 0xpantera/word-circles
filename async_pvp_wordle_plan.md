# Partially On-Chain Async PvP Wordle Game

## Overview

This project is a partially on-chain competitive Wordle-style game where two players compete asynchronously.

Players pay an entry fee to participate. The smart contract manages escrow, matchmaking, game settlement, payouts, refunds, and timeout logic. Gameplay and word validation occur off-chain through a backend service.

The design prioritizes:

- contract security
- backend integrity
- anti-cheat protections
- fairness in asynchronous play
- future decentralization of the WordMaster/backend role

---

# Core Game Rules

## Entry

- Each player pays `1 CRC` to enter a game.
- Total pot = `2 CRC`
- Winner receives `1.9 CRC`
- Remaining `0.1 CRC` is protocol rake/fees.

---

# Async Matchmaking Model

This is an **asynchronous PvP game**.

Players do not need to start at the same time.

Each player receives:

- the same secret word
- their own independent play window
- their own timer

The game compares final performance after both players finish or timeout.

---

# Game Lifecycle

## 1. Player Creates Game

Player calls:

```solidity
initiateGame()
```

Behavior:

- transfer `1 CRC` from player
- create new game if no waiting game exists
- assign caller as `player1`
- emit:

```solidity
NewGame(gameId, player1)
```

The backend listens for this event.

---

## 2. Word Commitment

Backend/WordMaster generates:

- random word index
- random salt

The backend commits:

```text
commitment = keccak256(gameId, wordIndex, salt)
```

The commitment is stored on-chain.

Example:

```solidity
commitWord(gameId, commitment)
```

This prevents the backend from changing the word later.

---

## 3. Player 1 Begins Playing

Player 1 may begin immediately after the word commitment exists.

Player 1's timer starts on first guess.

Contract/backend records:

```text
player1StartedAt
```

Player 1 gets:

- maximum guess count
- fixed play duration (example: 3 hours)

---

## 4. Player 2 Joins

Second player calls:

```solidity
initiateGame()
```

Behavior:

- transfer `1 CRC`
- assign as `player2`
- emit:

```solidity
SecondPlayerAdded(gameId, player2)
```

Player 2 receives the same word.

Player 2's timer starts on first guess.

---

## 5. Gameplay (Off-Chain)

Gameplay occurs entirely through the backend API.

Example endpoint:

```http
POST /games/:gameId/guess
```

Request:

```json
{
  "player": "0x...",
  "guess": "crane",
  "signature": "..."
}
```

The backend:

- validates signature
- validates word
- checks game status
- computes feedback
- records guess transcript

Response:

```json
{
  "greens": [true, false, false, true, false],
  "oranges": [false, true, false, false, false],
  "guessNumber": 3,
  "solved": false
}
```

---

# Guess Validation

Backend rejects:

- invalid dictionary words
- duplicate submissions
- expired games
- guesses after completion
- replayed requests

Frontend also contains a local word list for early validation.

---

# Player Results

A player result includes:

```text
- solved
- guessesUsed
- totalGreens
- totalOranges
- guessTranscriptHash
- timestamps
```

---

# Result Commitment

If a player finishes before the opponent:

The backend commits the result hash before revealing it.

Example:

```text
keccak256(
	gameId,
	player,
	solved,
	guessesUsed,
	greens,
	oranges,
	guessTranscriptHash,
	salt
)
```

This prevents backend manipulation after seeing the second player's outcome.

---

# Settlement Rules

## Winner Determination

Priority order:

1. Fewest guesses
2. Most greens
3. Most oranges

---

## Perfect Tie

If both players are identical on all metrics:

- split the pot
- each player receives `0.95 CRC`

Rationale:

- avoids arbitrary winner selection
- avoids latency disputes
- avoids backend favoritism

---

# Timeout Rules

## No Second Player

If no second player joins within 3 hours:

- Player 1 may reclaim funds.

---

## Player Timeout

Each player has an independent timer.

Example:

```text
3 hours from first guess
```

If:

- one player finishes
- the other player does not finish before timeout

Then:

- finishing player wins

even if they did not solve the word.

---

## Both Players Timeout

If neither player finishes:

Options:

### Option A (recommended)

- no payout
- protocol retains funds

### Option B

- partial refunds

Final economics TBD.

---

# Smart Contract Design

## Main Responsibilities

The contract handles:

- escrow
- matchmaking
- word commitments
- result commitments
- settlement
- payouts
- refunds
- timeout enforcement

The contract does NOT:

- validate guesses
- store gameplay
- compute Wordle logic

---

# Suggested Data Structures

## GameStatus

```solidity
enum GameStatus {
    WaitingForPlayer,
    Active,
    Completed,
    Refunded,
    Expired
}
```

---

## PlayerResult

```solidity
struct PlayerResult {
    bool submitted;
    bool solved;

    uint8 guessesUsed;

    uint16 greens;
    uint16 oranges;

    uint256 startedAt;
    uint256 finishedAt;
}
```

---

## Game

```solidity
struct Game {
    address player1;
    address player2;

    uint256 createdAt;

    uint256 player1StartedAt;
    uint256 player2StartedAt;

    bytes32 wordCommitment;

    bytes32 player1ResultCommitment;
    bytes32 player2ResultCommitment;

    PlayerResult result1;
    PlayerResult result2;

    GameStatus status;
}
```

---

# Backend Architecture

## Responsibilities

Backend handles:

- blockchain indexing
- random word generation
- word commitments
- gameplay APIs
- guess validation
- guess history
- result commitment
- result submission
- settlement automation

---

# Backend Components

## 1. Blockchain Indexer

Listens for:

- `NewGame`
- `SecondPlayerAdded`
- settlement events

Triggers backend workflows.

---

## 2. Word Service

Responsible for:

- random word selection
- commitment generation
- reveal generation

Future upgrade path:

- VRF integration
- decentralized oracle
- threshold signing

---

## 3. Gameplay API

Endpoints:

```text
POST /guess
GET /game-state
GET /remaining-words
```

---

## 4. Persistence Layer

Stores:

- guess transcripts
- timing data
- player metadata
- game state cache
- signed requests

---

# Frontend Requirements

## Mobile First

The frontend should:

- prioritize mobile UX
- minimize latency
- feel like traditional Wordle

---

# Frontend Features

## Gameplay Board

- green/orange/gray squares
- keyboard hints
- guess history

---

## Remaining Word Hints

Frontend computes/display:

```text
remaining valid words
```

based on prior guesses.

---

## Wallet Integration

- connect wallet
- sign gameplay requests
- join games
- claim winnings

---

# Security Priorities

## Contract Risks

Primary concerns:

- reentrancy
- double settlement
- incorrect timeout handling
- payout duplication
- unauthorized submissions
- stale waiting-game references

---

# Backend Risks

Primary concerns:

- backend changing the word
- result manipulation
- guess forgery
- replay attacks
- censorship
- backend downtime

---

# Required Security Features

## Signed Requests

All guesses should be wallet-signed.

Prevents:

- backend forging gameplay
- impersonation

---

## Commitment Schemes

Use commitments for:

- words
- player results

Prevents backend tampering.

---

## Replay Protection

Each gameplay request should include:

```text
- nonce
- timestamp
- signature
```

---

## Idempotent APIs

Guess endpoints should safely handle retries.

---

# Future Decentralization

Initial implementation may use:

- EOA
- Safe multisig

as WordMaster.

Future upgrades may include:

- VRF randomness
- decentralized committers
- zk-proof gameplay verification
- on-chain settlement proofs

---

# Development Roadmap

## Phase 1 — Specification

- finalize game rules
- finalize timeout behavior
- finalize settlement logic

---

## Phase 2 — Smart Contracts

Build:

- escrow
- matchmaking
- commitments
- settlement
- refunds

Add full test coverage.

---

## Phase 3 — Backend

Build:

- event indexer
- word service
- gameplay API
- persistence layer

---

## Phase 4 — Security Hardening

- audit contract flows
- fuzz testing
- replay protection
- load testing
- backend redundancy

---

## Phase 5 — Frontend

Build:

- mobile-first gameplay UI
- wallet UX
- match history
- hints system

---

# Critical Test Cases

## Contract Tests

- create game
- join game
- refund unpaired game
- settle normal win
- settle timeout win
- settle tie
- prevent double payout
- prevent unauthorized result submission
- timeout enforcement

---

## Backend Tests

- replay attack prevention
- invalid guess rejection
- commitment verification
- API idempotency
- backend restart recovery

---

# Open Questions

## Economics

- should both-timeout games burn funds or refund?
- should protocol rake always apply?

---

## Privacy

- should guess transcripts eventually become public?
- should games be permanently revealable?

---

## Anti-Cheat

- should timing speed matter?
- should there be rate limits on guesses?
- should players see opponent status during play?
