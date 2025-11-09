import { Work } from "./work";
import { ui } from "./ui";
import { postToServer } from "./utils";
import { Dialog } from "./Dialog";
import { t } from '../shared/Locale';
import log from '../shared/log';

export class ActivityTracker /* CLIENT */ {

  private static CHECK_INTERVAL = 15 * 60 * 1000;
  // private static CHECK_INTERVAL = 3 * 60 * 1000; // test avec 1 minute
  private static timer: NodeJS.Timeout | undefined;
  private static inactiveUser: boolean;

  public static startControl(){
    this.timer = setInterval(this.control.bind(this), this.CHECK_INTERVAL)
  }

  public static stopControl(){
    if (this.timer) {
      clearInterval(this.timer);
      delete this.timer;
    }
  }

  public static inactiveUserCorrection(workingTime: number): number {
    console.log("Working time : ", workingTime);
    if ( this.inactiveUser ) {
      console.log("Working time rectifié : ", workingTime - ((this.CHECK_INTERVAL / 2) / 1000))
      return workingTime - ((this.CHECK_INTERVAL / 2) / 1000);
    } else {
      return workingTime;
    }
  }

  /**
   * Fonction qui appelle à intervalles réguliers le checker
   * pour voir si le travailleur travaille encore.
   * Dans le cas contraire, il lui affiche une fenêtre pour
   * confirmer ou dénier qu'il travaille encore.
   */
  private static async control(){
    log.info('-> ActivityTracker.control')
    const result = await postToServer('/work/check-activity',{
        projectFolder: Work.currentWork.folder,
        lastCheck: Date.now() - this.CHECK_INTERVAL
    });
    log.info(`Retour de control: ${JSON.stringify(result)}`);
    if (result.ok) {
      if (false === result.isActive) {
        // Le travailleur n'est pas actif, il faut lui demander
        // ce qu'il fait.
        log.info('--- Activer la fenêtre de demande d’activité ---');
        // @ts-ignore
        window.electronAPI.bringToFront();
        this.dialogActivity.show();
      }
    }
  }

  /**
   * Fonction qui reçoit le résultat de la demande de continuité
   * d'activité lorsque l'inactivité a été détectée.
   * Soit l'user dit qu'il est toujours sur le travail (rien à
   * faire), soit il dit qu'il a terminé (on force le stop) soit
   * il ne répond rien et l'interface est alors mise en pause.
   * 
   * @param state État choisi ou automatique
   */
  public static onChooseActivityState(state: 'actif' | 'force_stop' | 'force_pause'): void {
    switch(state) {
      case 'actif': 
        break;
      case 'force_pause':
        ui.onForcePause(); break;
      case 'force_stop':
        ui.onForceStop(); break;
    }
  }

  private static _dialactiv: Dialog;
  private static get dialogActivity(){
    return this._dialactiv || (this._dialactiv = new Dialog({
      title: t('ui.title.confirmation_required'),
      message: t('ui.text.are_you_still_working'),
      buttons: [
        {text: t('ui.button.not_anymore'), role: 'cancel', onclick: this.onChooseActivityState.bind(this, 'force_stop')},
        {text: t('ui.button.yes_still'), role: 'default', onclick: this.onChooseActivityState.bind(this, 'actif')}
      ],
      timeout: 120,
      onTimeout: this.onChooseActivityState.bind(this, 'force_pause'),
      icon: 'images/icon.png'
    }))
  }
}
