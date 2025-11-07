import os from 'os';
import path from 'path';
import { existsSync } from 'fs';
import { Database } from "bun:sqlite"
import { DEFAULT_WORK, type RecType, type WorkType } from "../shared/types";
import { ENV, userDataPath } from './constants_server';
import { startOfToday } from '../shared/utils_shared';
import { t } from '../shared/Locale';
import { prefs } from './prefs';
import log from 'electron-log/main';
import { CronExpressionParser } from 'cron-parser';

class DBWorks { /* singleton db */


  /**
   * @api
   * Fonction la plus importante qui retourne le travail à 
   * faire pour maintenant en fonction des +conditions+.
   * 
   * @returns Le travail à travailler
   */
  public getTodayCandidats(conditions: string): WorkType | undefined {
    const request = `
    SELECT * FROM (
      SELECT * FROM works 
        WHERE ${conditions}
        ORDER BY leftTime DESC LIMIT 5
    ) ORDER BY RANDOM() LIMIT 1;
    `
    return this.db.query(request).get() as WorkType | undefined;
  }


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
    console.log("-> getAllWorks")
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
      const colonnes  = this.workColumns;
      const interos   = colonnes.map(c => `?`)
      const request = `INSERT OR REPLACE INTO works (${colonnes.join(', ')}) VALUES (${interos.join(', ')})`;
      // log.info("REQUEST:", request);
      const upsertWork = this.db.prepare(request);
      const trans = this.db.transaction((works: WorkType[]) => {
        works.forEach((work: WorkType) => {
          work = this.realValuesForWork(work);
          const values: any[] = colonnes.map(c => (work as any)[c]);
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

  private get workColumns(){
    return this._wcols || (this._wcols = Object.keys(DEFAULT_WORK))
  };private _wcols!: string[];

  /**
   * Mets dans les données du travail les bonnes valeurs, en 
   * complétant celles qui manquent.
   * Exemple :
   *  - la date de création (createdAt)
   *  - la date de prochain cron si le cron est défini
   *  - etc.
   */
  private realValuesForWork(work: WorkType): WorkType {
    const realValues = {}
    this.workColumns.forEach((col: string) => {
      Object.assign(realValues, {[col]: this.realDefValueFor(col, work)})
    });
    return realValues as WorkType;
  }
  private realDefValueFor(prop: string, work: any){
    switch(prop){
      case 'leftTime':
        return work[prop] || work.defaultLeftTime || prefs.data.duree;
      case 'defaultLeftTime':
        return work[prop] || prefs.data.duree;
      case 'createdAt':
        return work[prop] || new Date().getTime();
      case 'nextCronDateAt':
        if (work.cron) {
          return this.getNextCronDateOf(work.cron);
        } else {
          return null;
        }
      default: 
        return work[prop] || (DEFAULT_WORK as any)[prop];
    }
  }

  /**
   * Fonction pour enregistrer un travail (déjà créé)
   * 
   * (cette fonction ne sert pas encore puisque pour le moment tous
   * les travaux sont enregistrés ensemble)
   * 
   * @param work Les données du travail
   */
  public updateWork(work: WorkType) {
    work = this.realValuesForWork(work);
    const cols = Object.keys(work); // Mind: peut-être pas toutes !
    const columns = cols.map((c: string) => `${c} = ?`).join(', ');
    const request = `UPDATE works SET ${columns}`;
    this.db.run(request, Object.values(work));
  }

  private createWork(work: WorkType){
    work = this.realValuesForWork(work);
    const colonnes = this.workColumns.join(', ');
    const interos = this.workColumns.map(_c => '?').join(', ');
    const workData = this.workColumns.map((c: string) => (work as any)[c]);
    const request = `INSERT INTO works (${colonnes}) VALUES (${interos})`;
    this.db.run(request, workData);
  }

  private getNextCronDateOf(cron: string){
    return CronExpressionParser.parse(cron).next().toDate().getTime();
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
        defaultLeftTime = CASE
          WHEN defaultLeftTime IS NULL OR defaultLeftTime = 0 THEN ?
          ELSE defaultLeftTime
          END,
        leftTime = CASE 
          WHEN defaultLeftTime IS NULL OR defaultLeftTime = 0 THEN ?
          ELSE defaultLeftTime
          END
      WHERE
        active = 1
      `
      this.db.run(request, [prefs.data.duree, prefs.data.duree]);
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
    res = res || {v: ''};
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
      scriptBtn TEXT,
      cron TEXT,
      cronedAt INTEGER,
      nextCronDateAt INTEGER,
      totalTime INTEGER,
      cycleTime INTEGER,
      sessionTime INTEGER,
      leftTime INTEGER,
      cycleCount INTEGER,
      startedAt INTEGER,
      lastWorkedAt INTEGER,
      active INTEGER,
      defaultLeftTime INTEGER,
      report STRING,
      createdAt INTEGER
    );
    CREATE TABLE IF NOT EXISTS keypairs (
      k TEXT PRIMARY KEY,
      v TEXT
    )
    `.trim().replace(/\n\s+/m,' ');
    this.db.run(request);

    this.createWork(this.defaultWorkData)
    this.saveWorksOrder([this.defaultWorkData.id]);
  }

  private get defaultWorkData(): WorkType{
    return {
      id: 'etc',
      active: 1,
      project: "ETC",
      content: t('work.very_first_one'),
      script: '',
      scriptBtn: '',
      folder: path.join(os.homedir(), 'Documents'),
      leftTime: this.defaultLeftTime,
      defaultLeftTime: this.defaultLeftTime,
      cron: undefined,
      cronedAt: null,
      nextCronDateAt: null,
      cycleTime: 0,
      totalTime: 0,
      cycleCount: 1,
      startedAt: new Date().getTime(),
      lastWorkedAt: undefined,
      report: '',
      createdAt: new Date().getTime()
    } as WorkType;
  }

  private get defaultLeftTime(): number {return prefs.data.duree }


  private get db(){return this._db || (this._db = new Database(this.dbPath))}; 
  private get dbPath(){return path.join(userDataPath as string, this.dbName)}
  private get dbName(): string {
    if ( ENV === 'prod') { return 'ETC.db' }
    else { return `ETC-${ENV}.db` }
  }

  private _db!: Database;
  public static singleton(){return this.inst || (this.inst = new DBWorks())}
  private constructor(){}
  private static inst: DBWorks;
}

const db = DBWorks.singleton();
export default db;