import { clock } from "./Clock";
import type { PrefsDataType, RecType } from "../shared/types";
import { DGet, stopEvent } from "../../public/js/dom";
import { Flash } from "../../public/js/flash";
import { ui } from "./ui";
import { listenBtn, postToServer } from "./utils";
import { t } from '../shared/Locale';
import { tools } from "./tools";
import log from '../shared/log';

export class Prefs { /* singleton */

  private data!: PrefsDataType;
  private fieldsReady: boolean = false;

  private static inst: Prefs;
  private constructor(){}
  public static singleton(){return this.inst || (this.inst = new Prefs())}

  public async init(): Promise<boolean> {
    const retour = await postToServer('/prefs/load', {process: 'Prefs.init'});
    if (retour.ok) {
      log.info('Prefs loaded', retour.prefs);
      this.setData(retour.prefs);
      this.observeButtons();
    }
    return retour.ok;
  }

  public getLang(){ return this.data.lang || 'en' } /* <=========== TODO */
  public getSavedData(){ return this.data; }
  
  /**
   * Fonction appelée pour sauver les données de préférence
   */
  async onSave(ev: MouseEvent){
    stopEvent(ev);
    const result: RecType = await postToServer('/prefs/save', this.getData());
    // console.log("result = ", result);
    if (result.ok) {
      this.close();
      Flash.success(t('prefs.saved'))
    }
    return false;
  }

  onChangePref(prop: string, ev: Event){
    const value = this.getValue(prop);
    switch(prop) {
      case 'clock':
        clock.setClockStyle(value); break;
      case 'counter':
        clock.setCounterMode(value); break;
      case 'theme':
        ui.setUITheme(value); break;
      default:
        // Nothing to do
    }
  }
  onOpen(ev: MouseEvent){
    tools.build(); // first time only
    this.open();
    return stopEvent(ev);
  }
  onClose(ev: MouseEvent){
    this.close();
    return stopEvent(ev);
  }


  public setData(data: PrefsDataType){
    // console.log("Data prefs", data);
    this.data = data;
    this.fieldsReady || this.observeFields();
    Object.entries(this.data).forEach(([k , v]) => {
      this.setValue(k, v);
    });
  }
  private getData(){
    Object.entries(this.data).forEach(([k , _v]) => {
      Object.assign(this.data, {[k]: this.getValue(k)});
    });
    return this.data;
  }

  public getValue(prop: string) {
    switch(prop) {
      case 'random':
        return this.field('random').checked;
      default:
        return this.field(prop).value;
    }
  }
  private setValue(prop: string, value: string | boolean){
    switch(prop) {
      case 'random':
        this.field('random').checked = value; break;
      default:
        this.field(prop).value = value;
    }
  }

  private field(key: string){
    return DGet(`#prefs-${key}`) || console.error(t('error.unfound_field', [`prefs-${key}`]));
  }

  private close(){ 
    ui.toggleSection(this.lastSection);
  }
  private open(){
    this.lastSection = String(ui.currentSection);
    ui.toggleSection('prefs');
  }
  private lastSection!: string;

  private observeButtons(){
    listenBtn('prefs', this.onOpen.bind(this));
    listenBtn('close-prefs', this.onClose.bind(this));
    listenBtn('save-prefs', this.onSave.bind(this));
  }
  private observeFields(){
    Object.keys(this.data).forEach((prop: string) => {
      // console.log("Traitement de la propriété '%s'", prop);
      this.field(prop).addEventListener('change', this.onChangePref.bind(this, prop));
    });
    this.fieldsReady = true;
  }

}
const prefs = Prefs.singleton();
export default prefs;