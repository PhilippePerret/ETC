import os from 'os';
import path from 'path';
import { existsSync } from 'fs';
import { Database } from "bun:sqlite"
import { DEFAULT_WORK, type RecType, type WorkType } from "../shared/types";
import { userDataPath } from './constants_server';
import { startOfToday } from '../shared/utils_shared';
import { t } from '../shared/Locale';
import { prefs } from './prefs';
import log from 'electron-log/main';

class DBWorks { /* singleton db */

  public exec(request: string, params?: any) {
    if (params) {
      return this.db.run(request, params);
    } else {
      return this.db.run(request);
    }
  }
  public init(){
    // On s'assure que la base existe, avec un premier travail
    existsSync(this.dbPath) || this.buildDatabase();
  }

  public getWork(workId: string): WorkType {
    return this.run('SELECT * FROM works WHERE id = ?', [workId]) as WorkType;
  }
  public findAll(condition: string): WorkType[]{
    return this.run(`SELECT * FROM works WHERE ${condition}`) as WorkType[]
  }

  public getAllWorks(): WorkType[] {
    return this.run('SELECT * FROM works') as WorkType[];
  }
  
  public getAllActiveWorks(): WorkType[] {
    return this.findAll('active = 1');
  }

  /**
   * Retourne les données temporelles de toutes les tâches dont
   * les identifiants sont fournis
   * 
   */
  public getAllDataOf(ids: string[]): WorkType[] {
    const request = `
    SELECT * FROM works WHERE id IN (${ids.map(_s => '?').join(', ')})
    `;
    return this.run(request, {data: ids}) as WorkType[];
  }

  public saveAllWorks(works: WorkType[]): {ok: boolean, error: ''} {
    log.info("Works to save:", works);
    try {
      const colonnes  = Object.keys(DEFAULT_WORK);
      const interos   = colonnes.map(c => `?`)
      const request = `INSERT OR REPLACE INTO works (${colonnes.join(', ')}) VALUES (${interos.join(', ')})`;
      // log.info("REQUEST:", request);
      const upsertWork = this.db.prepare(request);
      const trans = this.db.transaction((works: WorkType[]) => {
        works.forEach((work: RecType) => {
          const values: any[] = colonnes.map(c => work[c] || (DEFAULT_WORK as any)[c]);
          // log.info("COLUMNS VALUE: ", values);
          upsertWork.run(values as any);
        })
      });
      trans(works);
      return {ok: true, error: ''}
    } catch(err) {
      return {ok: false, error: (err as any).message}
    }
  }

  private createNewWork(work: WorkType){
    const duration = work.defaultLeftTime as number;
    const request = `
    INSERT 
    INTO 
      works
      (id, project, content, folder, script, cron, cronedAt, totalTime, cycleTime, sessionTime, leftTime, cycleCount, startedAt, lastWorkedAt, active, defaultLeftTime, report)
    VALUES
      (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
    this.db.run(request, [work.id, work.project, work.content, work.folder, (work.script || null), (work.cron || null), null, 0, 0, 0, duration, 0, new Date().getTime(), null, 1,  duration, ""])
  }

  /**
   * Actualisation des données d'exécution du travail
   */
  updateWorkTimes(dw: WorkType){
    const request: string = `
      UPDATE works
      SET
        active = ?,
        startedAt = ?,
        totalTime = ?,
        cycleTime = ?,
        leftTime = ?,
        cycleCount = ?,
        lastWorkedAt = ?,
        report = ?
      WHERE
        id = ?
    `;
    const data = [
      dw.active,
      dw.startedAt,
      dw.totalTime,
      dw.cycleTime,
      dw.leftTime,
      dw.cycleCount,
      dw.lastWorkedAt,
      dw.report,
      dw.id
    ];
    log.info("Request: ", request);
    log.info("Data:", data);
    this.db.run(request, data as any);

    // // Pour vérification, on relève la donnée
    // const infos = this.db.query('SELECT * FROM works WHERE id = ?').get(dw.id);
    // log.info("Data after: ", infos);

    // Update cron last execution (cf. function)
    if (dw.cron && dw.active === 0){ this.updateCronAtOf(dw) }
  }

  /**
   * Fonction qui doit être appelée quand le travail est achevé
   * et qu'il possède un cron. Dans ce cas, puisqu'on vient de
   * l'exécuter, il faut désactiver ce travail et enregistrer
   * la date de dernière échéance réalisée pour savoir quand 
   * déclencher la prochaine fois le travail.
   * 
   * 
   * @param dw Les données complètes du travail
   */
  private updateCronAtOf(dw: WorkType): void {
    const request = `
      UPDATE works 
      SET cronedAt = ?, active = ?
      WHERE id = ?
      `
    this.db.run(request, [new Date().getTime(), 0, dw.id] as any);
  }

  /**
   * @api
   * 
   * Pour réinitialiser le cycle
   * (les temps de toutes les tâches actives sont mis à 0)
   * 
   */
  public resetCycle(){
    try {
      const request = `
      UPDATE
        works
      SET
        cycleCount = cycleCount + 1,
        cycleTime = 0,
        leftTime = defaultLeftTime
      WHERE
        active = 1
      `
      this.db.run(request);
      return {ok: true, error: undefined}
    } catch(err) {
      return {ok: false, error: (err as any).message}
    }
  }

  /**
   * Enregistrement de l'ordre des travaux
   */
  public saveWorksOrder(order: string | string[]){
    order = 'string' === typeof order ? order : order.join(':');
    const req = 'REPLACE INTO keypairs (k, v) VALUES (?, ?)';
    this.db.run(req, ['worksOrder', order]);
  }

  public getWorksOrder(): string[] {
    let res = this.db.query('SELECT v FROM keypairs WHERE k = ?').get('worksOrder');
    console.log("Res: ", res);
    res = res || {v: []};
    return (res as any).v.split(':') as string[];
  }

  /**
   * Enregistrement de la dernière date de changement
   * (quand l'utilisateur demande à changer la tâche courante, ce
   *  qu'il ne peut faire qu'une seule fois par session/jour)
   */
  public setLastChange(){
    const request = `
    REPLACE INTO 
      keypairs
      (k, v) 
    VALUES 
      (?, ?)
    `
    const query = this.db.prepare(request);
    query.run('lastChangedAt', new Date().getTime());
  }


  // Return true if last change is far from today
  public lastChangeIsFarEnough(){
    const request = `
    SELECT
      v
    FROM
      keypairs
    WHERE
      k = "lastChangedAt"
    `
    const result = this.db.query(request).all();
    if (result.length) {
      return Number((result as any)[0]['val']) < startOfToday();
    } else {
      return true;
    }
  }

  public workIdExists(workId: string): boolean {
    return !!this.db.query('SELECT 1 FROM works WHERE id = ? LIMIT 1').get(workId);
  }

  public removeWork(workId: string){
    this.db.run('DELETE FROM works WHERE id = ?', [workId]);
  }

  /**
   * @return Le nombre d'éléments remplissant la condition 
   * +condition+
   * 
   * @param condition La condition qui doit être remplie
   */
  public countWorks(condition: string): number {
  const request = `
    SELECT 
      COUNT(id) as count
    FROM
      works
    WHERE
      ${condition}
    `;
    const res: RecType = this.db.query(request).get() as RecType;
    return res.count;
  }




  /**
   * Pour jouer une requête quelconque
   * 
   * options
   *    data:     Les données à transmettre
   *    one:      Pour obtenir une seule donnée
   */
  private run(request: string, options: RecType = {}){
    const requestType = request.split(' ')[0];
    switch(requestType) {
      case 'SELECT':
        return this.runGet(request, options);
        break;
      case 'UPDATE':
      case 'INSERT':
      case 'DELETE':
        return this.runSet(request, options);
        break;
    }
  }
  private runSet(request: string, options: RecType = {}){

  }
  private runGet(request: string, options: RecType = {}){
    const query = this.db.query(request);
    if (options.one === true){
      return query.get(options.data);
    } else {
      return query.all(options.data);
    }
  }

  /**
   * Construction de la base de données
   */
  private buildDatabase(){
    const request = `
    CREATE TABLE IF NOT EXISTS works (
      id TEXT PRIMARY KEY,
      project TEXT,
      content TEXT,
      folder TEXT,
      script TEXT,
      cron TEXT,
      cronedAt INTEGER,
      totalTime INTEGER,
      cycleTime INTEGER,
      sessionTime INTEGER,
      leftTime INTEGER,
      cycleCount INTEGER,
      startedAt INTEGER,
      lastWorkedAt INTEGER,
      active INTEGER,
      defaultLeftTime INTEGER,
      report STRING
    );
    CREATE TABLE IF NOT EXISTS keypairs (
      k TEXT PRIMARY KEY,
      v TEXT
    )
    `.trim().replace(/\n\s+/m,' ');
    this.db.run(request);

    this.createNewWork(this.defaultWorkData)
  }

  private get defaultWorkData(): WorkType{
    return {
      id: 'start',
      active: 1,
      project: "ETC",
      content: t('work.very_first_one'),
      folder: path.join(os.homedir(), 'Documents'),
      leftTime: this.defaultLeftTime,
      defaultLeftTime: this.defaultLeftTime,
      cycleTime: 0,
      totalTime: 0,
      cycleCount: 1,
      startedAt: new Date().getTime(),
      lastWorkedAt: undefined,
      report: ''
    } as WorkType;
  }

  private get defaultLeftTime(): number {return prefs.data.duree }


  private get db(){return this._db || (this._db = new Database(this.dbPath))}; 
  private get dbPath(){return path.join(userDataPath as string, 'ETC.db')}

  private _db!: Database;
  public static singleton(){return this.inst || (this.inst = new DBWorks())}
  private constructor(){}
  private static inst: DBWorks;
}

const db = DBWorks.singleton();
export default db;