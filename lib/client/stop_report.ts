import type { Work } from "./work";
import { listenBtn } from "./utils";
import { DGet, stopEvent } from "../../public/js/dom";
import { Flash } from "../../public/js/flash";
import { t } from '../shared/Locale';

/**
 * RAPPORT DE FIN DE TÂCHE (ET DE DÉBUT DE TÂCHE FUTURE)
 * Passage de témoin
 * Bâton de relais — Relay Baton
 * 
 * Avant d'aller enregistrer le temps après un STOP de la tâche,
 * on présent à l'utilisateur une fenêtre qui lui permet d'indiquer
 * ce qu'il y aura à faire au prochain cycle sur la tâche, pour
 * reprendre le travail plus rapidement et plus efficacement.
 * 
 * C'est cette partie qui gère ça, en permettant même de proposer
 * des questions à l'utilisateur pour savoir ce qu'il doit écrire
 * (car ce n'est jamais facile). Par exemple, d'indique le nom du
 * fichier qui sera consulté en priorité par rapport à la tâche
 * à poursuivre ou à commencer.
 */
export class EndWorkReport {

  private inited: boolean = false;

  constructor(
    private work: Work
  ){}

  /**
   * @api
   * 
   * Ouvre la boite de rapport de fin de travail pour le remplir.
   * 
   */
  public async writeReport(){
    return new Promise((ok, ko) => {
      this.ok = ok; 
      this.ko = ko;
      this.open();
    })
  }
  private ok!: Function;
  private ko!: Function;

  private open(){
    this.inited || this.init();
    this.reset();
    this.show();
  }
  private close(){
    this.hide();
  }


  /**
   * Pour enregistrer le rapport 
   * (normalement, ça doit être fait avec l'enregistrement du temps)
   */
  onSave(ev: MouseEvent){
    this.close();
    this.ok(this.getData());
    ev && stopEvent(ev);
    return false;
  }

  onDontSave(ev: MouseEvent){
    this.close();
    this.ok(false);
    ev && stopEvent(ev);
    return false;
  }

  /**
   * Applique le template dans le champ de rédaction.
   * 
   * TODO Plus tard, pouvoir définir des templates soi-même et les 
   * choisir.
   */
  onTemplate(ev: MouseEvent): boolean {
    if ( this.contentField.value.length ) {
      Flash.error(t('report.empty_content'))
    } else {
      // TODO Pouvoir choisir parmi les templates proposé
      this.setContent(this.TEMPLATES[0] as string);
    }
    return ev && stopEvent(ev);
  }

  /**
   * Relève les données à enregistrer :
   *  - texte du rapport
   *  - désactivation ou non du travail
   */
  private getData(){
    return {
      content: this.contentField.value.trim(),
      changelog: this.changedlogField.value.trim(),
      desactivate: (this.desactiveField.checked === true)
    }
  }

  private setContent(s: string){this.contentField.value = s;}

  private init(){
    this.contentField.setAttribute('placeholder', t('ui.text.description_stop_report_modele'));
    DGet('#ETR-explication', this.obj).innerText = t('ui.text.description_stop_report');
    this.observeButtons();
  }
  private observeButtons(){
    listenBtn('etr-save', this.onSave.bind(this));
    listenBtn('etr-dont-save', this.onDontSave.bind(this));
    listenBtn('etr-template', this.onTemplate.bind(this));
  }
  private reset(){
    this.contentField.value = '';
    this.changedlogField.value = '';
  }

  /**
   * Méthode affichant la fenêtre pour entrer le rapport
   */
  private show(){
    this.obj.classList.remove('hidden');
  }
  private hide(){
    this.obj.classList.add('hidden');
  }

  private id!: string;
  

  private get contentField(){
    return this._contfield || (this._contfield = DGet('textarea#ETR-report', this.obj));
  }
  private get changedlogField(){
    return this._logfield || (this._logfield = DGet('textarea#ETR-changelog', this.obj));
  }
  private get desactiveField(){
    return this._desactfield || (this._desactfield = DGet('input#ETR-desactive-work', this.obj));
  }

  private get obj(){
    return this._obj || (this._obj = DGet('div#ETR-container'))
  }


  private _contfield!: HTMLTextAreaElement;
  private _logfield!: HTMLTextAreaElement;
  private _desactfield!: HTMLInputElement;
  private _obj!: HTMLDivElement;



  TEMPLATES = [
    `
    *(Taking up the baton for the next work session)*
    ## Main Goal : 

    ## Main Tasks :
    - 
    -
    -

    ## Main Usefull Files :
    - 
    - 
    - 

    ## Remarque
    *(mind about this)*

    ## Config Note
    *(note about curren config or situation)*

    `
  ]
}