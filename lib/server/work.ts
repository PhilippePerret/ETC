import db from "./db";
import path from "path";
import log from '../shared/log';
import { prefs } from "./prefs";
import { DEFAULT_WORK, type RecType, type WorkType } from "../shared/types";
import { t } from '../shared/Locale';
import { startOfToday } from "../shared/utils_shared";
import { appendFile, existsSync, readFileSync, renameSync, unlinkSync, writeFile } from "fs";

export class Work /* server */ {
  public static defaultDuration: number;

  /**
   * Initialisation de l'application (au niveau des travaux)
   */
  public static init() {
    this.defaultDuration = prefs.data.duree;
    this.prepareDefaultWork(this.defaultDuration);
  }

  /** Quand un changelog a été défini pour le travail
   * courant, on l'enregistre dans un fichier à la racine
   * du projet.
   */
  public static async saveChangelog(changelog: string, folder: string){
    const logpath = path.join(folder, 'CHANGELOG.md');
    const provpath = path.join(folder, 'CHANGELOG~.md');
    function replaceLog(){
      existsSync(logpath) && unlinkSync(logpath);
      renameSync(provpath, logpath);
    }
    const code = `### ${new Date().toLocaleDateString(prefs.data.lang)}\n\n${changelog}\n\n`
    writeFile(provpath, code, 'utf8', (error) => {
      if (existsSync(logpath)) {
        appendFile(provpath, readFileSync(logpath), 'utf8',
          (err2) => { replaceLog() }
        );
      } else {
        replaceLog();
      }
    });
    log.info("Ajout du changelog dans %s", logpath);
  }

  private static prepareDefaultWork(dureeDefault: number){
    Object.assign(DEFAULT_WORK, {
      defaultLeftTime: dureeDefault,
      leftTime: dureeDefault
    })
  }

  public static get(workId: string): WorkType {
    return db.getWork(workId) as WorkType;
  }

  /**
   * Retourne le travail courant, le travail à faire.
   */
  public static getCurrentWork(options: RecType | undefined = {}): WorkType | {ok: boolean, error: string} {
    log.info("-> getCurrentWork");
    // Avant toutes choses, il faut "réveiller" les travaux qui
    // doivent l'être, c'est-à-dire les travaux qui définissent
    // un cron d'échéance (voir le détail dans la fonction)
    this.awakeCronWorksAtHeadline()
    // Filtre qui permet de relever tous les candidats
    const filtre: string | string[] = []
    filtre.push('active = 1 AND leftTime > 0');
    if (options.no_lasttime_constraint !== true) {
      filtre.push(`(lastWorkedAt IS NULL OR lastWorkedAt <= ${startOfToday()})`);
    }
    if (options.but) { filtre.push(`ID <> "${options.but}"`) }
    let candidat: WorkType | undefined = db.getTodayCandidats(filtre.join(' AND '));
    if ( candidat ) {
      return candidat as WorkType;
    } else if (this.deuxiemeFois === false) {
      /* Traitement spécial en cas d'absence de candidats, pour
       * savoir s'il faut updater le cycle, etc.
       */
      if (this.noActiveWork()) {
        // <= Pas de tâche active
        // => C'est une erreur handicapante
        return {ok: false, error: t('work.any_active')}
      } else if (this.noWorkWithRestTime()) {
        // <= Plus aucune tâche active n'a de leftTime
        // => On initie un nouveau cycle
        db.resetCycle();
        return this.getCurrentWork(options)
      } else {
        // <= Il y a des tâches avec du leftTime, mais elles ont
        //    été déjà jouées aujourd'hui.
        // => On baisse la contrainte
        return this.getCurrentWork(Object.assign(options, {no_lasttime_constraint: true}))
      }
    } else if (this.deuxiemeFois === true) {
      // Normalement impossible…
    }
    return {ok: false, error: 'Ça ne doit pas pouvoir arriver'}
  }; 
  private static deuxiemeFois: boolean = false;


  /**
   * Réveil des travaux a avec Cron
   * ------------------------------
   * On réveille un travail si :
   * - il a un cron défini
   * - il est inactif
   * - il n'a pas de date de cron et la 
   * - avoir une échéance dans le passé
   *   MAIS aucun enregistrement cronedAt 
   *   OU aucun enregistrement après cette échéance (ce qui 
   *   prouve que le travail n'a pas été démarré et accompli)
   */
  private static awakeCronWorksAtHeadline(){
    const condition = `
    active = 0
    AND cron <> ''
    AND nextCronDateAt < ?
    AND (
      cronedAt IS NULL
      OR
      cronedAt < nextCronDateAt
    )

    `

    const checkRequest = `SELECT id FROM works WHERE ${condition}`
    const idsToAwake = db.exec(checkRequest);
    log.info("Works with cron awaken:", idsToAwake);

    const request = `
    UPDATE works
    SET
      active = 1, 
      leftTime = defaultLeftTime
    WHERE 
      ${condition}
    `
    db.exec(request);

  }


  private static noActiveWork(): boolean {
    return db.findAll('active = 1').length === 0;
  }
  private static noWorkWithRestTime(): boolean {
    return db.findAll('active = 1 AND leftTime > 0').length === 0;
  }

  constructor(
    private data: WorkType
  ){}

  public getData(){return this.data}

  // raccourcis
  public get id(){ return this.data.id; }

}