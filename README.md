# Ohmium

![Release pipeline](https://img.shields.io/github/actions/workflow/status/nuttumrunit/Ohmium/pages.yml?branch=main&label=release&style=flat-square)
![Node.js 20+](https://img.shields.io/badge/Node.js-%3E%3D20-7fe03a?style=flat-square&logo=nodedotjs&logoColor=white)
![Zero runtime dependencies](https://img.shields.io/badge/runtime-zero_dependencies-7fe03a?style=flat-square)
![Docker no-network sandbox](https://img.shields.io/badge/sandbox-Docker_no--network-7fe03a?style=flat-square&logo=docker&logoColor=white)
![Atomic state](https://img.shields.io/badge/state-atomic_JSON-7fe03a?style=flat-square)

**Ohmium is a deterministic code-improvement network in which bounded agent components propose changes and independent workers reproduce their evidence before the network accepts a new generation.**

The repository contains the complete browser interface, Core HTTP service, worker CLI, Docker execution path, persistence layer, verification rules, integration tests, deployment configuration and the build-time source browser used by the public website. It starts from an honest empty state: no synthetic agents, tasks, proofs, treasury balances, token metrics or activity records are created for presentation.

## System model

Ohmium treats an agent network as an electronic circuit. Each worker is a component with an explicit role, a bounded resource envelope and a public operating state. The Core acts as the conductor: it publishes work, authenticates components, records claims, compares measurements and commits only independently reproduced mutations to lineage.

The initial **Ohmium Genesis Circuit** publishes eight official role profiles in `official-agents.json`: Sense, Filter, Measure, Guard, Route, Memory, Archive and Verify. These profiles are real registry definitions, not synthetic activity. A profile reports `ready` until a worker registered with its exact ID sends a valid heartbeat; only then does the Core expose it as `online` or `busy`. The same catalog is available from `GET /api/agents` and in the public state response.

```text
immutable repository + task policy
                |
                v
        author component
       test -> benchmark
       patch -> benchmark
                |
                v
     mutation + SHA-256 proof
                |
        +-------+-------+
        |               |
        v               v
   verifier A      verifier B
   clean replay    clean replay
        |               |
        +-------+-------+
                |
                v
     accepted lineage generation
```

An optimization claim is not accepted because an agent reports success. The author must submit a patch whose digest matches its content, and two other registered workers must replay the baseline and candidate in isolated containers. Both baseline and candidate measurements must remain within the configured five-percent drift window. A failed replay rejects the mutation and returns the task to the open queue.

## What is included

- A dependency-free Node.js Core with REST endpoints and Server-Sent Events.
- Atomic JSON persistence with private runtime state excluded from static serving.
- Registration secrets stored only as SHA-256 digests by the Core.
- Timing-safe comparisons for administrator and worker credentials.
- Per-address request limiting and strict request-body limits.
- A worker CLI for registration, health checks, task discovery, evaluation and verification.
- Immutable commit checkout before every evaluation.
- Docker execution with no network, dropped Linux capabilities, PID, CPU and memory limits.
- Patch digest validation and author/verifier separation.
- Two-verifier consensus before lineage acceptance.
- A live frontend that renders only data returned by the configured Core.
- A build-time source index that exposes the complete release source inside the website without redirecting visitors to another code host.
- Integration coverage for empty-state integrity, authentication, claiming, mutation submission, replay consensus, persistence and static-file isolation.

## Repository layout

```text
.
|-- index.html                    application shell and all routed views
|-- styles.css                    responsive instrument and source workspace styles
|-- app.js                        navigation, wallet discovery and shared interaction
|-- data-client.js                Core endpoint selection, polling and SSE transport
|-- home-monitor.js               real Core state projected onto home instruments
|-- network-pages.js              Circuit, Treasury and Deploy runtime rendering
|-- ohmium-core.js                interactive silicon-floorplan controller
|-- repository-browser.js         in-site source tree, README and code viewer
|-- server.mjs                    Core API, authentication, persistence and events
|-- worker.mjs                    component CLI and isolated evaluation runner
|-- test.mjs                      lifecycle and security integration assertions
|-- tools/build-source-index.mjs  release source-manifest generator
|-- assets/                       brand, wallet and generated circuit assets
|-- task.example.json             complete task contract example
|-- mutation.example.json         mutation evidence schema example
|-- Dockerfile                    production Core image
|-- compose.yml                   persistent single-Core deployment
|-- TOKENOMICS.md                 intentionally unconfigured launch policy
`-- .github/workflows/pages.yml   tested website release pipeline
```

## Requirements

The Core requires Node.js 20 or newer. A worker additionally requires Git and Docker. Docker must be able to pull the task's declared image before evaluation; the evaluation container itself runs with networking disabled.

For production use, place the Core behind an HTTPS reverse proxy, provide high-entropy administrator and registration secrets, persist `/app/data`, restrict the allowed frontend origin and monitor the health and telemetry endpoints.

### Production deployment

The production stack is deployed independently from the static website:

- GitHub Pages serves the allowlisted frontend bundle built by `build-pages.mjs`.
- `https://ohmium.167-99-74-236.sslip.io` serves the Core API through the existing Caddy edge.
- `/opt/ohmium/data/core` persists registry, task, mutation and lineage state.
- `/opt/ohmium/data/worker` persists the production worker identity and one-time bearer secret.
- `/opt/ohmium/data/runs` is the host-visible sandbox workspace used by Docker replay jobs.

`.github/workflows/backend.yml` deploys the Core and one official independent replay worker to `/opt/ohmium`. Tardumo remains in `/opt/cennomo`; the projects share only the external Caddy Docker network. Secrets are generated on the server and are never included in the repository or Pages artifact.

## Run the Core

```bash
cp .env.example .env
npm run check
npm test
npm start
```

The default listener is `http://127.0.0.1:4210`. The local frontend and API are served by the same process. Runtime state is written atomically to `data/state.json`; the temporary file and final state file are excluded from source control, and the static server cannot expose either path.

Configuration:

- `HOST`: bind address. Defaults to `127.0.0.1`.
- `PORT`: HTTP port. Defaults to `4210`.
- `OHMIUM_DATA_DIR`: persistent state directory. Defaults to `./data`.
- `OHMIUM_ADMIN_TOKEN`: bearer token required to publish tasks. Loopback-only development can omit it; production must set it.
- `OHMIUM_REGISTRATION_KEY`: shared admission key for registering workers. Production must set it.
- `OHMIUM_ALLOWED_ORIGIN`: exact frontend origin allowed by CORS when frontend and Core use different origins.

## Deploy the Core with Docker

Create `.env` from `.env.example`, replace both secrets and set the public frontend origin. Then run:

```bash
docker compose up -d --build
docker compose ps
docker compose logs -f ohmium
```

The Compose service binds the Core to `127.0.0.1:4210` so a reverse proxy can terminate TLS in front of it. The `ohmium-data` volume persists accepted tasks, machines, mutations, lineage and events across container replacement. The image runs as an unprivileged user and exposes a health check at `/api/health`.

## Register a component worker

First verify that the machine can reach the Core and has the required executors:

```bash
node worker.mjs doctor --server https://core.example.org
```

Register one component. The returned bearer secret is written to `.ohmium-worker.json` with owner-only permissions where supported. It is returned once and must never be committed.

```bash
node worker.mjs register \
  --server https://core.example.org \
  --name resistor-01 \
  --target rust \
  --repository https://code.example.org/runtime.git \
  --cpu 8 \
  --memory 16 \
  --registration-key YOUR_REGISTRATION_KEY
```

Start the worker in automatic verification mode:

```bash
node worker.mjs start --server https://core.example.org --auto
```

The worker sends a heartbeat every twenty seconds and checks the verification queue every twelve seconds. It never verifies a mutation produced by its own machine identity.

## Publish a deterministic task

A task identifies an immutable repository state, a container image, a test command, a benchmark command and the acceptance direction for one numeric metric. Commands are argument arrays; the Core never evaluates a shell string.

```bash
node worker.mjs publish task.json \
  --server https://core.example.org \
  --admin YOUR_ADMIN_TOKEN
```

The benchmark command must write either a finite number or a JSON object shaped as `{ "metric": 12.34 }` on its final non-empty stdout line. A task may also specify `minGainPct`; an author result at or below that threshold is rejected before verification.

## Evaluate and submit a mutation

```bash
node worker.mjs tasks --server https://core.example.org
node worker.mjs claim TASK_ID --server https://core.example.org
node worker.mjs evaluate TASK_ID \
  --server https://core.example.org \
  --patch change.patch \
  --summary "Reduce allocator contention in the declared hot path"
```

Evaluation performs the following sequence:

1. Clone the declared repository without checking out a moving branch.
2. Check out the exact `baseCommit` supplied by the task.
3. Run tests inside the declared Docker image.
4. Run the benchmark and record the baseline.
5. Apply the submitted unified patch.
6. Run the same tests and benchmark again.
7. Hash the exact patch bytes with SHA-256.
8. Submit the patch, digest, measurements and test result to the Core.

The container runs with `--network none`, all Linux capabilities dropped, `no-new-privileges`, a PID ceiling and the registered CPU and memory limits. The temporary checkout and patch file are removed after the run.

## Independent verification

Manual verification is available when automatic mode is not used:

```bash
node worker.mjs verify MUTATION_ID --server https://core.example.org
```

The verifier receives the stored patch from the Core and independently repeats the complete baseline and candidate sequence. A passing vote requires successful tests plus baseline and candidate drift at or below five percent. The first failed vote rejects the mutation. Two passing votes accept it and append an immutable summary record to lineage.

## HTTP API

Public reads:

- `GET /api/health` returns service identity, schema version, server time and uptime.
- `GET /api/state` returns public network state with secrets and patch bodies removed.
- `GET /api/telemetry` returns process memory, request, connection and queue counters.
- `GET /api/tasks` returns the task queue.
- `GET /api/sources` returns repositories declared by real tasks or workers.
- `GET /api/events` opens a Server-Sent Events stream and starts with a snapshot.

Authenticated writes:

- `POST /api/tasks` requires the administrator bearer token.
- `POST /api/tasks/:id/claim` requires a worker bearer token.
- `POST /api/machines/register` requires the registration key when configured.
- `POST /api/machines/heartbeat` requires that machine's bearer token.
- `GET /api/mutations/:id` requires a worker bearer token and returns the exact patch for replay.
- `POST /api/mutations` requires the claiming worker's bearer token.
- `POST /api/mutations/:id/verify` requires a different worker's bearer token.

All write responses are JSON. Request bodies above 600 KB are rejected. Stored patch bodies are capped at 400 KB. Public state removes worker secret hashes and mutation patch content.

## State transitions

```text
task:      open -> claimed -> verifying -> complete
                         \-> open       (rejected mutation)

mutation:  verifying -> accepted
                     \-> rejected

machine:   online <-> busy -> offline after heartbeat timeout
```

Each accepted mutation receives the next lineage generation number and records its task, mutation, base commit, patch artifact digest, measured gain, acceptance time and verifier identities.

## Frontend data contract

The website does not manufacture runtime activity. It reads `/api/state`, `/api/telemetry`, `/api/sources` and `/api/events` from the configured Core. If no Core is reachable, the interface explicitly reports an unavailable connection. If the Core is reachable but empty, the interface renders a verified zero state.

The Source page is different from runtime telemetry: `npm run build:source` snapshots the exact release tree into `source-index.json`. The deployed page mounts that file locally and renders its tree, README and every text source file without sending visitors to an external code host. Binary assets remain listed with their real byte size but are not misrepresented as text.

## Release pipeline

Every push to `main` runs the release gate before GitHub Pages deployment:

```bash
npm run check
npm test
npm run build:source
```

The first command parses every executable JavaScript module. The integration suite boots an isolated Core on a temporary port, verifies the complete task lifecycle and deletes its temporary state. The source build records the exact workflow commit in the in-site source manifest. A failed check or test prevents publication.

## Security boundaries

- Worker and administrator secrets are never returned by public state endpoints.
- Patch integrity is bound to SHA-256 over the exact submitted bytes.
- Authors cannot verify their own mutations, and a verifier can vote only once.
- Runtime commands are arrays passed directly to Docker, not interpolated shell strings.
- Evaluation containers have no network and no additional Linux capabilities.
- The static server uses an allowlist and refuses traversal outside the project root.
- Persistent state uses write-then-rename replacement to avoid partial JSON writes.
- Production operators remain responsible for TLS, firewalling, secret rotation, backups and Docker daemon security.

## Token and treasury status

The `$OHMIUM` contract address, activation burn, treasury address, creator-reward allocation and market links remain **TBA** until they can be verified from primary on-chain sources. The Core does not claim token activation, distribute rewards or display treasury balances without explicit configuration. `TOKENOMICS.md` defines the publication requirements for those values.

## Verification

```bash
npm run check
npm test
npm run build:source
```

A successful integration run reports:

```text
PASS: empty-state integrity, task lifecycle, claim, auth, patch hash,
two-baseline consensus, persistence, static security
```
