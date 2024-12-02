CREATE VIRTUAL TABLE IF NOT EXISTS pages_fts USING fts5(
    title, 
    content,
    data UNINDEXED,
    content='pages',
    content_rowid='path'
);

CREATE TRIGGER IF NOT EXISTS pages_ai AFTER INSERT ON pages BEGIN
    INSERT INTO pages_fts(rowid, title, content, data)
    VALUES (new.path, new.title, new.content, new.data);
END;

CREATE TRIGGER IF NOT EXISTS pages_ad AFTER DELETE ON pages BEGIN
    INSERT INTO pages_fts(pages_fts, rowid, title, content, data)
    VALUES('delete', old.path, old.title, old.content, old.data);
END;

CREATE TRIGGER IF NOT EXISTS pages_au AFTER UPDATE ON pages BEGIN
    INSERT INTO pages_fts(pages_fts, rowid, title, content, data)
    VALUES('delete', old.path, old.title, old.content, old.data);
    INSERT INTO pages_fts(rowid, title, content, data)
    VALUES (new.path, new.title, new.content, new.data);
END; 
