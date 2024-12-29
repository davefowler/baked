declare module '@jlongster/sql.js' {
  interface SqlJsConfig {
    locateFile: (file: string) => string;
  }

  interface Database {
    run(sql: string, params?: any[]): void;
    exec(sql: string): void;
    prepare(sql: string): Statement;
    close(): void;
  }

  interface Statement {
    run(...params: any[]): void;
    get(...params: any[]): any;
    all(...params: any[]): any[];
    free(): void;
  }

  interface SqlJs {
    Database: new (path: string, options?: { filename: boolean }) => Database;
    FS: any;
    register_for_idb: (fs: any) => void;
  }

  function initSqlJs(config?: SqlJsConfig): Promise<SqlJs>;
  export default initSqlJs;
}

declare module 'absurd-sql' {
  export class SQLiteFS {
    constructor(FS: any, backend: any);
  }
}

declare module 'absurd-sql/dist/indexeddb-backend' {
  export default class IndexedDBBackend {
    constructor();
  }
}

declare module 'absurd-sql/dist/indexeddb-main-thread' {
  export function initBackend(worker: Worker): void;
} 