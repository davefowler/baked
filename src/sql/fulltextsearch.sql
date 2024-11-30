CREATE VIRTUAL TABLE IF NOT EXISTS pages_fts USING fts5(
    title, 
    content,
    metadata,
    content='pages',
    content_rowid='slug'
);

CREATE TRIGGER IF NOT EXISTS pages_ai AFTER INSERT ON pages BEGIN
    INSERT INTO pages_fts(rowid, title, content, metadata)
    VALUES (new.slug, new.title, new.content, new.metadata);
END;

CREATE TRIGGER IF NOT EXISTS pages_ad AFTER DELETE ON pages BEGIN
    INSERT INTO pages_fts(pages_fts, rowid, title, content, metadata)
    VALUES('delete', old.slug, old.title, old.content, old.metadata);
END;

CREATE TRIGGER IF NOT EXISTS pages_au AFTER UPDATE ON pages BEGIN
    INSERT INTO pages_fts(pages_fts, rowid, title, content, metadata)
    VALUES('delete', old.slug, old.title, old.content, old.metadata);
    INSERT INTO pages_fts(rowid, title, content, metadata)
    VALUES (new.slug, new.title, new.content, new.metadata);
END; 