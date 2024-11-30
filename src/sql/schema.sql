CREATE TABLE IF NOT EXISTS assets (
    path TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    type TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS pages (
    path TEXT PRIMARY KEY,
    slug TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    template TEXT NOT NULL DEFAULT 'default',
    metadata TEXT,
    published_date TEXT
); 