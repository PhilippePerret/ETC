import { WORK_PROPS, type RecType, type WorkType } from "../shared/types";
import { DGet } from "../../public/js/dom";
import { Flash } from "../../public/js/flash";
import { ui } from "./ui";
import { listenBtn, listenChange, postToServer } from "./utils";
import { t } from '../shared/Locale';
import { Work } from "./work";
import log from 'electron-log/renderer';
import { Dialog } from "./Dialog";
import { help } from "./help";
import { CronExpressionParser } from 'cron-parser';
import prefs from "./prefs";

class Editing {

  // Table des travaux au départ de l'édition (pour comparaison
  // avec les modifications effectuées)
  private originalWorks!: {[x: string]: WorkType};
  // Table des données modifiée (ou pas)
  private modifiedWorks!: {[x: string]: WorkType};
  // Table pour mettre les modifications
  private changesetWorks!: {[x: string]: RecType};

  // Ordre initial des travaux
  private originalOrder!: string;
  private modifiedOrder!: string;

  private get section(){ return DGet('section#editing')}
  private get configContainer(){
    return this._configcont || (this._configcont = DGet('#editing-config-container', this.section))
  }; private _configcont!: HTMLDivElement;


  /**
   * @entry
   * 
   * Grande fonction qui remonte les données du fichier de donnée
   * et prépare les formulaires des données de configuration et de 
   * tâches
   */
  public async startEditing(){
    ui.toggleSection('editing');
    const container = this.workContainer;
    container.innerHTML = '';
    const retour: RecType = await postToServer('/works/all', {process: 'Editing.startEditing'});
    if (retour.ok === false ) { return }
    console.log("retour", retour);
    // --- WORKS ---
    const works = retour.works;
    const order = retour.order || works.map((w: WorkType) => w.id);
    this.originalOrder = order.join(':');

    log.info("Works retreaved", works);
    log.info("Order retreaved", order);
    // On fait une table avec les travaux pour pouvoir y avoir
    // accès plus facilement
    this.originalWorks = {};
    works.forEach((w: WorkType) => Object.assign(this.originalWorks, {[w.id]: w}));
    // On crée les formulaires dans l'ordre
    order.forEach((workId: string) => {
      const work: WorkType = this.originalWorks[workId] as WorkType;
      this.createNewTask(work);
    })
    // Indication du nombre de travaux dans le titre
    this.setWorksCount()
  }

  private setWorksCount(){
    const counts = [0, 0];
    this.workContainer.querySelectorAll('select.form-work-active').forEach((s: HTMLSelectElement) => {
      // @ts-ignore
      ++ counts[Number(s.value)];
    })
    DGet('span#works-count', this.section).innerHTML = `on${t('ui.colon')}${counts[1]} / off${t('ui.colon')}${counts[0]}`;
  }

  /**
   * Pour enregistrer les nouvelles données sur les tâches.
   * 
   * Note : la tâche courante a peut-être été modifiée, il faut 
   * l'actualiser.
   */
  private async onSaveData(){
    const collectedData: WorkType[] | null = await this.collectTaskData();

    if ( collectedData === null) /* erreur détectée */ {
      return;
    }
    else if (collectedData.length === 0 && this.orderHasNotChanged() /* no changement */) { 
      Flash.notice(t('work.unchanged'));
      log.info("--- PAS D'ENREGISTREMENT ---");
      return 
    }

    /*s
    console.log("Je dois enregistrer car…");
    console.log("collectedData à enregistrer : ", collectedData);
    console.log("Classement a changé ?", !this.orderHasNotChanged());
    console.log("this.originalOrder:", this.originalOrder);
    console.log("this.modifiedOrder:", this.modifiedOrder);
    // return // Pour le test
    //*/

    /**************************** 
     * ===  ENREGISTREMENT  === *
     ****************************/
    const retour = await postToServer('/works/save', {
      process: 'Editing.onSaveData', 
      works: collectedData,
      order: this.modifiedOrder
    });
    if (retour.ok){ 
      Flash.success(t('work.saved'));
      // On actualise la liste originale
      this.originalWorks = JSON.parse(JSON.stringify(this.modifiedWorks));
      this.originalOrder = String(this.modifiedOrder);
      // On actualise le travail affiché dans le panneau
      // principal (travail courant)
      const curWId = Work.currentWork.id;
      const curWData = (collectedData as WorkType[]).find(w => w.id === curWId);
      const curWork = Work.currentWork;
      curWork.updateData(curWData as WorkType);
      curWork.dispatchData();
    }
  }

  private orderHasNotChanged(){
    return this.originalOrder === this.modifiedOrder;
  }

  /**
   * Fonction qui relève (et renvoie) les données des tâches dans 
   * la liste. Elle vérifie les changements et les valeurs sensibles
   * (identifiants changés ou nouveau, chemins d'accès aux dossiers,
   * au script etc.)
   */
  private async collectTaskData(): Promise<WorkType[] | null> {
    this.retreaveWorksDiff();
    // Étude des problèmes éventuels
    let errorCount = 0;
    for(const [idw, changeset] of Object.entries(this.changesetWorks)){
      errorCount = await this.checkChangeset(changeset as any, errorCount);
    }

    console.info("Fin du check des modifications (%s erreurs)", errorCount);

    // Avant d'afficher les erreurs, on nettoie les champs
    WORK_PROPS.forEach((prop: string) => {
      this.workContainer.querySelectorAll('div.err').forEach((o: HTMLDivElement) => o.innerHTML = '');
      this.workContainer.querySelectorAll('.error').forEach((o: HTMLElement) => o.classList.remove('error'));
    });

    if (errorCount > 0) { 
      // On error
      Flash.error(t('error.data.error_found', [String(errorCount)]), {keep: false});
      // Display error in listing
      for(let [idw, changeset] of Object.entries(this.changesetWorks)){
        if (changeset.count === 0) { continue }
        const form = DGet(`div#work-${idw}`);
        if (form) {
          for(const [prop, errMsg] of Object.entries(changeset.errors)){
            const oprop = DGet(`.form-work-${prop}`, form);
            if (oprop) {
              oprop.classList.add('error');
            } else {
                throw new Error(`[collectTaskData] Unable to find field form-work-${prop} (to set classList)`);
            }

            const oErr = DGet(`.form-work-${prop}-err`, form);
            if (oErr) {
              oErr.innerHTML = errMsg;
            } else {
              throw new Error(`[collectTaskData] Unable to find field form-work-${prop}-err (to set innerHTML)`);
            }
          }
        } else {
          console.error(`[collectTaskData] Unable to find (form) div#work-${idw} (idw = ${idw})…`);
        }
      }

      log.info("--- DES ERREURS SONT SURVENUES ---")
      return null;
    } else {
      // No error
      // -------
      // On ne prend que les travaux modifiés
      return Object.values(this.changesetWorks)
        .filter((ch: RecType) => ch.count > 0)
        .map((ch: RecType) => this.modifiedWorks[ch.id]) as WorkType[];
    }
  }

  /**
   * Méthode qui vérifie la validité des données et consigne toutes
   * les erreurs qui ont pu être trouvées.
   */
  private async checkChangeset(changeset: any, errorCount: number): Promise<number> {
    const idw: string = changeset.id;
    log.info('Check des changements du travail ', idw, changeset.change);
    // console.info('Check des changements du travail ', idw);
    if (changeset.count === 0) { return errorCount } 
    for (const prop of changeset.change) {
      let newValue = (this.modifiedWorks as any)[idw][prop];
      log.info("Check de prop '%s' de nouvelle valeur %s", prop, newValue);
      switch(prop){
      case 'project':
        if (newValue === '') {
          Object.assign(changeset.errors, {'project': t('error.data.undefined_project')})
          ++ errorCount;
        }
        break;
      case 'id':
        if (await this.IDAlreadyExists(newValue)){
          Object.assign(changeset.errors, {'id': t('error.data.id_exists', [newValue])});
          ++ errorCount;
        }
        break;
      case 'folder':
        if (newValue === '') {
          Object.assign(changeset.errors, {'folder': t('error.data.folder_required')})
          ++errorCount;
        } else if (await this.unabledToFindProjectFolder(newValue)) {
          Object.assign(changeset.errors, {'folder': t('error.data.folder_unfound', [newValue])});
          ++ errorCount;
        }
        break;
      case 'script':
        if (newValue !== '') {
          if (await this.unabledToFindScript(newValue)){
            Object.assign(changeset.errors, {'script': t('error.data.script_unfound', [newValue])});
            ++ errorCount;
          } else if (await this.isNotExecutable(newValue)){
            Object.assign(changeset.errors, {'script': t('error.data.script_not_executable', [newValue])});
            ++ errorCount;
          }
        }
        break;
      case 'cron':
        if (newValue !== '') {
          try {
            log.info("Check de newValue", newValue);
            if (newValue.split(' ').length === 5) {
              newValue = `* ${newValue}`;
              (this.modifiedWorks as any)[idw]['con'] = newValue;
            }
            const interval = CronExpressionParser.parse(newValue, {strict: true});
            log.info("Interval", interval.next());
          } catch(error) {
            Object.assign(changeset.errors, {'cron': t('error.data.cron_invalid', [newValue])});
            ++ errorCount;
          }
        }
        break;
      }
    }
    log.info("errorCount end checkChangeset: %i", errorCount);
    return errorCount;
  }

  private async IDAlreadyExists(id: string): Promise<boolean> {
    const retour = await postToServer('/check/id-existence', {workId: id, process: 'Edition.IDAlreadyExists'})
    return retour.ok && retour.idExists;
  }

  private async unabledToFindProjectFolder(folder: string): Promise<boolean> {
    const retour = await postToServer('/check/folder-existence', {process: 'Editing.unfoundProjectFolder', folder: folder}) as any;
    console.log("Retour check folder", retour);
    return retour.ok && retour.folderExists === false;
  }

  private async unabledToFindScript(script: string): Promise<boolean> {
    const retour = await postToServer('/check/file-existence', {process: 'Editing.unabledToFindScript', file: script}) as any;
    return retour.ok && retour.fileExists === false;
  }

  private async isNotExecutable(script: string): Promise<boolean> {
    const retour = await postToServer('/check/file-executable', {process: 'Editing.isNotExecutable', file: script}) as any;
    return retour.ok && retour.isExecutable === false;
  }

  getTaskDataIn(form: HTMLDivElement): WorkType {
    const workData: RecType = {};
    WORK_PROPS.forEach((prop: string) => {
      const field = DGet(`.form-work-${prop}`, form)
      let value: string | number | undefined | null = field.value.trim();
      const dataFieldType = field.dataset.type;
      if (value === 'null' || value === null) {
        value = null;
      } else {
        switch(dataFieldType){
          case 'string': value = String(value); break;
          case 'number': value = Number(value); break;
          case 'number-or-nil': value = value === '' ? null : Number(value); break;
        }
      }
      Object.assign(workData, {[prop]: value});
    })
    return workData as WorkType;
  }

  private get formClone(){
    return this._formtemp || (this._formtemp = this.section.querySelector('.editing-form-work'))
  }

  private createNewTask(work: WorkType): HTMLDivElement {
    const owork:HTMLDivElement = this.formClone.cloneNode(true) as HTMLDivElement;
    this.setFormId(owork, work);
    this.workContainer.appendChild(owork);
    this.peupleWorkForm(owork, work);
    this.observeWorkForm(owork, work);
    owork.classList.remove('hidden');
    if (work.active) owork.classList.remove('off');
    if (work.cron) {
      this.showNextTime(owork.querySelector('input.form-work-cron') as HTMLInputElement);
    }
    return owork;
  }

  private setFormId(form: HTMLDivElement, work: WorkType | string){
    const workId = 'string' === typeof work ? work : work.id;
    form.id = `work-${workId}`;
  }


  private peupleWorkForm(obj: HTMLDivElement, work: WorkType){
    WORK_PROPS.forEach((prop: string) => {
      // console.log("prop: '%s'", prop);
      const field = DGet(`.form-work-${prop}`, obj);
      let value = (work as any)[prop];
      if ( value === 'null') {
        (work as any)[prop] = null; 
        value = null;
      } else if (prop === 'cron') {
        // Petite complication avec le cron : il doit faire
        // 5 valeurs dans l'app mais il doit avoir 6 valeurs
        // (les secondes en plus) pour la libraire.
        if ( value ) { value = value.split(' ').slice(0, 5).join(' ')}
      } else if (prop === 'folder') {
        this.setButtonInvisibility(
          DGet('.btn-open-folder', obj) as HTMLButtonElement,
          !!value
        );
      } else if (prop === 'script') {
        this.setButtonInvisibility(
          DGet('.btn-run-script', obj) as HTMLButtonElement,
          !!value
        )
      }
      field.value = typeof value === 'undefined' ? '' : value;
    });
    DGet('span.work-id-disp', obj).innerHTML = work.id;
  }
  private observeWorkForm(owork: HTMLDivElement, work: WorkType){
    listenBtn('up', this.onUp.bind(this, owork), owork);
    listenBtn('down', this.onDown.bind(this, owork), owork);
    listenBtn('remove', this.onRemove.bind(this, work), owork);
    listenBtn('run-script', this.onRunScript.bind(this, work), owork);
    listenBtn('open-folder', this.onOpenFolder.bind(this, work), owork);
    if (work.id !== Work.currentWork.id) {
      listenBtn('start', this.onSetAsCurrent.bind(this, work), owork);
    } else {
      DGet(`.btn-start`, owork).classList.add('hidden');
    }
    owork.querySelectorAll('input[type="text"]').forEach(o => {
      o.addEventListener('focus', () => {(o as HTMLInputElement).select()})
    })
    const menuActive = DGet('.form-work-active', owork)
    menuActive.addEventListener('change', (ev: Event) => {
      const actif = menuActive.value === '1';
      owork.classList[actif?'remove':'add']('off');
      this.setWorksCount();
    });
    // Au changement du cron
    listenChange('.form-work-cron', this.onChangeCron.bind(this), owork);
    // Change pour le script (masquer/afficher le bouton "run")
    listenChange('.form-work-script', this.onChangeScript.bind(this), owork);
    // Change pour le dossier (mask/reveal 'open' button)
    listenChange('.form-work-folder', this.onChangeFolder.bind(this), owork);
    // Les boutons d'aide
    const btnHelpCron = DGet('sup.to-help-cron', owork);
    help.listenOn(btnHelpCron, 'cron');
  }


  private onUp(owork: HTMLDivElement, ev: MouseEvent){
    if (owork.previousSibling) {
      (owork.parentNode as HTMLDivElement).insertBefore(owork, owork.previousSibling);
    }
  }
  private onDown(owork: HTMLDivElement, ev: MouseEvent){
    if (owork.nextSibling) {
      if (owork.nextSibling.nextSibling) {
        (owork.parentNode as HTMLDivElement).insertBefore(
          owork, owork.nextSibling.nextSibling
        ) 
      } else {
        (owork.parentNode as HTMLDivElement).appendChild(owork);
      }
    }
  }

  /**
   * Retourne le champ HTML (input, select…) de la propriété +prop+
   * du travail +work+
   * 
   * @param work Travail (WorkType) ou identifiant
   * @param prop Propriété à laquelle appartient le champ
   * @returns Le champ HTML
   */
  private fieldOf(work: WorkType | string, prop: string){
    const workId = 'string' === typeof work ? work : work.id;
    return DGet(`.form-work-${prop}`, DGet(`div#work-${workId}`));
  }

  // Function du bouton pour ouvrir le dossier
  private async onOpenFolder(work: WorkType, ev: MouseEvent){
    const folder = this.fieldOf(work, 'folder').value;
    if (folder) {
      postToServer('/tool/open-folder', {process: 'Editing.onOpenFolder', folder: folder}) as any;
    } else {
      Flash.error('error.no_folder_to_open_yet')
    }
  }

  // Function to set the work as current work
  private async onSetAsCurrent(work: WorkType, ev: MouseEvent){
    if (await this.enableToStopEditing()) {
      Work.setAsCurrent(work);
      ui.toggleSection('work');
    } else {
      console.log("Abandon");
    }

  }

  // Function du bouton pour lancer le script
  private async onRunScript(work: WorkType, ev: MouseEvent) {
    const script = this.fieldOf(work, 'script').value;
    if (script) {
      const retour = postToServer('/tool/run-script', {process: 'Editing.onRunScript', script: script}) as any;
      if (retour.ok && retour.message){
        Flash.notice(`${t('ui.text.script_return')}${t('ui.colon')}${retour.message}`);
      }
    } else {
      Flash.error(t('error.no_script_to_run'));
    }
  }
  private async onRemove(work: WorkType, ev: MouseEvent){
    const confirmation = await this.dialogConfirmRemove.showAsync([work.project]);
    if (confirmation === 'remove') {
      let retour: RecType = {ok: true};
      if (this.originalWorks[work.id]) {
        // <= Le travail n'a pas été créé maintenant
        // => Il faut le détruire dans la base
        retour = postToServer('/work/remove', {process: 'Editing.onRemove', workId: work.id}) as any;
      }
      if (retour.ok) {
        DGet(`div#work-${work.id}`).remove();
        Flash.notice(t('work.destroy', [work.project]));
      }
    }
  }
  private get dialogConfirmRemove(){
    return this._dialconfrem || (this._dialconfrem = new Dialog({
      title: t('ui.title.confirmation_required'),
      message: t('ui.text.confirmation_suppression_work'),
      buttons: [
        {text: t('ui.button.abandon'), role: 'default', onclick: 'cancel'},
        {text: t('ui.button.ok_remove'), onclick: 'remove'}
      ],
      icon: 'images/icon.png'
    }));
  }
  private _dialconfrem!: Dialog;

  private get workContainer(){
    return DGet('div#editing-works-container');
  }

  onAddTask(){
    const owork = this.createNewTask({
      id: '',
      project: t('ui.text.your_project'),
      content: t('ui.text.temp_description'),
      folder: t('ui.text.path_example'),
      active: 0
    } as WorkType);
    owork.scrollIntoView({ behavior: 'smooth', block: 'start' });
    (owork.querySelector('input.form-work-project') as HTMLInputElement)
    .addEventListener('change', this.findIdIfRequired.bind(this, owork));
  }

  private findIdIfRequired(owork: HTMLDivElement, ev: Event){
    const projectField = (owork.querySelector('input.form-work-project') as HTMLInputElement);
    const idField = (owork.querySelector('input.form-work-id') as HTMLInputElement);
    const dispField = owork.querySelector('.work-id-disp') as HTMLSpanElement;

    let idProjet: string;
    if (idField.value === '') {
      const project = projectField.value.trim();
      if (project === '') {
        idProjet = this.getDefaultId();
      } else {
        idProjet = this.getIdFromProject(project);
      }
      this.setFormId(owork, idProjet);
      idField.value = idProjet;
      dispField.innerHTML = idProjet;
    }
  }

  /**
   * Appelée quand on change le dossier
   */
  private onChangeFolder(ev: Event){
    const field = ev.target as HTMLInputElement;
    const button = field.nextSibling as HTMLButtonElement;
    const state = field.value.trim() !== '';
    this.setButtonInvisibility(button, state);
    // Todo: on pourrait tout de suite vérifier l'existence
  }
  /**
   * Fonction appelée quand on change le script
   * 
   * Si le champ est défini, on montre le bouton
   */
  private onChangeScript(ev: Event){
    const field = ev.target as HTMLInputElement;
    const state = field.value.trim() !== '';
    const button = field.nextSibling as HTMLButtonElement;
    this.setButtonInvisibility(button, state);
    // Todo: on pourrait vérifier tout de suite l'existence
  }

  private setButtonInvisibility(btn: HTMLButtonElement, state: boolean){
    btn.classList[state?'remove':'add']('invisible');
  }

  /**
   * Fonction appelée quand on change le cron.
   * 
   * S'il est valide, il affiche à côté la date et l'heure du
   * prochain, sinon il signale une erreur.
   */
  private onChangeCron(ev: Event){
    const field = ev.target as HTMLInputElement;
    this.showNextTime(field);
  }

  private showNextTime(field: HTMLInputElement){
    let cron = field.value.trim();
    console.log("field", field);
    let span = field.nextSibling as HTMLElement;
    span.classList.remove('error');
    span.innerHTML = '';
    console.log("span", span);
    if (cron === '') { return }
    if (cron.split(' ').length === 5) { cron = `* ${cron}`; }
    try {
      const nextTime = CronExpressionParser.parse(cron, {strict: true}).next();
      const lang = `${prefs.getLang()}-${prefs.getLang().toUpperCase()}`;
      const jour = nextTime.toDate().toLocaleDateString(lang);
      const heure = nextTime
        .toDate().toLocaleTimeString(lang)
        .split(':').slice(0,2).join(':');
      span.innerHTML = `${jour} ${heure}`;
    } catch(err){
      span.classList.add('error');
      span.innerHTML = '-bad cron-'
    }
  }



  private getDefaultId(){
    const now = String(new Date().getTime());
    const len = now.length;
    return `prj${this.suffixFromDate(8)}`;
  }
  private getIdFromProject(project: string) {
    if (project === '') { project = 'UnnamedProject'}
    let idp;
    const projetBase = project.trim().toLowerCase()
      .replace(/[^a-zA-Z-0-9 ]/g, '');
    const words = projetBase.split(/[ \/\:\-\_]/);
    if ( words.length > 1) {
      idp = words
      .map(seg => seg.length > 3 ? seg.substring(0, 3) : seg)
      .join('');
    } else {
      idp = projetBase.substring(0, 6);
    }

    return `${idp}-${this.suffixFromDate(5)}` ;
  }
  private suffixFromDate(long: number){
    const now = String(new Date().getTime());
    const len = now.length;
    return now.substring(len - long, len)
  }

  // 
  /**
   * Pour finir l'édition et revenir au panneau principal
   * 
   * Mais on doit vérifier qu'aucune chose ne soit à enregistrer,
   * une nouvelle tâche, une suppression de tâche ou autre. Pour
   * ce faire, on compare la liste originale avec la liste actuelle.
   */
  async stopEditing(){
    console.log("-> stopEditing")
    if (await this.enableToStopEditing()) {
      ui.toggleSection('work');
    }
    console.log("<- stopEditing")
  }

  async enableToStopEditing(): Promise<boolean> {
    if (this.isOriginalListDifferentFromCurrent()){
      const retour = await (this.closeConfirmDialog.showAsync());
      if (retour === 'cancel') { 
        log.info("Abandon de la fermeture");
        return false;
      }
    } else {
      console.log("Aucune changement noté.");
    }
    return true;
  }

  private get closeConfirmDialog(): Dialog{
    return this._closeconfdial || (this._closeconfdial = new Dialog({
        title: t('ui.title.confirmation_close'),
        message: t('ui.text.when_works_modified_add_or_remove'),
        buttons: [
          {text: t('ui.button.close_anyway'), onclick: 'close-even'},
          {text: t('ui.button.abandon'), role: 'default', onclick: 'cancel'}
        ],
        icon: 'images/icon.png'
      }))
  }
  private _closeconfdial!: Dialog;
  /**
   * Return True if list of works has changed (creation, deletion, change)
   */
  isOriginalListDifferentFromCurrent(): boolean {
    return this.retreaveWorksDiff() > 0;
  }


  /**
   * Fonction qui va renseigner this.modifiedWorks avec les données
   * actuellement affichées/modifiées pour pouvoir ensuite contrôler
   * les changements (this.changesetWorks).
   * 
   * @return Le nombre de changements enregistrés
   */
  private retreaveWorksDiff(): number {
    console.info("originalWorks", this.originalWorks);
    this.modifiedWorks = {};
    const orderedIds: string[] = [];
    this.workContainer.querySelectorAll('.editing-form-work').forEach( (form: HTMLDivElement) => {
      const wdata = this.getTaskDataIn(form);
      if (wdata.id === '') {
        // ID non défini (ça arrive quand il vient d'être
        // créé sans avoir changé le titre. Dans ce cas, 
        // l'identifiant du "formulaire" n'est pas mis)
        wdata.id = this.getIdFromProject(wdata.project)
        this.setFormId(form, wdata);
      }
      orderedIds.push(wdata.id);
      Object.assign(this.modifiedWorks, {[wdata.id]: wdata});
    });
    // console.info("modifiedWorks", this.modifiedWorks)
    this.modifiedOrder = orderedIds.join(':');
    // Relève des changements
    this.changesetWorks = {};
    let totalChangeCount = 0;
    Object.entries(this.modifiedWorks).forEach(([idw, work]:[string, WorkType]) => {
      const originalWork = (this.originalWorks[idw] as any) || {}; // creating
      const modifiedWork = work as any;
      // console.log("originalWork = ", originalWork);
      // console.log("modifiedWork = ", modifiedWork);
      Object.assign(this.changesetWorks, {[idw]: {id: idw, count: 0, change: [], errors: {}}});
      for(var prop of WORK_PROPS){
        // console.log("Compare '%s' avec '%s' (%s) et '%s' (%s) sont %s", prop, modifiedWork[prop], typeof modifiedWork[prop], originalWork[prop], typeof originalWork[prop], modifiedWork[prop] !== originalWork[prop] ? 'différent' : 'égaux');
        if (modifiedWork[prop] !== originalWork[prop]) {
          (this.changesetWorks[idw] as any).count ++;
          (this.changesetWorks[idw] as any).change.push(prop);
          ++ totalChangeCount;
        }
      }
    });
    console.info("changesetWorks", this.changesetWorks);
    return totalChangeCount;
  }

  init(){
    this.observeButtons()
    return true;
  }

  private observeButtons(){
    listenBtn('editing-start', this.startEditing.bind(this));
    listenBtn('editing-end', this.stopEditing.bind(this));
    listenBtn('editing-add', this.onAddTask.bind(this));
    listenBtn('editing-save', this.onSaveData.bind(this));
  }


  public static singleton(){return this._inst || (this._inst = new Editing())}
  private static _inst: Editing;
  private constructor(){}
  private _formtemp!: HTMLDivElement;

}

export const editor = Editing.singleton();