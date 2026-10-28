-- ==============================================================================
-- Cloudflare D1 Initial Migration: Alfaaz Collective
-- Version: 0001_initial_schema.sql
-- Compatible with: SQLite / Cloudflare D1
-- ==============================================================================

PRAGMA foreign_keys = ON;

-- 1. Users & Identity
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    full_name TEXT,
    status TEXT NOT NULL DEFAULT 'PARTICIPANT',
    password_reset_at DATETIME
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- 1b. Consumed Password Reset Tokens (Replay Protection)
CREATE TABLE IF NOT EXISTS consumed_tokens (
    token_hash TEXT PRIMARY KEY,
    consumed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_consumed_tokens_exp ON consumed_tokens(expires_at);

-- 2. Administrative Audit Logs
CREATE TABLE IF NOT EXISTS admin_audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    admin_email TEXT NOT NULL,
    action TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id TEXT,
    details TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON admin_audit_logs(created_at DESC);

-- 3. Curated Archives & Journal (Blogs)
CREATE TABLE IF NOT EXISTS blogs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    excerpt TEXT,
    content TEXT NOT NULL,
    cover_image TEXT,
    is_published INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_blogs_published ON blogs(is_published, created_at DESC);

-- 4. Collective Circles / Clubs
CREATE TABLE IF NOT EXISTS club_applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_email TEXT NOT NULL,
    club_name TEXT NOT NULL,
    note TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING',
    admin_note TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_user_club_app UNIQUE (user_email, club_name)
);
CREATE INDEX IF NOT EXISTS idx_club_apps_user ON club_applications(user_email);

-- 5. Community Events
CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    event_date TEXT,
    registration_open INTEGER NOT NULL DEFAULT 0,
    capacity INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_events_open ON events(registration_open);

-- 6. Event Registrations (RSVPs)
CREATE TABLE IF NOT EXISTS event_registrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL,
    user_email TEXT NOT NULL,
    whatsapp_number TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_event_user_reg UNIQUE (event_id, user_email),
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_event_regs_user ON event_registrations(user_email);

-- 7. Exhibitions Configuration Master
CREATE TABLE IF NOT EXISTS exhibitions_list (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL UNIQUE,
    date_text TEXT NOT NULL DEFAULT 'Dates TBD',
    venue TEXT NOT NULL DEFAULT 'Venue TBD',
    about_text TEXT NOT NULL DEFAULT 'Details regarding the exhibition...',
    is_active INTEGER NOT NULL DEFAULT 0,
    tnc_pdf_url TEXT,
    registration_fee TEXT NOT NULL DEFAULT '',
    payment_instructions TEXT NOT NULL DEFAULT '',
    payment_qr_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_exhibitions_active ON exhibitions_list(is_active);

-- 8. Exhibition Applications & Portfolios
CREATE TABLE IF NOT EXISTS exhibition_applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_email TEXT NOT NULL,
    exhibition_cycle TEXT,
    full_name TEXT NOT NULL,
    age INTEGER NOT NULL,
    address TEXT NOT NULL,
    whatsapp TEXT NOT NULL,
    genre TEXT NOT NULL,
    medium TEXT NOT NULL,
    portfolio_url TEXT NOT NULL,
    over_19 INTEGER NOT NULL DEFAULT 0,
    agreed_to_screening INTEGER NOT NULL DEFAULT 0,
    applicant_note TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING',
    curator_note TEXT,
    registration_status TEXT NOT NULL DEFAULT 'NONE',
    agreed_to_tnc INTEGER NOT NULL DEFAULT 0,
    payment_proof_url TEXT,
    participant_note_reg TEXT,
    payment_confirmed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_user_exhibition_cycle UNIQUE (user_email, exhibition_cycle)
);
CREATE INDEX IF NOT EXISTS idx_exh_apps_user ON exhibition_applications(user_email);
CREATE INDEX IF NOT EXISTS idx_exh_apps_cycle ON exhibition_applications(exhibition_cycle);

-- 9. Creative Vault (Submissions)
CREATE TABLE IF NOT EXISTS submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    submission_type TEXT NOT NULL,
    title TEXT NOT NULL,
    file_url TEXT NOT NULL,
    note TEXT,
    author_email TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_submissions_author ON submissions(author_email);

-- 10. Recruitment Sessions
CREATE TABLE IF NOT EXISTS recruit_sessions (
    session_id TEXT PRIMARY KEY,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    status TEXT NOT NULL DEFAULT 'CONSENTED',
    current_screen TEXT,
    order_id INTEGER,
    spec_version TEXT NOT NULL DEFAULT '2026-10-v2',
    sjt_version TEXT NOT NULL DEFAULT '2026-09-rev',
    scoring_version TEXT NOT NULL DEFAULT '1.0-exact-thirds',
    feature_version TEXT NOT NULL DEFAULT '1.0',
    config_hash TEXT,
    device_class TEXT,
    input_modality TEXT,
    completed_at DATETIME
);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON recruit_sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_created ON recruit_sessions(created_at DESC);

-- 11. Candidate Identity (Recruitment)
CREATE TABLE IF NOT EXISTS applicant_identities (
    session_id TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone_or_contact TEXT,
    linkedin_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES recruit_sessions(session_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_identities_email ON applicant_identities(email);

-- 12. Affirmative Consent Records
CREATE TABLE IF NOT EXISTS consent_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL UNIQUE,
    consent_text_version TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    choices_json TEXT NOT NULL DEFAULT '{}',
    confirmed_18_plus INTEGER NOT NULL DEFAULT 1,
    FOREIGN KEY (session_id) REFERENCES recruit_sessions(session_id) ON DELETE CASCADE
);

-- 13. Accessibility Profiles
CREATE TABLE IF NOT EXISTS accessibility_profiles (
    session_id TEXT PRIMARY KEY,
    modes_enabled_json TEXT NOT NULL DEFAULT '[]',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES recruit_sessions(session_id) ON DELETE CASCADE
);

-- 14. Motor Warmup Baselines
CREATE TABLE IF NOT EXISTS warmup_baselines (
    session_id TEXT PRIMARY KEY,
    tap_latency_baseline_ms REAL,
    movement_speed_baseline REAL,
    reading_dwell_baseline_ms REAL,
    pointer_type TEXT,
    viewport_class TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES recruit_sessions(session_id) ON DELETE CASCADE
);

-- 15. Counterbalanced Task Assignments
CREATE TABLE IF NOT EXISTS task_assignments (
    session_id TEXT PRIMARY KEY,
    world_order_id INTEGER NOT NULL,
    world_sequence_json TEXT NOT NULL,
    seeds_json TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES recruit_sessions(session_id) ON DELETE CASCADE
);

-- 16. Situational Judgment Responses
CREATE TABLE IF NOT EXISTS sjt_responses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    scenario_id TEXT NOT NULL,
    option_id TEXT NOT NULL,
    t_ms REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_session_scenario UNIQUE (session_id, scenario_id),
    FOREIGN KEY (session_id) REFERENCES recruit_sessions(session_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_sjt_session ON sjt_responses(session_id);

-- 17. Minigame Behavioral Telemetry Stream
CREATE TABLE IF NOT EXISTS telemetry_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    seq INTEGER NOT NULL,
    segment_id INTEGER NOT NULL,
    t_ms REAL NOT NULL,
    server_received DATETIME DEFAULT CURRENT_TIMESTAMP,
    screen TEXT NOT NULL,
    game_world TEXT,
    mini_game TEXT,
    trial INTEGER,
    action TEXT NOT NULL,
    input_type TEXT,
    task_def_version TEXT DEFAULT '2.0',
    state_json TEXT,
    data_json TEXT,
    CONSTRAINT uq_session_seq UNIQUE (session_id, seq),
    FOREIGN KEY (session_id) REFERENCES recruit_sessions(session_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_telemetry_session ON telemetry_events(session_id);

-- 18. Extracted Behavioral Features
CREATE TABLE IF NOT EXISTS features (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    mini_game TEXT NOT NULL,
    feature_name TEXT NOT NULL,
    value_raw REAL,
    value_adjusted REAL,
    adjust_method TEXT,
    feature_version TEXT NOT NULL DEFAULT '1.0',
    valid INTEGER NOT NULL DEFAULT 1,
    flags_json TEXT NOT NULL DEFAULT '[]',
    CONSTRAINT uq_session_mg_feature UNIQUE (session_id, mini_game, feature_name),
    FOREIGN KEY (session_id) REFERENCES recruit_sessions(session_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_features_session ON features(session_id);

-- 19. Calibrated Game Scores
CREATE TABLE IF NOT EXISTS game_scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    game_id TEXT NOT NULL,
    parameter TEXT NOT NULL,
    raw_score REAL,
    min_score REAL,
    max_score REAL,
    span REAL,
    num REAL,
    relative_score REAL,
    band TEXT,
    status TEXT NOT NULL DEFAULT 'INSUFFICIENT',
    task_def_version TEXT NOT NULL DEFAULT '2.0',
    scoring_version TEXT NOT NULL DEFAULT 'game_sjt_scoring_v1',
    observation_count INTEGER NOT NULL DEFAULT 0,
    flags_json TEXT NOT NULL DEFAULT '[]',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_session_game UNIQUE (session_id, game_id),
    FOREIGN KEY (session_id) REFERENCES recruit_sessions(session_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_game_scores_session ON game_scores(session_id);

-- 20. Evaluated Evidence Records (Seven Constructs)
CREATE TABLE IF NOT EXISTS evidence (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    parameter TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    is_superseded INTEGER NOT NULL DEFAULT 0,
    superseded_at DATETIME,
    spec_version TEXT NOT NULL DEFAULT '2026-10-v2',
    sjt_version TEXT NOT NULL DEFAULT '2026-09-rev',
    scoring_version TEXT NOT NULL DEFAULT 'game_sjt_scoring_v1',
    feature_version TEXT NOT NULL DEFAULT '1.0',
    config_hash TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    sjt_raw INTEGER,
    sjt_min INTEGER,
    sjt_max INTEGER,
    sjt_span INTEGER,
    sjt_num INTEGER,
    sjt_relative REAL,
    sjt_band TEXT,
    predicted_sjt_relative REAL,
    model_version TEXT,
    prediction_status TEXT,
    game_raw REAL,
    game_min REAL,
    game_max REAL,
    game_span REAL,
    game_num REAL,
    game_relative REAL,
    game_observation_count INTEGER DEFAULT 0,
    game_consistency_spread REAL,
    cross_method_delta REAL,
    profile_completeness TEXT DEFAULT 'INSUFFICIENT',
    game_status TEXT NOT NULL DEFAULT 'INSUFFICIENT',
    game_band TEXT,
    consistency TEXT NOT NULL DEFAULT 'NOT_COMPUTED',
    relationship TEXT NOT NULL DEFAULT 'NOT_COMPUTED',
    confidence TEXT NOT NULL DEFAULT 'LIMITED',
    observed_behavior_summary TEXT,
    data_quality_flags_json TEXT NOT NULL DEFAULT '[]',
    CONSTRAINT uq_session_parameter_version UNIQUE (session_id, parameter, version),
    FOREIGN KEY (session_id) REFERENCES recruit_sessions(session_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_evidence_session ON evidence(session_id);

-- 21. Data Quality Flags
CREATE TABLE IF NOT EXISTS data_quality_flags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    scope TEXT NOT NULL,
    flag TEXT NOT NULL,
    detail TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES recruit_sessions(session_id) ON DELETE CASCADE
);

-- 22. Post-Interview Volunteer Outcomes
CREATE TABLE IF NOT EXISTS volunteer_outcomes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    outcome_type TEXT NOT NULL,
    value TEXT NOT NULL,
    recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    recorded_by TEXT,
    FOREIGN KEY (session_id) REFERENCES recruit_sessions(session_id) ON DELETE CASCADE
);

-- 23. Recruiter Dossier Access Logs
CREATE TABLE IF NOT EXISTS recruiter_access_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    admin_email TEXT NOT NULL,
    session_id TEXT NOT NULL,
    viewed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    ip_address TEXT,
    FOREIGN KEY (session_id) REFERENCES recruit_sessions(session_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_recruiter_logs_session ON recruiter_access_logs(session_id);

-- 24. Interview Bookings (Candidate Scheduling)
CREATE TABLE IF NOT EXISTS interview_bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL UNIQUE,
    candidate_name TEXT NOT NULL,
    candidate_email TEXT NOT NULL,
    candidate_phone TEXT,
    slot_date TEXT NOT NULL,
    slot_time TEXT NOT NULL,
    slot_display TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'SCHEDULED',
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES recruit_sessions(session_id) ON DELETE CASCADE,
    UNIQUE(slot_date, slot_time)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_slot ON interview_bookings(slot_date, slot_time);

-- 25. Interview Settings
CREATE TABLE IF NOT EXISTS interview_settings (
    id INTEGER PRIMARY KEY,
    slots_json TEXT NOT NULL DEFAULT '["11:00 AM", "03:00 PM", "05:30 PM", "07:00 PM"]',
    skip_days_json TEXT NOT NULL DEFAULT '["Sunday"]',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
