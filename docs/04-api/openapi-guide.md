# OpenAPI Specification Guide

This document explains how to use the Platinum Casino OpenAPI 3.0.3 specification for exploring, testing, and generating client code for the API.

The specification file lives at [`docs/04-api/openapi.yaml`](./openapi.yaml).

## Viewing the Spec

### Swagger UI (interactive)

Swagger UI renders the spec as an interactive page where you can read documentation and execute requests directly from the browser.

**Option 1 -- Docker (no install required):**

```bash
docker run -p 8080:8080 \
  -e SWAGGER_JSON=/spec/openapi.yaml \
  -v $(pwd)/docs/04-api:/spec \
  swaggerapi/swagger-ui
```

Then open `http://localhost:8080`.

**Option 2 -- npx (Node.js):**

```bash
npx swagger-ui-watcher docs/04-api/openapi.yaml
```

**Option 3 -- VS Code extension:**

Install the [Swagger Viewer](https://marketplace.visualstudio.com/items?itemName=Arjun.swagger-viewer) extension. Open `openapi.yaml` and run the command **Swagger Viewer: Preview Swagger**.

### Redoc (read-only reference)

Redoc produces a polished, three-panel reference layout that is well suited for sharing with stakeholders.

```bash
npx @redocly/cli preview-docs docs/04-api/openapi.yaml
```

Or generate a static HTML file:

```bash
npx @redocly/cli build-docs docs/04-api/openapi.yaml -o docs/04-api/api-reference.html
```

## Importing into Postman

1. Open Postman and click **Import** (top-left).
2. Choose **File** and select `docs/04-api/openapi.yaml`.
3. Postman will create a collection with all endpoints, parameters, and example bodies pre-filled.
4. Set up an environment variable for the base URL (`http://localhost:5000`) or let Postman use the `servers` entry from the spec.

> **Tip:** After importing, use Postman's **Cookie Manager** to inspect the `authToken` cookie set by the login endpoint. Subsequent authenticated requests will send it automatically when targeting `localhost:5000`.

## Generating Client SDKs

The [OpenAPI Generator](https://openapi-generator.tech/) project can produce typed client libraries for dozens of languages.

### Install

```bash
npm install -g @openapitools/openapi-generator-cli
```

### Example: TypeScript Axios client

```bash
openapi-generator-cli generate \
  -i docs/04-api/openapi.yaml \
  -g typescript-axios \
  -o generated/ts-client
```

### Example: Python client

```bash
openapi-generator-cli generate \
  -i docs/04-api/openapi.yaml \
  -g python \
  -o generated/python-client
```

The full list of available generators is at <https://openapi-generator.tech/docs/generators>.

## Validating the Spec

To check the spec for structural issues:

```bash
npx @redocly/cli lint docs/04-api/openapi.yaml
```

Or with the Swagger CLI:

```bash
npx @apidevtools/swagger-cli validate docs/04-api/openapi.yaml
```

## Keeping the Spec in Sync

The OpenAPI file is manually maintained. When routes change, update the corresponding path and schema entries in `openapi.yaml`. The route source files to watch are:

| Route file | Mounted at |
|---|---|
| `server/routes/auth.ts` | `/api/auth` |
| `server/routes/users.ts` | `/api/users` |
| `server/routes/games.ts` | `/api/games` |
| `server/routes/admin.ts` | `/api/admin` |
| `server/routes/login-rewards.ts` | `/api/rewards` |

Database schemas are defined in `server/drizzle/schema.ts`.

## Related Documents

- [REST API Reference](./rest-api.md) -- Prose-style endpoint documentation
- [Socket Events](./socket-events.md) -- WebSocket event reference for real-time game communication
- [Error Codes](./error-codes.md) -- Comprehensive list of error codes and their meanings
- [Architecture Overview](../02-architecture/) -- System architecture and component diagrams
- [Security](../07-security/) -- Authentication flow and security considerations
