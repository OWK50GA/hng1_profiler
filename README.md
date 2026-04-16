# Classifications API

A REST API that accepts a name, fetches classification data from three external APIs (Genderize, Agify, Nationalize), stores the result in a PostgreSQL database, and exposes endpoints to manage that data.

## Base URL

```
https://your-deployed-url.com
```

## Tech Stack

- Node.js + TypeScript
- Express
- PostgreSQL (`pg`)

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL

### Setup

1. Clone the repo and install dependencies:

```bash
pnpm install
```

2. Create a `.env` file in the root:

```env
CLASSIFY_DB_URL=postgresql://user:password@localhost:5432/classifications_db
```

3. Run the migration:

```bash
psql $CLASSIFY_DB_URL -f migrations/001_create_classifications_table.sql
```

4. Start the dev server:

```bash
pnpm dev
```

---

## API Reference

### POST /api/profiles

Creates a new profile by classifying a name using external APIs. If the name already exists, returns the existing record.

**Request body:**
```json
{ "name": "ella" }
```

**Response 201 — created:**
```json
{
  "status": "success",
  "data": {
    "id": "b3f9c1e2-7d4a-4c91-9c2a-1f0a8e5b6d12",
    "name": "ella",
    "gender": "female",
    "gender_probability": 0.99,
    "sample_size": 1234,
    "age": 46,
    "age_group": "adult",
    "country_id": "US",
    "country_probability": 0.85,
    "created_at": "2026-04-01T12:00:00Z"
  }
}
```

**Response 200 — already exists:**
```json
{
  "status": "success",
  "message": "Profile already exists",
  "data": { ... }
}
```

---

### GET /api/profiles

Returns all profiles. Supports optional query filters.

**Query parameters (all optional, case-insensitive):**

| Parameter  | Example         |
|------------|-----------------|
| gender     | `male`, `female` |
| age_group  | `adult`, `child`, `teenager`, `senior` |
| country_id | `NG`, `US`      |

**Example:**
```
GET /api/profiles?gender=male&country_id=NG
```

**Response 200:**
```json
{
  "status": "success",
  "count": 2,
  "data": [
    {
      "id": "...",
      "name": "emmanuel",
      "gender": "male",
      "age": 25,
      "age_group": "adult",
      "country_id": "NG"
    }
  ]
}
```

---

### GET /api/profiles/:id

Returns a single profile by ID.

**Response 200:**
```json
{
  "status": "success",
  "data": {
    "id": "...",
    "name": "emmanuel",
    "gender": "male",
    "gender_probability": 0.99,
    "sample_size": 1234,
    "age": 25,
    "age_group": "adult",
    "country_id": "NG",
    "country_probability": 0.85,
    "created_at": "2026-04-01T12:00:00Z"
  }
}
```

---

### DELETE /api/profiles/:id

Deletes a profile by ID. Returns `204 No Content` on success.

---

## Error Responses

All errors follow this structure:

```json
{ "status": "error", "message": "<error message>" }
```

| Status | Meaning |
|--------|---------|
| 400    | Missing or empty name |
| 404    | Profile not found |
| 422    | Invalid request type |
| 500    | Internal server error |
| 502    | External API returned an invalid response |

## Classification Rules

- **Age group** (from Agify): `0–12` → child, `13–19` → teenager, `20–59` → adult, `60+` → senior
- **Nationality** (from Nationalize): country with the highest probability is selected
- **Gender** (from Genderize): if `gender` is null or `count` is 0, the request is rejected
