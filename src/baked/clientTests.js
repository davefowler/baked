const assert = (value, condition, message) => {
    // log out for better debugging
    // console.log('TESTS - assert', message, condition);
    if (!condition) {
        console.error('TESTS ERR - ', message, 'value was:', value);
        throw new Error(message + ' value was: ' + value);
    }
}

const runDbTests = async (testDB) => {
    console.log('TESTS - running db tests');

    // Add a small delay to ensure AbsurdSQL has finished initialization
    await new Promise(resolve => setTimeout(resolve, 1000));

    // test the database querying for 1+2
    const result = testDB.exec('SELECT 1+2 as sum');
    const sum = result[0].values[0][0];
    assert(sum, sum === 3, 'can query for math: 1+2 = 3');
    
    // Test that we can query the database
    const tablesStmt = testDB.exec("SELECT name FROM sqlite_master WHERE type='table'");
    const tables = tablesStmt[0].values;
    assert(tables, tables.length === 2, 'There are 2 tables in the database');
    assert(tables[0][0], tables[0][0] === 'assets', 'There is an assets table');
    assert(tables[1][0], tables[1][0] === 'pages', 'There is a pages table');

    const npagesStmt = testDB.exec("SELECT count(*) FROM pages");
    const npages = npagesStmt[0].values;
    assert(npages[0][0], npages[0][0] > 0, 'There are pages in the database');

    const nassets = testDB.exec("SELECT count(*) FROM assets");
    const nassetsVal = nassets[0].values[0][0];
    assert(nassetsVal, nassetsVal > 0, 'There are assets in the database');

    const indexPage = testDB.exec("SELECT * FROM pages WHERE path = 'index'");
    const indexPageVal = indexPage[0].values[0];
    assert(indexPageVal, indexPageVal.length > 0, 'Index page exists');

    // Test that the Absurd SQL data is actually backed up in indexedDB
    const idbDatabases = await self.indexedDB.databases();
    console.log('TESTS - idbDatabases', idbDatabases);
    const sqliteDb = idbDatabases.find(db => db.name.includes('sql'));
    assert(sqliteDb, sqliteDb !== undefined, 'SQLite database exists in IndexedDB');

    // Optional: Check the size of the database
    const dbRequest = self.indexedDB.open(sqliteDb.name);
    await new Promise((resolve, reject) => {
        dbRequest.onsuccess = (event) => {
            const db = event.target.result;
            const transaction = db.transaction(['chunks'], 'readonly');
            const store = transaction.objectStore('chunks');
            const countRequest = store.count();
            
            countRequest.onsuccess = () => {
                assert(countRequest.result, countRequest.result > 0, 'IndexedDB contains SQLite chunks');
                db.close();
                resolve();
            };
        };
        dbRequest.onerror = () => reject(dbRequest.error);
    });

    // TODO - make this test work.  not loading assets well
    // assert(testDB.site, testDB.site.length > 0, 'Site.yaml loaded onto database');

    console.log('TESTS - db tests complete');
}

const runBakerTests = async (testDB, testBaker) => {
    console.log('TESTS - running baker tests');
    const index = testBaker.getPage('index');
    assert(index, index, 'Index page exists');
    assert(index.title, index.title.includes('Baked site'), 'Index page title is correct');

    const latestPosts = testBaker.getLatestPages();
    assert(latestPosts, latestPosts.length > 0, 'There are pages posts');

    const blogPages = testBaker.getLatestPages(100, 0, 'blog');
    assert(blogPages, blogPages.length > 0, 'There are blog pages');

    const logPages = testBaker.getLatestPages(100, 0, 'log');
    assert(logPages, logPages.length === 0, 'There are no "log" pages');

    assert([blogPages.length, latestPosts.length], blogPages.length < latestPosts.length, 'all posts is longer than just blog posts');

    // Assets
    const base = testBaker.getAsset('base.html', 'templates');
    assert(base, base, 'base.html exists');
    assert(typeof base, typeof base === 'function', 'base.html is a function');

    console.log('TESTS - baker tests complete');
}

export { runDbTests, runBakerTests };
