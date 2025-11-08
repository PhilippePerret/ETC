import type { ButtonType } from "../shared/types";
import { t } from '../shared/Locale';
import { stopEvent } from "../../public/js/dom";

/**
 * To build quickly app panels
 */
export class Panel {
  private obj!: HTMLDivElement;
  private btnOk!: HTMLButtonElement;
  private fldContent!: HTMLDivElement;
  private built: boolean = false;

  constructor(
    private data: {
      title: string,
      buttons: 'ok' | ButtonType[]
      content: string;
    }
  ){}

  setContent(contenu: string){
    this.fldContent.innerHTML = contenu;
  }

  onOk(ev: MouseEvent){
    stopEvent(ev);
    this.close();
  }

  show(){
    this.built || this.build()
    this.obj.classList.remove('hidden');
  }

  close(){
    this.obj.classList.add('hidden');
  }

  build(){
    const o = document.createElement('DIV');
    o.classList.add(...['panel', 'hidden']);
    const tit = document.createElement('DIV');
    tit.classList.add('panel-title');
    tit.innerHTML = this.data.title;
    o.appendChild(tit);
    const c = document.createElement('DIV');
    c.classList.add('panel-content');
    c.innerHTML = this.data.content;
    o.appendChild(c);
    this.fldContent = c as HTMLDivElement;
    const f = document.createElement('FOOTER');
    o.appendChild(f);
    this.btnOk = document.createElement('BUTTON') as HTMLButtonElement;
    this.btnOk.innerHTML = t('ui.button.ok');
    this.btnOk.className = 'fleft';
    f.appendChild(this.btnOk);
    document.body.appendChild(o);
    this.obj = o as HTMLDivElement;

    this.built = true
    this.observe();
  }

  private observe(){
    this.btnOk.addEventListener('click', this.onOk.bind(this));
  }
}