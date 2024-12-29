// Mimicks the used functions of better-sqlite3 
// but for absurd-sql making requests to the worker

export class ClientDatabase {
  private worker: Worker;

  constructor(worker: Worker) {
    this.worker = worker;
  }

  private sendMessage(message: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const id = Math.random().toString(36).substr(2, 9);
      
      const handler = (e: MessageEvent) => {
        if (e.data.id === id) {
          this.worker.removeEventListener('message', handler);
          if (e.data.error) {
            reject(new Error(e.data.error));
          } else {
            resolve(e.data.result);
          }
        }
      };
      
      this.worker.addEventListener('message', handler);
      this.worker.postMessage({ ...message, id });
    });
  }

  prepare(sql: string) {
    return {
      all: (...params: any[]) => 
        this.sendMessage({ action: 'query', payload: { sql, params } }),
      get: (...params: any[]) => 
        this.sendMessage({ action: 'get', payload: { sql, params } })
    };
  }
} 