import { clock } from "./Clock";
import type { RecType, WorkType } from "../shared/types";
import { DGet } from "../../public/js/dom.js";
import { Flash } from "../../public/js/flash.js";
import { ui } from "./ui";
import { EndWorkReport } from "./stop_report";
import { markdown } from "../shared/utils_shared";
import { postToServer } from "./utils";
import { t } from "../shared/Locale";
import type { RecordWithTtl } from "dns";

export class Work {

  /**
   * @main
   * @api
   * 
   * Point d'entrée de l'application au niveau client.
   * 
   */
  public static async init(): Promise<boolean>{
    const res = await this.getCurrent();
    return res;
  }

  public static currentWork: Work;

  /**
   * Ajout de la durée de travail +time+ au projet courant, mais
   * seulement si ce temps excède la minute.
   */
  public static async addTimeToCurrentWork(time: number){
    if ( time ) {
    // if ( true ) {
      await this.currentWork.addTimeAndSave(time)
    } else {
      Flash.error(t('times.to_short_to_be_saved'))
    }
  }

  /**
   * Méthode d'instance pour sauver le temps
   */
  public async addTimeAndSave(time: number): Promise<boolean> {
    this.data.totalTime += time;
    this.data.cycleTime += time;
    this.data.leftTime -= time;
    if (this.data.leftTime < 0) { this.data.leftTime = 0; }
    if ( this.data.cycleCount === 0 ) {
      this.data.cycleCount = 1;
      this.data.startedAt = clock.getStartTime() * 1000;
    }
    this.data.lastWorkedAt = clock.getStartTime() * 1000;
    const stopReport = await new EndWorkReport(this).writeReport() as any;
    if (!stopReport /* annulation */) {
      await Work.getCurrent();
      return false;
    }
    
    this.data.report = stopReport.content as string;
    this.data.active = stopReport.desactivate ? 0 : 1;
    const changelog = stopReport.changelog as string;
    console.log("[addTimeAndSave] Enregistrement des temps et du rapport", this.data);
    const result: RecType = await postToServer('/work/save-session', {work: this.data, changelog});
    // console.log("Retour save session: ", result);
    // On actualise l'affichage pour apercevoir les nouveaux temps
    // pendant 2 secondes puis on passe à la tâche suivante, qui a
    // été remontée.
    // (sauf si le travail a été désactivé)
    if (stopReport.desactivate) {
      // En cas de désactivation
      Flash.notice(t('work.desactivated'));
    } else {
      // Normal case
      this.dispatchData();
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    Work.displayWork(result.next, result.options);
    if (result.ok) { Flash.success(t('times.saved'));}
    return true;
  }

  private static get obj(){
    return this._obj || (this._obj = DGet('section#current-work-container')) as HTMLElement;
  }
  private static _obj: HTMLElement | null;

  /**
   * Récupère la tâche courante côté serveur et l'affiche.
   * 
   * options peut définir but: <work id> pour exclure une
   * tâche des résultats.
   */
  public static async getCurrent(options: RecType = {}): Promise<boolean> {
    Object.assign(options, {process: 'Work::getCurrent'})
    const retour: RecType = await postToServer('/work/get-current', options);
    if (retour.ok === false) { return false}
    if (retour.work.ok === false) { // <= il n'y aucune tâche active
      Flash.error(t('work.any_active'));
      return false;
    } else {
      ui.resetBackgroundColor();
      this.displayWork(retour.work, retour.options);
      return true;
    }
  }

  // Pour pouvoir mettre un travail en travail courant depuis
  // l'extérieur (la liste des tâches par exemple)
  public static setAsCurrent(work: WorkType, options?: RecType){
    this.displayWork(work, options || {});
  }

  private static displayWork(
    wdata: WorkType,
    options: RecType
  ) {
    // console.log("Current Task", dataCurrentWork);
    this.currentWork = new Work(wdata);
    this.currentWork.display(options);
  }

  constructor(
    private data: WorkType
  ){}

  public updateData(newData: WorkType){
    this.data = Object.assign(this.data, newData);
  }

  public get id(){ return this.data.id; }
  public get script(): string | undefined {return this.data.script}
  public get folder(): string | undefined {return this.data.folder}
  public get leftTime(): number {return this.data.leftTime}
  public get cycleTime(): number {return this.data.cycleTime}
  public get totalTime(): number {return this.data.totalTime}

  /**
   * Fonction appelée pour afficher le travail (courant)
   */
  display(options: {[x: string]: any}){
    // Disptach des données
    this.dispatchData();
    // Réglage des boutons
    ui.showButtons({
      Start: true,
      Restart: false,
      Stop: false,
      Pause: false,
      Change: options.canChange,
      runScript: !!this.data.script,
      openFolder: !!this.data.folder,
    });
  }

  dispatchData(){
    Object.entries(this.data).forEach(([k, v]) => {
      v = ((prop: string, v: any) => {
        switch(prop){
          case 'totalTime': 
          case 'cycleTime':
          case 'leftTime':
            return clock.time2horloge(v);
          case 'content': 
            return markdown(v);
          case 'report':
            if ( v ) {
              return markdown(`---\n\n# ${t('ui.title.stop_report')}\n\n` + v);
            } else { return '' }
          default: 
            return v;
        }
      })(k, v);
      const propField = this.field(k);
      if ( propField ) {
        propField.innerHTML = v;
      }
    })
  }

  field(prop: string){
    return Work.obj.querySelector(`#current-work-${prop}`);
  }
}