PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS businesses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  place_id TEXT UNIQUE,
  name TEXT NOT NULL,
  category TEXT,
  phone TEXT,
  website TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  country TEXT,
  rating REAL,
  maps_url TEXT,
  lead_status TEXT DEFAULT 'new',
  notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS emails (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id INTEGER NOT NULL,
  email TEXT NOT NULL,
  source_url TEXT,
  source_type TEXT,
  confidence REAL DEFAULT 0.5,
  is_primary INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (business_id, email),
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS crawl_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  query TEXT NOT NULL,
  location TEXT NOT NULL,
  source TEXT DEFAULT 'google_places',
  status TEXT DEFAULT 'pending',
  result_count INTEGER DEFAULT 0,
  error_message TEXT,
  started_at TEXT DEFAULT CURRENT_TIMESTAMP,
  finished_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_businesses_name ON businesses(name);
CREATE INDEX IF NOT EXISTS idx_businesses_city ON businesses(city);
CREATE INDEX IF NOT EXISTS idx_businesses_lead_status ON businesses(lead_status);
CREATE INDEX IF NOT EXISTS idx_emails_email ON emails(email);
CREATE INDEX IF NOT EXISTS idx_emails_business_id ON emails(business_id);
