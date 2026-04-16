CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TYPE gender_enum AS ENUM ('male', 'female');
CREATE TYPE age_group_enum AS ENUM ('adult', 'child', 'teenager', 'senior');

CREATE TABLE classifications (
    id                  UUID PRIMARY KEY NOT NULL,
    -- ID SHOULD HAVE COME FROM CONTROLLER
    name                TEXT NOT NULL,
    gender              gender_enum NOT NULL,
    gender_probability  NUMERIC(5, 4) NOT NULL CHECK (gender_probability >= 0 AND gender_probability <= 1),
    sample_size         INTEGER NOT NULL CHECK (sample_size >= 0),
    age                 INTEGER NOT NULL CHECK (age >= 0),
    age_group           age_group_enum NOT NULL,
    country_id          TEXT NOT NULL,
    country_probability NUMERIC(5, 4) NOT NULL CHECK(country_probability >= 0 AND country_probability <= 1),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX classifications_name_unique_idx ON classifications (LOWER(name));

