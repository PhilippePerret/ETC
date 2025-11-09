import log from '../shared/log';
import { loc, t } from '../shared/Locale';
import prefs from './prefs';
import { Work } from './work';
import { ui } from './ui';
import { Flash } from '../../public/js/flash';
import { DGet } from '../../public/js/dom';
import { help } from './help';
import { editor } from './editing';

class Client { /* singleton */


  public async init(){
    log.info("=== INITIALISATION CLIENT ===");

    await this.initObjet(prefs, 'Prefs');
    await this.initObjet(loc, 'Locale', prefs.getLang());
    this.initObjetSync(ui, 'UI', prefs.getSavedData());
    await this.initObjet(Work, 'Work');
    this.initObjetSync(editor, 'Editor');
    this.initObjetSync(help, 'Help');

    Flash.notice(`${t('app.is_ready')} <span id="mes123">(${t('help.show')})</span>`)
    DGet('span#mes123').addEventListener('click', 
      help.show.bind(help, ['resume_home_page']),
      {once: true, capture: true}
    )
  }
  
  public onRespondYes(){ console.log("Il a répondu oui")}
  public onRespondNo(){ console.log("Il a répondu non")}


  private initObjetSync(objet: any, name: string, args?: any){
    log.info(`${name} init…`);
    let res; 
    if (args) {res = objet.init(args)}
    else {res = objet.init()}
    if (res) { log.info('  -- ok')}
    else { log.warn(`Problem with ${name} initialisation`)}
  }
  private async initObjet(objet: any, name: string, args?: any){
    log.info(`${name} init…`);
    let res; 
    if (args) {res = await objet.init(args)}
    else {res = await objet.init()}
    if (res) { log.info('  -- ok')}
    else { log.warn(`Problem with ${name} initialisation`)}
  }

  private static inst: Client;
  private constructor(){}
  public static getInst(){return this.inst || (this.inst = new Client())}
}

const client = Client.getInst();
client.init();