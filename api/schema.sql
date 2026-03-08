-- ══════════════════════════════════════════════════════════════════
--  Voice Control Research Platform — Database Schema
--  Safe to re-run: all statements use IF NOT EXISTS / ON CONFLICT
-- ══════════════════════════════════════════════════════════════════

-- Experiments -------------------------------------------------------
CREATE TABLE IF NOT EXISTS experiments (
    id          VARCHAR(50)  PRIMARY KEY,
    name        VARCHAR(255) NOT NULL DEFAULT 'Untitled Experiment',
    description TEXT         NOT NULL DEFAULT '',
    status      VARCHAR(20)  NOT NULL DEFAULT 'Draft',
    mode        VARCHAR(50)  NOT NULL DEFAULT 'action_transcript',
    pis_data    JSONB        NOT NULL DEFAULT '{}',
    grid_config JSONB        NOT NULL DEFAULT '{}',
    api_config  JSONB        NOT NULL DEFAULT '{}',
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Participants -------------------------------------------------------
CREATE TABLE IF NOT EXISTS participants (
    id            VARCHAR(50) PRIMARY KEY,
    experiment_id VARCHAR(50) NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
    started_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at      TIMESTAMPTZ,
    exported      BOOLEAN     NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_participants_exp
    ON participants(experiment_id);

-- Sessions (full transcript + event log) ----------------------------
CREATE TABLE IF NOT EXISTS sessions (
    id             SERIAL      PRIMARY KEY,
    participant_id VARCHAR(50) NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
    experiment_id  VARCHAR(50) NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
    session_data   JSONB       NOT NULL DEFAULT '{}',
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_participant
    ON sessions(participant_id);
CREATE INDEX IF NOT EXISTS idx_sessions_experiment
    ON sessions(experiment_id);

-- Users -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id          SERIAL       PRIMARY KEY,
    username    VARCHAR(100) UNIQUE NOT NULL,
    password    VARCHAR(255) NOT NULL, -- Hashed password
    role        VARCHAR(20)  NOT NULL DEFAULT 'Researcher',
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Grid Presets ------------------------------------------------------
CREATE TABLE IF NOT EXISTS grid_presets (
    id          SERIAL       PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    category    VARCHAR(50)  DEFAULT 'Custom',
    description TEXT,
    config      JSONB        NOT NULL,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
