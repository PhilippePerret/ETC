/**
 * Une librairie pour "dialoguer" avec l'utilisateur.
 * 
 * Affiche une belle fenêtre macOs-like pour permettre à l'user de
 * faire un choix ou confirmer une action.
 * 
 * La fenêtre fonctionne en mode synchrone (show) ou asynchrone
 * (showAsync).
 * 
 * MODE SYNCHRONE
 * --------------
 * On définit les données comme ci-dessous en précisant quelle 
 * fonction devra être invoquée par quel bouton.
 * (onclick: <Function>)
 * 
 * Et on fait : 
 * 
 *  new Dialog({...}).show([...]);
 *  // (on passe tout de suite ici)
 * 
 * MODE ASYNCHRONE
 * ---------------
 * On définit les données comme ci-dessous en précisant quelle
 * VALEUR devra être renvoyée par quel bouton
 * (onclick: <Any value>)
 * 
 * Et on fait :
 * 
 *  const retour: any = await (new Dialog({...}).showAsync([...]))
 *  if (retour = ....) { .... }
 * 
 * Si une réponse (answer) est attendue, elle sera renvoyée en deuxième argument
 * donc le retour recevra [<valeur bouton>, <réponse données>]
 * 
 * 
 * Usage
 * -----
 *  
 *  // Définition du dialogue
 *  const data = {
 *    id: "identifiant unique optionnel",
 *    message: "Le message affiché avec _0_ comme texte variable",
 *    title: "Le titre du message",
 *    buttons: [ // boutons dans l'ordre
 *      {text: "OK", onclick: <methode to call | any value>[, role: 'default'|'cancel']},
 *    ],
 *    icon: 'images/icon.png',
 *    timeout: <nombre secondes>, // si la fenêtre doit se fermer toute seule
 *    onTimeout: <Function> // ce qu'il faut faire en cas de timeout
 *  }
 * 
 * L'idée est de faire des fenêtres réutilisables. En précisant l'id, on
 * peut enregistrer une fenêtre et la rappeler par Dialog.get(id).
 * On met les nouvelles valeurs dans le premier argument de show ou 
 * showAsync pour modifier le dialogue.
 *  const dial = new Dialog(data);
 *  dial.show(["valeur pour _0_", "valeur pour _1_", etc.])
 *  // Attend et traite la réponse en fonction de +data+
 * 
 */
import log from '../shared/log';
import type { RecType, ButtonType } from '../shared/types';
import type { KeyboardEvent } from 'react';
import { DGet, stopEvent } from '../../public/js/dom';

export class Dialog {

  private static items: {[x: string]: Dialog} = {};
  /**
   * Retourne une fenêtre de dialogue enregistrée
   * 
   * Mettre un id dans les données pour l'enregistrer
   * Mettre les nouvelles valeurs en appelant show ou showAsync pour
   * l'adapter à la situation.
   * 
   * @param dialogId Identifiant de la fenêtre Dialog enregistrée
   */
  public static get(dialogId: string){
    return this.items[dialogId];
  }

  private static register(dialog: Dialog) {
    Object.assign(this.items, {[dialog.id as string]: dialog});
  }

  // ==== INSTANCE ====

  private _built: boolean = false;
  private fallbackOnTimeout: Function = ()=>{}
  private timer?: number;
  private cancelFunction?: Function; 
  private defaultFunction?: Function;
  private box!: HTMLDivElement; // La boite principale
  private title?: HTMLDivElement;
  private message!: HTMLDivElement;
  public get id(){return this.data.id }

  constructor(
    private data:{
      id?: string,
      title?: string,
      message: string,
      answer?: string,
      defaultAnswer?: string, // pour une demande
      buttons: ButtonType[],
      timeout?: number,
      onTimeout?: Function,
      icon: string
    }
  ){
    if (this.data.id) { Dialog.register(this)}
  }

  show(values: string[] | undefined = undefined){
    log.info('-> Dialog.show');
    this._built || this.build();
    const detempCode = this.detemplatize(values);
    this.box.classList.remove('hidden');
    this.courtcircuiteKeyboard();
    // On met en route un timeout s'il le faut
    if (this.data.timeout){
      this.timer = setTimeout(this.onTimeout.bind(this), this.data.timeout * 1000);
    }
    log.info('<- Dialog.show');
  }

  async showAsync(values: string[] | undefined = undefined): Promise<any> {
    log.info('-> Dialog.showAsync');
    return new Promise((resolve: Function, _reject: Function) => {
      this.resolve = resolve;
      // this.reject = reject;
      this.data.buttons.forEach((button: ButtonType) => {
        if ('function' !== typeof button.onclick){
          button.onclick = this.onClickButtonWithValue.bind(this, button.onclick);
        }
      });
      this.show(values);
    })
  }
  private resolve?: Function;
  // private reject?: Function;

  // Quand onclick est défini par une valeur plutôt que par une
  // fonction
  private onClickButtonWithValue(value: any, ev: MouseEvent){
    if (this.data.answer) {
      value = [value, DGet('input.dialog-answer', this.box).value];
    }
    (this.resolve as Function)(value);
  }

  private close(){
    if (this.timer) {
      clearTimeout(this.timer);
      delete (this as any).timer;
    }
    this.decourcircuiteKeyboard();
    this.box.classList.add('hidden');
  }

  onClickButton(callback: Function | undefined, ev?: MouseEvent){
    ev && stopEvent(ev);
    this.close();
    let answer = undefined;
    if (this.data.answer){ answer = DGet('input.dialog-answer', this.box) }
    return callback && callback(answer);
  }
  // Par raccourci clavier
  onCancel(){return this.onClickButton(this.cancelFunction)}
  onDefault(){return this.onClickButton(this.defaultFunction)}

  // Le focus et le blur dans le champ de réponse doit désactiver les raccourcis
  // clavier
  onFocusInAnswer(ev: Event){
    this.decourcircuiteKeyboard()
  }
  onBlurFromAnswer(ev: Event){
    this.courtcircuiteKeyboard()
  }

  courtcircuiteKeyboard(){
    this._oldKeyDownFunction = (window as any).onkeydown;
    (window as any).onkeydown = (ev: KeyboardEvent) => {
      if (ev.code === 'Escape') {
        this.onCancel();
      } else if (ev.code === 'Enter') {
        this.onDefault();
      } 
      return false;
    }
  }
  decourcircuiteKeyboard(){
    (window as any).onkeydown = this._oldKeyDownFunction;
  }
  private _oldKeyDownFunction?: Function;


  onTimeout(ev: Event){
    this.close();
    (this.data.onTimeout || this.fallbackOnTimeout)();
  }

  detemplatize(values: string[] | undefined): void {
    if (values === undefined) {
      return;
    } else {
      values.forEach((value: string, i: number) => {
        const reg = new RegExp(`_${i}_`, 'g');
        if (this.title) {
          this.title.innerHTML = this.title.innerHTML.replace(reg, value);
        }
        this.message.innerHTML = this.message.innerHTML.replace(reg, value);
      });
    }
  }

  build(){
    const o = document.createElement('DIV') as HTMLDivElement;
    o.className = 'dialog hidden';
    if (this.data.title) {
      const t = document.createElement('DIV');
      t.className = 'dialog-title';
      t.innerHTML = this.formatted_title;
      o.appendChild(t);
      this.title = t as HTMLDivElement;
    }
    const m = document.createElement('DIV');
    m.className = 'dialog-message';
    m.innerHTML = this.formatted_message;
    o.appendChild(m);
    this.message = m as HTMLDivElement;
    const i = document.createElement('IMG');
    i.className = 'dialog-icon';
    o.appendChild(i);
    i.setAttribute('src', this.data.icon);
    // S'il faut donner une réponse
    if (this.data.answer) {
      const a = document.createElement('INPUT') as HTMLInputElement;
      a.className = 'dialog-answer';
      a.type = 'text';
      a.value = this.data.answer;
      o.appendChild(a);
      a.addEventListener('focus', this.onFocusInAnswer.bind(this));
      a.addEventListener('blur', this.onBlurFromAnswer.bind(this));
    }
    const bts = document.createElement('DIV');
    bts.className = 'buttons';
    o.appendChild(bts);
    this.data.buttons.forEach((bouton: RecType) => {
      const b = document.createElement('BUTTON');
      b.innerHTML = bouton.text;
      b.addEventListener('click', this.onClickButton.bind(this, bouton.onclick));
      if (bouton.role === 'default') {
        this.defaultFunction = bouton.onclick;
        b.classList.add('default');
      } else if (bouton.role === 'cancel') {
        this.cancelFunction = bouton.onclick;
        b.classList.add('cancel');
      }
      bts.appendChild(b);
    })
    this.box = o;
    document.body.appendChild(this.box);
    this._built = true;
  }

  private get formatted_message(): string{
    return this.commonReplacements(this.data.message);
  }
  private get formatted_title(): string {
    return this.commonReplacements(this.data.title as string);
  }

  private commonReplacements(str: string): string {
    return str
      .replace(/'/g, '’')
      .split("\n\n")
      .map(s => `<p>${s}</p>`)
      .join('');
  } 
}