import type { ButtonType } from "../shared/types";
import { stopEvent } from "../../public/js/dom";

/**
 * To build quickly app panels
 */
export class Panel {
  private obj!: HTMLDivElement;
  private btnOk!: HTMLButtonElement;
  public fldContent!: HTMLDivElement;
  private built: boolean = false;

  constructor(
    private data: {
      id?: string;
      title: string;
      buttons: 'ok' | string | ButtonType[];
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
    if (this.data.id) { o.id = this.data.id }
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
    if ( 'string' === typeof this.data.buttons) {
      this.btnOk = document.createElement('BUTTON') as HTMLButtonElement;
      this.btnOk.innerHTML = this.data.buttons as string;
      this.btnOk.className = 'fleft';
      f.appendChild(this.btnOk);
      this.btnOk.addEventListener('click', this.onOk.bind(this));
    } else {
      // C'est donc une liste de boutons
      this.data.buttons.forEach((btn: ButtonType) => {
        const b = document.createElement('BUTTON') as HTMLButtonElement;
        b.innerHTML = btn.text as string;
        if ( btn.class ) {b.className = btn.class;}
        f.appendChild(b);
        if ( 'function' === typeof btn.onclick) {
          //@ts-ignore
          b.addEventListener('click', btn.onclick);
        } else {
          //@ts-ignore
          b.addEventListener('click', this[btn.onclick].bind(this))
        }
      });
    }

    document.body.appendChild(o);
    this.obj = o as HTMLDivElement;

    this.built = true
    this.observe();
  }

  private observe(){
  }
}