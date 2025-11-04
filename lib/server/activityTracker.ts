/**
 * Module qui s'assure que l'utilisateur est bien en train de 
 * travailler sur le projet courant de la tâche.
 * Pour ce faire, il cherche le premier fichier/dossier modifié
 * depuis la précédente date de check.
 */
import fs from 'fs';
import path from 'path';

const fileWatcher = new Worker(path.join(__dirname, 'ActivityTracker_watcher.ts'));

export class ActivityTracker /* SERVER */ { /* singleton */
  public static singleton(){return this._inst || (this._inst = new ActivityTracker())}
  private static _inst: ActivityTracker;
  private constructor(){}


  // Partie Watcher
  private get watcher(){
    return this._watcher || (this._watcher = fileWatcher)
  }; 
  private _watcher?: Worker;

  /**
   * @api
   * 
   * Lancement du watcher qui essaie de trouver un fichier modifié 
   * dans le projet dans le quart d'heure précédent
   */
  public watchActivity(folder: string, lastCheckAt: number): Promise<boolean> {
    return new Promise((resolve, reject) => {

      const listen = (eventName: keyof WorkerEventMap, fallback: any) => {
        this.watcher.addEventListener(eventName, fallback);
      };
      const unlisten = (eventName: keyof WorkerEventMap, fallback: any) => {
        this.watcher.removeEventListener(eventName, fallback);
      };
      const doResolve = (eventName: keyof WorkerEventMap, fallback: any, data: any) => {
        unlisten(eventName, fallback);
        resolve(data);
      }
      const doReject = (eventName: keyof WorkerEventMap, fallback: any, error: string) => {
        unlisten(eventName, fallback);
        reject(new Error(error));
      }

      const handler = (event: MessageEvent) => {
        doResolve('message', handler, event.data.active);
      };
      const errorHandler = (event: ErrorEvent) => {
        doReject('error', errorHandler, event.message || 'Worker unknown error');
      };
      const messageErrorHandler = (event: MessageEvent) => {
        doReject('messageerror', messageErrorHandler, event.data || 'Worker unknown message error');
      };

      listen('error', errorHandler);
      listen('messageerror', messageErrorHandler);
      listen('message', handler);

      this.watcher.postMessage({ folder, lastCheckAt });
    });
  }

  public init(){}

}

export const activTracker = ActivityTracker.singleton();

