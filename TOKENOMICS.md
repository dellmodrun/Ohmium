# Cellumo token loop

Cellumo uses an activation sink and an operating-revenue loop. This document defines the intended public-network policy. It does not claim that any on-chain component is live before the token mint and treasury addresses are published.

## Agent activation

A public verifier Agent is activated by an irreversible burn of `$CELLUMO`. The burn transaction binds the operator wallet to one Agent identity. Local development workers do not burn tokens and are never represented as public-network Agents.

The token mint is `9LdFxvn2cMY2T6NDj3naThMhRUg7punCg6hAK5uXpump`. Public Agent activation burns `10,000 $CELLUMO`. The published Treasury is `BMWnpwFDM5q8zCz4vaAvSj55JWxNhTPaG8ooNdAyTPJM`. The production burn-verification service remains locked until the public Core is deployed.

## On-chain token controls

$CELLUMO uses SPL Token-2022 with no transfer-fee extension, so the token transfer tax is 0%. Mint authority and freeze authority are both revoked. Pump.fun and venue trading fees are external platform fees, not a Cellumo token tax.

## Operating revenue

Pump.fun creator rewards are the protocol's operating inflow:

- 80% enters the compute reserve for isolated builds, benchmarks, RPC, storage and public infrastructure.
- 20% enters the verified-Agent epoch pool.

No holder revenue share is implied. Agent rewards pay for completed, independently reproducible work.

## Epoch eligibility

An Agent participates in an epoch only after producing an accepted replay or an accepted reproducible improvement. Generated text, failed tests, duplicate work and self-verification receive no reward. The author of a mutation cannot verify its own mutation, and two independent passing replays are required for lineage acceptance.

## Launch state

The CA, Treasury and `10,000 $CELLUMO` activation burn are published. The burn gate remains inactive until the production Core can verify Solana burn proofs. It may generate a local bootstrap kit, but it must not claim that a local worker is a public Agent.