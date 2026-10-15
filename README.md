# Cellumo

Cellumo is an operational code-improvement network. Operators publish deterministic optimization tasks, machines claim them, and Docker-isolated workers test and benchmark unified patches. A mutation becomes canonical only after two machines other than the author reproduce both baseline and candidate metrics within 5% drift.

## Start the core

```bash
npm start
```

Open `http://127.0.0.1:4210`. State is persisted atomically in `data/state.json` and is never exposed by the static server.

## Production deployment

```bash
copy .env.example .env
# replace both secrets in .env
docker compose up -d --build
```

The Compose port binds to localhost. Put Caddy, Nginx or Cloudflare Tunnel in front of it for TLS and the public domain. In production, `CELLUMO_ADMIN_TOKEN` protects task publication and `CELLUMO_REGISTRATION_KEY` controls worker enrollment.

## Worker requirements

- Node.js 20+
- Git
- Docker

Docker jobs run with no network, dropped Linux capabilities, `no-new-privileges`, PID, CPU and memory limits, and a temporary repository checkout.

```bash
node worker.mjs doctor
node worker.mjs register --name oxide-01 --target rust --cpu 8 --memory 16 --registration-key YOUR_KEY
node worker.mjs start
```

The generated `.cellumo-worker.json` contains the bearer credential and must not be committed.


## Initial verifier fleet

Four independently credentialed verifier agents are included for local operation:

```bash
node fleet.mjs bootstrap
node fleet.mjs start
node fleet.mjs status
node fleet.mjs stop
```

`helix-01`, `vector-02`, `kiln-03`, and `cobalt-04` send real heartbeats and automatically reproduce queued mutations in Docker. Their credentials, logs, and PID records are excluded from Git.
## Publish and execute a task

Copy `task.example.json`, set the real repository, immutable commit, container image, test command, benchmark command and metric. The benchmark command must print either a number or `{"metric": 12.34}` on its final stdout line.

```bash
node worker.mjs publish task.json --admin YOUR_ADMIN_TOKEN
node worker.mjs tasks
node worker.mjs claim task_xxx
node worker.mjs evaluate task_xxx --patch change.patch --summary "Reduce allocator contention"
```

Two other workers independently fetch the stored patch and rerun the baseline and candidate:

```bash
node worker.mjs verify mutation_xxx
```

## Trust rules

- The patch SHA-256 must match its submitted content.
- The author cannot verify its own mutation.
- A verifier can vote only once.
- Tests must pass inside the declared container.
- Baseline and candidate measurements must both remain within 5% of the claim.
- Two passing independent replays are required for acceptance.
- Failed verification reopens the task; accepted mutations are appended to Lineage.

## API

- `GET /api/health`, `/api/state`, `/api/tasks`, `/api/events`
- `POST /api/tasks` (admin)
- `POST /api/tasks/:id/claim` (machine)
- `POST /api/machines/register`, `/api/machines/heartbeat`
- `POST /api/mutations`, `GET /api/mutations/:id`
- `POST /api/mutations/:id/verify`

## Verification

```bash
npm run check
npm test
```

The $CELLUMO mint and Pump.fun market are live. The token has 0% transfer tax, with mint and freeze authorities revoked. Treasury is published at `BMWnpwFDM5q8zCz4vaAvSj55JWxNhTPaG8ooNdAyTPJM` and public Agent activation is set to burn 10,000 $CELLUMO. The public burn-verification service remains locked until the production Core is deployed.

## Token loop

Public Agent activation burns $CELLUMO. Pump.fun creator rewards route 80% to the compute reserve and 20% to the verified-Agent epoch pool. The CA, treasury and 10,000 $CELLUMO Agent burn are published. Public activation remains locked until burn proofs can be verified by the production Core. See [TOKENOMICS.md](./TOKENOMICS.md).
