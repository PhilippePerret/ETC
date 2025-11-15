import { DGet, stopEvent } from "../../public/js/dom";
import type { RecType } from "../shared/types";
import { Panel } from "./Panel";
import { postToServer } from "./utils";

interface TacheType {
  id: number;
  content: string;
  deadline: number; // getTime
}

/**
 * Module permettant de gérer une toodo list simple,
 * des tâches à faire 
 */
class TodoList { /* singleton todolist */

  private taches!: TacheType[];
  private table!: {[x: number]: TacheType};
  public isReady: boolean = false;

  async open(){
    this.panel.show();
  }

  /**
   * On initialise la todolist avec ses données initiales
   */
  public init(taches: RecType[], order: number[]){
    this.buildPanel();
    this.taches = taches as TacheType[];
    this.table = {};
    this.taches.forEach((tdata: TacheType) => {
      const tache = new Tache(this, tdata);
      Object.assign(this.table, {[tache.id]: tache});
    })
    const sorted_taches: Tache[] = [];
    //@ts-ignore
    order.forEach((tid: number) => sorted_taches.push(this.table[tid]));
    this.peuplePanel(sorted_taches);
    this.observe();
  }

  private observe(){
    // Le bouton principal
    DGet('button.btn-todolist').addEventListener('click', this.open.bind(this));
  }

  public get panel(){return this._panel}
  private _panel!: Panel;

  public get content(){
    return this._content || (this._content = this.panel.fldContent)
  }
  private _content!: HTMLDivElement;

  private onClickSave(ev: Event){
    ev && stopEvent(ev);
    // Todo : Récupérer toutes les données
    this.saveAll();
  }

  private async saveAll(){
    const retour = await postToServer('/todolist/save-all', {
      process: 'TodoList.save',
      taches: this.taches
    });
  }
  private onClickFinir(ev: Event){
    ev && stopEvent(ev);
    this.panel.close();
  }

  private peuplePanel(sorted_taches: Tache[]) {
    sorted_taches.forEach((t: Tache) => t.build());
    this.isReady = true;
  }

  private buildPanel(): void{
    const panel = new Panel({
      id: 'todolist',
      title: "Todo liste",
      buttons: [
        {text: "Finir", onclick: this.onClickFinir.bind(this), role: 'cancel', class: 'fleft'},
        {text: "Enregistrer", onclick: this.onClickSave.bind(this), role: 'default'}
      ],
      content: ""
    })
    panel.build();
    this._panel = panel;
  }

  private constructor(){}
  private static _sing: TodoList;
  public static singleton(){return this._sing || (this._sing = new TodoList())}
}

class Tache {
  private panel: HTMLDivElement;
  public id: number;
  public obj!: HTMLDivElement;

  constructor(
    private owner: TodoList,
    private data: TacheType
  ){
    this.panel = this.owner.content;
    this.id = data.id;
  }

  public build(){
    const o = document.createElement('DIV') as HTMLDivElement;
    o.className = 'tache';
    const cb = document.createElement('INPUT') as HTMLInputElement;
    o.appendChild(cb);
    cb.type = 'checkbox';
    cb.id = `tache-${this.id}-cb`
    const lab = document.createElement('LABEL') as HTMLLabelElement;
    o.appendChild(lab);
    lab.setAttribute('for', cb.id);
    lab.innerHTML = this.data.content;
    this.panel.appendChild(o);
    this.obj = o;
  }

}



const todolist = TodoList.singleton();
export default todolist;