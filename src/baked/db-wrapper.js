
// Make the SQL.js interface more like better-sqlite3 with prepare.get and prepare.all
export class DatabaseWrapper {
  constructor(absurdDB) {
    this.db = absurdDB;
  }

  prepare(sql) {
    const stmt = this.db.prepare(sql);
    return {
      get: (...params) => {
        const result = stmt.getAsObject(params);
        stmt.free();
        return result;
      },
      all: (...params) => {
        const results = [];
        stmt.bind(params);
        while (stmt.step()) {
          results.push(stmt.getAsObject());
        }
        stmt.free();
        return results;
      }
    };
  }
} 