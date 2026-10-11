CREATE TABLE IF NOT EXISTS research_budget (
 id INTEGER PRIMARY KEY CHECK (id=1),
 day TEXT NOT NULL,
 day_requests INTEGER NOT NULL,
 minute INTEGER NOT NULL,
 minute_requests INTEGER NOT NULL
);
