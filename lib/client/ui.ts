import { clock } from "./Clock";
import { Work } from "./work";
import { ActivityTracker } from "./activityTracker";
import { DGet } from "../../public/js/dom";
import { Flash } from "../../public/js/flash";
import { t } from '../shared/Locale';
import { postToServer } from "./utils";
import type { RecType } from "../shared/types";

function stopEvent(ev: Event){
  ev.stopPropagation();
  ev.preventDefault();
  return false
}
interface ButtonType {
  id: string;
  name: string;
  onclick: Function;
  hidden: boolean;
  row: 1 | 2;
  title: string; // aide au survol
}



export class UI {
  private static inst: UI;
  private constructor(){}
  public static getInst(){return UI.inst || (UI.inst = new UI())}

  public init(data: RecType){
    clock.setClockStyle(data.clock);
    clock.setCounterMode(data.counter);
    ui.setUITheme(data.theme);
    if (t('ui.app.mode') === 'dev') {
      const o = document.createElement('DIV');
      o.id = 'dev-light';
      o.innerHTML = 'dev';
      document.body.appendChild(o);
    }
    return true;
  }


  /**
   * Démarrage du travail
   */
  private onStart(ev: Event){
    this.mask([this.btnStart]);
    clock.start(Work.currentWork);
    this.reveal([this.btnStop, this.btnPause]);
    ActivityTracker.startControl();
  }
  private onRestart(ev: Event){
    this.mask([this.btnRestart]);
    clock.restart();
    this.reveal([this.btnStop, this.btnPause]);
    ActivityTracker.startControl();
  }

  /**
   * Pour stopper le travail. C'est cette méthode qui produit
   * l'enregistrement du temps de travail.
   */
  private onStop(ev: MouseEvent | undefined){
    this.mask([this.btnStop, this.btnPause, this.btnRestart]);
    this.reveal([this.btnStart]);
    ActivityTracker.stopControl();
    // console.log("ev", ev);
    if (ev && (ev.shiftKey || ev.metaKey)) {
      Flash.notice(t('times.dont_add_and_save'));
    } else {
      const workTime: number =  ActivityTracker.inactiveUserCorrection(clock.stop());
      Work.addTimeToCurrentWork(Math.round(workTime / 60));
    }
  }

  private onPause(ev: Event | undefined){
    this.mask([this.btnPause]);
    this.reveal([this.btnRestart]);
    ActivityTracker.stopControl();
    clock.pause();
  }


  /**
   * Pour affecter le thème (dark ou light)
   */
  public setUITheme(theme: string) {
    document.body.className = theme;
  }

  /**
   * Pour modifier le fond (en cas d'alerte)
   */
  public setBackgroundColorAt(color: string) {
    document.body.style.backgroundColor = color;
  }
  public resetBackgroundColor(){
    document.body.style.backgroundColor = '';
  }

  SECTIONS = ['work', 'help', 'prefs', 'editing']
  /**
   * To display one section
   */
  public toggleSection(name: string){
    this.SECTIONS.forEach(section => {
      if ( name === section ) {
        this.openSection(section);
      } else {
        this.closeSection(section);
      }
    });
  }

  /**
   * Pour basculer sur l'aide
   */
  public toggleHelp(){
    if (this.isSectionOpen('help')) {
      this.toggleSection('work');
    } else {
      this.toggleSection('help');
    }
  }

  private isSectionOpen(name: string): boolean {
    return !DGet('section#'+name).classList.contains('hidden')
  }
  /**
   * Quatre fonctions pour masquer ou montrer des objets
   * 
   * ATTENTION : eList n'est pas une liste d'HTMLElements mais une
   * list d'instance possédant un obj.
   */
  public mask(eList: any[]){
    eList.forEach(e => e.obj.classList.add('hidden'));
  }
  public reveal(eList: any[]){
    eList.forEach(e => e.obj.classList.remove('hidden'));
  }

  public showButtons(states: {[x: string]: boolean}):void {
    console.log("[ui.showButtons] states", states);
    this.buttons.forEach((bouton: Button) => bouton.setState(states[bouton.id] as boolean));
  };
  
  public closeSection(name: string){
    DGet('section#'+name).classList.add('hidden');
  }
  public openSection(name: string){
    DGet('section#'+name).classList.remove('hidden');
  }

  /**
   * Fonction appelée lorsque l'user n'est plus en activité, soit
   * parce qu'il l'a confirmé en cliquant le bouton lui demandant
   * s'il était toujours en activité, soit parce qu'il n'a pas
   * répondu à cette demande. Dans ce cas, on arrête le chronomètre
   * et on retire le temps depuis la dernière vérification de l'ac-
   * tivité.
   * 
   * On ne peut pas être sûr que la dernière tranche de vérification
   * a été travaillé ou non, on coupe la poire en deux (donc on va
   * retirer la moitié de la durée entre deux vérification).
   * 
   * @api
   */
  public onForceStop(){ 
    this.onStop(undefined) 
  }

  public onForcePause(){
    this.onPause(undefined);
  }

  // Méthode appelée pour changer de tâche courante
  private async onChange(ev: Event){
    ev && stopEvent(ev);
    const curwork: Work = Work.currentWork;
    const result = await postToServer('/work/change', {process: 'UI.onChange', workId: curwork.id});
    if ( result.ok ) {
      if (await Work.getCurrent({but: curwork.id})) {
        (this.btnChange as Button).hide();
      }
    }
    return false;
  }

  // Pour lancer le script de démarrage
  private async onRunScript(ev: Event){
    ev && stopEvent(ev);
    const curwork: Work = Work.currentWork;
    const result = await postToServer('/tool/run-script', {workId: curwork.id, script: curwork.script});
    if ( result.ok ) { Flash.success(t('script.ran_successfully')) }
    return false;
  }

  // Pour ouvrir le dossier défini
  private async onOpenFolder(ev: Event){
    ev && stopEvent(ev);
    const curwork: Work = Work.currentWork;
    const result = await postToServer('/tool/open-folder', {workId: curwork.id, folder: curwork.folder});
    if ( result.ok ) { Flash.success(t('folder.opened_in_finder')) }
    return false;
  }
  
  private btnStart?: Button;
  private btnRestart?: Button;
  private btnPause?: Button;
  private btnStop?: Button;
  private btnChange?: Button;
  private btnRunScript?: Button;
  private btnOpenFolder?: Button;


  private get buttons(){
    this._buttons || this.instancieButtons();
    return this._buttons;
  }; private _buttons!: Button[];

  private instancieButtons(){
    console.log("-> Création des boutons");
    this._buttons = this.DATA_BUTTONS.map((bdata: any[]) => {
      let id: string, name: string, onclick: Function, hidden: boolean, row: 1 | 2, title: string;
      [id, name, onclick, hidden, row, title] = bdata;
      (this as any)[`btn${id}`] = new Button({id, name, onclick, hidden, row, title}).build();
      return (this as any)[`btn${id}`];
    });
  } 

  private get DATA_BUTTONS(): [string, string, Function, boolean, 1 | 2, string][]{
    return this.databuts || (this.databuts = this.getDataButtons()) }
  private databuts!: [string, string, Function, boolean, 1 | 2, string][];

  private getDataButtons(): [string, string, Function, boolean, 1 | 2, string][]{
    return [
      ['runScript', t('ui.button.run'), this.onRunScript.bind(this), false, 2,
        t('ui.text.to_run_script')],
      ['openFolder', t('ui.button.open_project'), this.onOpenFolder.bind(this), false, 2,
        t('ui.text.to_open_project_folder')],
      ['Change', t('ui.button.change'), this.onChange.bind(this), false, 2,
        t('ui.text.to_choose_another_work')],
      ['Stop', t('ui.button.stop'), this.onStop.bind(this), true, 1, 
        t('ui.text.to_stop_and_next')],
      ['Pause', t('ui.button.pause'), this.onPause.bind(this), true, 1,
        t('ui.text.to_pause_the_work')],
      ['Start', t('ui.button.start'), this.onStart.bind(this), false, 1,
        t('ui.text.to_start_working_on_work')],
      ['Restart', t('ui.button.restart'), this.onRestart.bind(this), true, 1,
        t('ui.text.to_restart_work_on_work')]
      ];
  }
}

class Button {

  public static get container(): HTMLDivElement{
    return this._container || ( this._container = document.body.querySelector('div#buttons-container') as HTMLDivElement)
  }; private static _container: HTMLDivElement;

  private _obj!: HTMLButtonElement;

  constructor(
    private data: ButtonType
  ){}

  public setState(state: boolean){
    this[state ? 'show' : 'hide']();
  }

  onClick(ev: MouseEvent){
    this.data.onclick(ev);
    return stopEvent(ev);
  }

  build(){
    const o: HTMLButtonElement = document.createElement('BUTTON') as HTMLButtonElement;
    o.innerHTML = this.data.name;
    o.id = `btn-${this.id}`;
    o.setAttribute('title', this.data.title)
    o.addEventListener('click', this.onClick.bind(this));
    (Button.container.querySelector(`div#row${this.data.row}`) as HTMLDivElement).appendChild(o);
    this._obj = o;
    // Réglage du bouton
    if (this.data.hidden) { this.hide(); }
    else {this.show(); }
    return this;  // chainage
  }
  show(){
    this.obj.classList.remove('hidden');
  }
  hide(){
    this.obj.classList.add('hidden');
  }

  public get id(){ return this.data.id; }
  private get obj(){return this._obj;}
}




export const ui = UI.getInst();