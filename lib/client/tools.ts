import { t } from "../shared/Locale";
import { DGet, stopEvent, span, table, tr, td } from "../../public/js/dom.js";
import { Flash } from "../../public/js/flash.js";
import { ui } from "./ui";
import { markdown } from "../shared/utils_shared";
import { postToServer } from "./utils";
import { Work } from "./work.js";
import prefs from "./prefs.js";
import type { RecType, WorkType } from "../shared/types";
import { Panel } from "./Panel.js";
import { clock } from "./Clock.js";

interface ToolType {
  name: string;
  method: EventListener;
  description: string;
}

class Tools { /* singleton */

  private get TOOLS_DATA(): ToolType[] { return [
    {
      name: t('ui.tool.times_report.name'),
      description: t('ui.tool.times_report.desc'),
      method: this.worksReportDisplay.bind(this)
    },
    {
      name: t('ui.tool.reset_cycle.name'), 
      description: t('ui.tool.reset_cycle.desc'), 
      method: this.resetCycle.bind(this)
    },
    {
      name: t('ui.tool.manual.open.name'),
      description: t('ui.tool.manual.open.desc'),
      method: this.openManual.bind(this)
    },
    {
      name: t('ui.tool.manual.produce.name'),
      description: t('ui.tool.manual.produce.desc'),
      method: this.produceManual.bind(this)
    }
  ]}

  // -------- TOOLS ----------

  private async resetCycle(ev: Event) {
    ev && stopEvent(ev);
    const retour = await postToServer('/tool/reset-cycle', {process: t('ui.tool.reset_cycle.name')});
    if (retour.ok){
      Flash.success(t('tool.cycle_reset'))
      ui.toggleSection('work');
      await Work.getCurrent();
    }
  }

  // --- //

  private async openManual(ev: Event){
    stopEvent(ev);
    await postToServer('/manual/open', {process: 'Tools.openManual', lang: prefs.getLang()});
  }

  // --- //

  private async produceManual(ev: Event){
    stopEvent(ev);
    const retour = await postToServer('/manual/produce', {process: 'Tools.produceManual', lang: prefs.getLang()});
    if (retour.ok) { Flash.success(t('manual.produced')) }
  }

  // --- //

  /**
   * Affichage du rapport de temps
   * -----------------------------
   * On passe par ici dès qu'on doit fabriquer les tableaux, 
   * c'est-à-dire dès qu'on demande un classement différent.
   * Mais c'est seulement la première fois qu'on construit les
   * rangées de chaque travail. Ensuite, on ne fera que les 
   * classer.
   */
  private async worksReportDisplay(ev: Event){
    stopEvent(ev);
    await this.buildWorkRows();
  }
  private TimesReportPanel!: Panel;

  // -------- /TOOLS ----------


  /**
   * Construction de la section des outils
   * (seulement si on ouvre le panneau — cf. Prefs)
   */
  build(): void {
    if (this.built) { return }
    const cont = this.container;
    this.TOOLS_DATA.forEach((dtool: ToolType) => {
      const o = document.createElement('DIV');
      o.className = 'tool-container';
      const a = document.createElement('A');
      a.innerHTML = dtool.name;
      const d = document.createElement('DIV');
      d.innerHTML = dtool.description;
      d.className = 'explication'
      o.appendChild(a);
      o.appendChild(d);
      cont.appendChild(o)
      // Observation
      a.addEventListener('click', dtool.method);
    })
    this.built = true;
  }
  



  private TRDataWorks!: RecType;

  private async buildWorkRows(): Promise<void>{
    const retour = await postToServer('/works/get-all-data', {process: 'times_report tool'});
    if (false === retour.ok) return;
    // console.log("RETOUR: ", retour);
    let header = tr([
      td(span(t('ui.thing.Work'),'work'), 'header'), 
      td(span(`${t('ui.thing.Cycle')}<sup>1</sup>`, 'cycle'), 'header'), 
      td(span(`${t('ui.title.worked')}<sup>2</sup>`, 'worked'), 'header'), 
      td(span(`${t('ui.title.left')}<sup>3</sup>`, 'left'), 'header'), 
      td(span(`${t('ui.title.total')}<sup>4</sup>`, 'total'), 'header')
    ].join(''), 'header');

    this.TRDataWorks = {};

    let tableau_actifs: string | string[] = [];
    tableau_actifs.push(header);
    let tableau_inactifs: string | string[] = [];
    tableau_inactifs.push(header);

    retour.works.forEach((work: WorkType) => {
      const idw = work.id;
      const inactif = work.active === 0;
      Object.assign(this.TRDataWorks, {[idw]: {
        id: idw,
        actif: !inactif,
        inactif: inactif,
        work: work.project,
        cycle: work.defaultLeftTime,
        worked: (work.defaultLeftTime as number) - work.leftTime,
        left: work.leftTime,
        total: work.totalTime
      }});
      const line = tr([
        td(work.project),
        td(clock.mn2h(work.defaultLeftTime as number)),
        td(clock.mn2h(work.defaultLeftTime as number - work.leftTime)),
        td(clock.mn2h(work.leftTime)),
        td(clock.mn2h(work.totalTime))
      ].join(''), 'work', `rowwork-${idw}`);
      if ( inactif ) {
        (tableau_inactifs as string[]).push(line)  
      } else {
        (tableau_actifs as string[]).push(line)
      }
    });

    // Finaliser les tableaux
    tableau_actifs = table(tableau_actifs.join(''), 'tempo-report actifs');
    tableau_inactifs = table(tableau_inactifs.join(''), 'tempo-report inactifs');
    
    let tableaux = tableau_actifs + tableau_inactifs + `
    <div style="margin-top:2em">
    <sup>1</sup> ${t('help.times.duree_cycle')}<br />
    <sup>2</sup> ${t('help.times.duree_worked')}<br />
    <sup>3</sup> ${t('help.times.duree_left')}<br />
    <sup>4</sup> ${t('help.times.duree_totale')}<br />
    </div>
    `.replace(/^\s+/gm, '');

    // console.log("TABLEAUX", tableaux);

    if (undefined === this.TimesReportPanel) {
      this.TimesReportPanel = new Panel({
        title: t('ui.title.times_report'),
        buttons: 'ok',
        content: tableaux
      });
      this.TimesReportPanel.show();
      this.observeTimesReportPanel()
    } else {
      this.TimesReportPanel.setContent(tableaux);
      this.TimesReportPanel.show();
    }
  }

  /**
   * Pour observer le panneau du rapport des temps
   * Cette observation consiste principalement à surveiller les 
   * colonne pour faire les classements
   */
  private observeTimesReportPanel(){
    const tbActifs = DGet('table.actifs');
    const tbInactifs = DGet('table.inactifs');
    ['work', 'cycle', 'worked', 'left', 'total'].forEach((prop: string) => {
      DGet(`td.header span.${prop}`, tbActifs).addEventListener('click', this.sortTimesReportBy.bind(this, prop));
    });
  }

  /**
   * Fonction appelée quand on clique sur une propriété de l'entête 
   * pour classer selon une certain propriété
   */
  private sortTimesReportBy(keySort: string, ev: MouseEvent){
    const span = ev.target as HTMLSpanElement;
    const dir = (span.dataset.dir || 'asc') === 'desc' ? 'asc' : 'desc';
    stopEvent(ev);
    // Classement
    let sorted = Object.values(this.TRDataWorks).sort((wa: RecType, wb: RecType) => {
      if (wa[keySort] > wb[keySort]) { return -1 }
      else { return 1 }
    });
    console.log("sorted", sorted);
    // Faut-il inverser la liste ?
    if ( dir === 'asc') { sorted = sorted.reverse() }

    // On classe dans le tableau
    let lastWorkActif, lastWorkInactif;
    for(var i = sorted.length - 1; i > -1; --i){ // en remontant
      const work = sorted[i];
      let prevWork = work.actif ? lastWorkActif : lastWorkInactif;
      if ( prevWork ) {
        let rowWork = DGet(`table.tempo-report.${work.actif?'actifs':'inactifs'} tr#rowwork-${work.id}`);
        let rowPrevWork = DGet(`table.tempo-report.${work.actif?'actifs':'inactifs'} tr#rowwork-${prevWork.id}`);
        rowWork.parentNode.insertBefore(rowWork, rowPrevWork);
      }
      if (work.actif) { lastWorkActif = work } else { lastWorkInactif = work }
    }

    // On mémorise le classement 
    (span as HTMLSpanElement).dataset.dir = dir;
  }

  private get container(){return DGet('#tools-container')}
  private built: boolean = false;

   /* singleton */
  public static getInstance(){return this.inst || (this.inst = new Tools())}
  private constructor(){};
  private static inst: Tools;
}

export const tools = Tools.getInstance();