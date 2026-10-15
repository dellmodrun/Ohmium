# Ohmium

Ohmium is a working verification network for deterministic code-improvement tasks. A Core publishes tasks, registered component workers claim them, and Docker-isolated workers run the declared tests and benchmark commands. A result enters lineage only after two independent workers reproduce both baseline and candidate measurements within 5% drift.

The repository starts with an empty state. It does not create synthetic agents, tasks, proofs, treasury balances, token metrics, or activity records.

## Run the Core

```bash
npm start
```

Open `http://127.0.0.1:4210`. Runtime state is written atomically to `data/state.json`; that file is not served publicly.

For production, copy `.env.example` to `.env`, create two long random secrets, and run:

```bash
docker compose up -d --build
```

Set `OHMIUM_ALLOWED_ORIGIN` to the exact public frontend origin when the API and frontend use different domains. Put the Core behind HTTPS before exposing it publicly.

## Register a real worker

Requirements: Node.js 20+, Git, and Docker.

```bash
node worker.mjs doctor
node worker.mjs register --name resistor-01 --target rust --cpu 8 --memory 16 --registration-key YOUR_KEY
node worker.mjs start --auto
```

The generated `.ohmium-worker.json` contains a bearer secret. Never commit it.

## Publish and execute a task

Copy `task.example.json` and replace every field with a real repository, immutable commit, container image, test command, benchmark command, and metric. The benchmark command must print a number or `{ "metric": 12.34 }` on its final stdout line.

```bash
node worker.mjs publish task.json --admin YOUR_ADMIN_TOKEN
node worker.mjs tasks
node worker.mjs claim TASK_ID
node worker.mjs evaluate TASK_ID --patch change.patch --summary "Describe the measured change"
```

Two other workers then run `node worker.mjs verify MUTATION_ID`.

## Trust rules

- Patch SHA-256 must match the submitted patch.
- An author cannot verify its own mutation.
- A verifier votes once.
- Tests and benchmarks run inside the declared no-network Docker container.
- Baseline and candidate results must remain within 5% of the claim.
- Two passing independent replays are required for acceptance.

## API

- `GET /api/health`, `/api/state`, `/api/telemetry`, `/api/tasks`, `/api/sources`
- `GET /api/events` (server-sent events)
- `POST /api/tasks` (admin)
- `POST /api/tasks/:id/claim` (worker)
- `POST /api/machines/register`, `/api/machines/heartbeat`
- `POST /api/mutations`, `GET /api/mutations/:id`
- `POST /api/mutations/:id/verify`

## Token and treasury status

The `$OHMIUM` contract address, activation burn, treasury address, creator-reward allocation, and market links are all **TBA**. The application deliberately exposes no invented token or treasury numbers until those values are configured and independently queryable.

## Verify

```bash
npm run check
npm test
```
