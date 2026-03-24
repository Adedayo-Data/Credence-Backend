import type { Queryable } from './repositories/queryable.js'

const CREATE_TABLE_STATEMENTS = [
  `
  CREATE TABLE IF NOT EXISTS identities (
    address TEXT PRIMARY KEY,
    display_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT identities_address_nonempty CHECK (length(trim(address)) > 0)
  )
  `,
  `
  CREATE TABLE IF NOT EXISTS bonds (
    id BIGSERIAL PRIMARY KEY,
    identity_address TEXT NOT NULL REFERENCES identities(address) ON DELETE CASCADE,
    amount NUMERIC(20, 7) NOT NULL CHECK (amount >= 0),
    start_time TIMESTAMPTZ NOT NULL,
    duration_days INTEGER NOT NULL CHECK (duration_days > 0),
    status TEXT NOT NULL CHECK (status IN ('active', 'released', 'slashed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
  `,
  `
  CREATE TABLE IF NOT EXISTS attestations (
    id BIGSERIAL PRIMARY KEY,
    bond_id BIGINT NOT NULL REFERENCES bonds(id) ON DELETE CASCADE,
    attester_address TEXT NOT NULL REFERENCES identities(address) ON DELETE CASCADE,
    subject_address TEXT NOT NULL REFERENCES identities(address) ON DELETE CASCADE,
    score INTEGER NOT NULL CHECK (score BETWEEN 0 AND 100),
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT attestations_unique_attester_subject_per_bond UNIQUE (bond_id, attester_address, subject_address)
  )
  `,
  `
  CREATE TABLE IF NOT EXISTS slash_events (
    id BIGSERIAL PRIMARY KEY,
    bond_id BIGINT NOT NULL REFERENCES bonds(id) ON DELETE CASCADE,
    slash_amount NUMERIC(20, 7) NOT NULL CHECK (slash_amount > 0),
    reason TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT slash_events_reason_nonempty CHECK (length(trim(reason)) > 0)
  )
  `,
  `
  CREATE TABLE IF NOT EXISTS score_history (
    id BIGSERIAL PRIMARY KEY,
    identity_address TEXT NOT NULL REFERENCES identities(address) ON DELETE CASCADE,
    score INTEGER NOT NULL CHECK (score BETWEEN 0 AND 100),
    source TEXT NOT NULL CHECK (source IN ('bond', 'attestation', 'slash', 'manual')),
    computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
  `,
  `
  CREATE TABLE IF NOT EXISTS notification_send_attempts (
    id TEXT PRIMARY KEY,
    notification_id TEXT NOT NULL,
    idempotency_key TEXT NOT NULL UNIQUE,
    attempt_group INTEGER NOT NULL DEFAULT 1,
    attempt_number INTEGER NOT NULL DEFAULT 1,
    provider TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'sent', 'failed', 'deduped')),
    provider_response_id TEXT,
    error_message TEXT,
    attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT notification_send_attempts_key_unique UNIQUE (idempotency_key)
  )
  `,
  `CREATE INDEX IF NOT EXISTS bonds_identity_address_idx ON bonds (identity_address)`,
  `CREATE INDEX IF NOT EXISTS attestations_subject_address_idx ON attestations (subject_address)`,
  `CREATE INDEX IF NOT EXISTS attestations_bond_id_idx ON attestations (bond_id)`,
  `CREATE INDEX IF NOT EXISTS slash_events_bond_id_idx ON slash_events (bond_id)`,
  `CREATE INDEX IF NOT EXISTS score_history_identity_address_idx ON score_history (identity_address)`,
  `CREATE INDEX IF NOT EXISTS notification_send_attempts_notification_id_idx ON notification_send_attempts (notification_id)`,
  `CREATE INDEX IF NOT EXISTS notification_send_attempts_idempotency_key_idx ON notification_send_attempts (idempotency_key)`,
  `CREATE INDEX IF NOT EXISTS notification_send_attempts_status_idx ON notification_send_attempts (status)`,
] as const

const DROP_TABLE_STATEMENTS = [
  'DROP TABLE IF EXISTS notification_send_attempts',
  'DROP TABLE IF EXISTS score_history',
  'DROP TABLE IF EXISTS slash_events',
  'DROP TABLE IF EXISTS attestations',
  'DROP TABLE IF EXISTS bonds',
  'DROP TABLE IF EXISTS identities',
] as const

export async function createSchema(db: Queryable): Promise<void> {
  for (const statement of CREATE_TABLE_STATEMENTS) {
    await db.query(statement)
  }
}

export async function resetDatabase(db: Queryable): Promise<void> {
  await db.query(
    'TRUNCATE TABLE notification_send_attempts, score_history, slash_events, attestations, bonds, identities RESTART IDENTITY CASCADE'
  )
}

export async function dropSchema(db: Queryable): Promise<void> {
  for (const statement of DROP_TABLE_STATEMENTS) {
    await db.query(statement)
  }
}
