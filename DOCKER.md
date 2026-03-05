# d9 — Docker Setup

## Quick Start

```bash
# 1. Clone the repo
git clone https://github.com/LaWebcapsule/directus9.git
cd directus9

# 2. Copy and edit environment variables
cp .env.docker .env
# Edit .env — at minimum change DIRECTUS_SECRET to a random string

# 3. Launch everything
docker compose -f docker-compose.prod.yml up -d

# 4. Open d9
# http://localhost:8055
# Login: admin@example.com / d9-admin-password (or whatever you set in .env)

# 5. (Optional) Apply the invoicing schema
docker compose -f docker-compose.prod.yml exec d9 node /directus/cli.js schema apply --yes /directus/snapshots/invoicing-schema.yaml
```

## Architecture

| Service    | Image              | Port | Purpose               |
|------------|--------------------| -----|-----------------------|
| **d9**     | Built from source  | 8055 | API + Admin dashboard |
| **postgres** | postgres:16-alpine | 5432 (internal) | Database     |
| **redis**  | redis:7-alpine     | 6379 (internal) | Cache store  |

## Volumes

- `d9-db` — PostgreSQL data (persistent)
- `d9-redis` — Redis data
- `d9-uploads` — User-uploaded files
- `d9-extensions` — Custom extensions

## Invoicing Schema (Factur-X)

The `snapshots/invoicing-schema.yaml` file contains a complete data model for electronic invoicing:

| Collection | Description |
|------------|-------------|
| `company` | Issuing company info (singleton) — SIRET, TVA intra, legal mentions |
| `clients` | Client companies/individuals |
| `products` | Product/service catalog with VAT rates |
| `invoices` | Invoices with lifecycle (draft → validated → sent → paid) |
| `invoice_items` | Invoice line items with quantity, price, VAT |
| `payments` | Payment tracking linked to invoices |

Factur-X fields included: SIRET, SIREN, TVA intracommunautaire, sequential numbering, ISO currency, payment terms.

Apply it after first boot:
```bash
docker compose -f docker-compose.prod.yml exec d9 node /directus/cli.js schema apply --yes /directus/snapshots/invoicing-schema.yaml
```

## Custom Extensions

Place built extensions in the `extensions/` directory before building, or mount them via the `d9-extensions` volume after startup.

If you have source plugins in `plugins/`, rebuild them first:

```bash
cd plugins/<your-plugin>
pnpm build
# Copy dist output to extensions/
```

## Useful Commands

```bash
# View logs
docker compose -f docker-compose.prod.yml logs -f d9

# Restart after config change
docker compose -f docker-compose.prod.yml restart d9

# Rebuild after code change
docker compose -f docker-compose.prod.yml up -d --build d9

# Stop everything
docker compose -f docker-compose.prod.yml down

# Stop and delete all data
docker compose -f docker-compose.prod.yml down -v
```

## Environment Variables

See `.env.docker` for all configurable variables. Key ones:

| Variable | Default | Description |
|----------|---------|-------------|
| `DIRECTUS_SECRET` | `change-me...` | JWT signing secret (MUST change) |
| `ADMIN_EMAIL` | `admin@example.com` | Initial admin email |
| `ADMIN_PASSWORD` | `d9-admin-password` | Initial admin password |
| `DB_PASSWORD` | `d9` | PostgreSQL password |
| `PUBLIC_URL` | `http://localhost:8055` | Public-facing URL |
| `LOG_LEVEL` | `info` | Logging verbosity |

> **Note**: Code-level identifiers (`DIRECTUS_*` env vars, `@directus/` imports, `directus_*` DB tables) are part of the Directus engine and must NOT be renamed. d9 is a fork — the internal engine references remain unchanged.
