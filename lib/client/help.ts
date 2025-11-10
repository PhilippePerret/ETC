import type { RecType } from "../shared/types";
import { DGet } from "../../public/js/dom";
import { ui } from "./ui";
import { tt, t, t_strict, loc } from "../shared/Locale";
import { markdown } from "../shared/utils_shared";
import { listenBtn } from "./utils";
import { Flash } from "../../public/js/flash";

/**
 * Module pour la gestion de l'aide
 * 
 * 
 * Pour un lien vers un texte d'aide dans l'aide utiliser :
 * 
 *  hlink(<titre>, <aide id dans HELP_TEXTS>)
 * 
 * (note : PAS de guillemets)
 * 
 */

const HELP_TEXTS: RecType = {

  // Résumé qu'on atteint depuis le message d'accueil
  resume_home_page: `
# t(help.introduction.title)

t(help.introduction.text)

# t(help.terminologie.title)

t(help.terminologie.text)

# t(help.deroulement_travail.title)

t(help.deroulement_travail.text)

# t(help.work_list.title)

t(help.work_list.text)
  `,
  
  introduction: `
### t(help.introduction.title)

t(help.introduction.text)
`,

  terminologie: `
### t(help.terminologie.title)

*(D'abord un peu de terminologie pour bien comprendre l'aide)*

t(help.terminologie.text)
  `,


work_list: `
### t(help.work_list.title)

t(help.work_list.text)
`,

work_data: `
### t(help.work_data.title)

t(help.work_data.text)
`,


duree_cycle_vs_duree_sess: `
# t(help.durcycvsdursess.title)

t(help.durcycvsdursess.text)
`,

stop_report: `
# t(help.stop_report.title)

t(help.stop_report.text)
`,

cron: `
# t(help.cron.title)

t(help.cron.text)
`


}


class Help { /* singleton help */
  private constructor(){}
  public static singleton(){return this.inst || (this.inst = new Help())}
  private static inst: Help;


  private texts!: string[];

  /**
   * Place un observateur sur l'élément +e+ pour afficher
   * l'aide ou les aides pour +helpIds+ qui peut être un
   * identifiant d'aide seul ou une liste ordonnée.
   */
  public listenOn(e: HTMLElement, helpIds: string | string[]){
    helpIds = 'string' === typeof helpIds ? [helpIds] : helpIds;
    e.addEventListener('click', help.show.bind(help, helpIds));
    e.classList.add('help-link');
  }

  /**
   * Retourne le texte d'aide d'identifiant +locId+
   * 
   * De façon naturelle, cet identifiant se trouve défini ci-dessus dans
   * HELP_TEXTS. Mais il se peut qu'on mette directement l'identifiant
   * défini dans help.yaml, dans la section help. Cette méthode se charge
   * alors de construire la bonne valeur. Sinon, on retourne un la simple
   * traduction du mot, ou l'identifiant lui-même, sous forme d'erreur.
   * 
   * @param locId Identifiant de l'aide
   */
  private getTextOf(locId: string): string {
    var tx: string | undefined;
    if (tx = HELP_TEXTS[locId]) { return tx } 
    else if ( tx = t_strict(`${locId}`)) { return tx }
    else if ( tx = t_strict(`help.${locId}.title`)) { 
      // Un texte d'aide localisé
      return `
      ${t_strict(`help.${locId}.level`)} ${t(`help.${locId}.title`)}

      ${t_strict(`help.${locId}.text`)}
      `.replace(/^\s+/gm, '').trim();
    }
    else { return t(locId);}
  }

  public async show(helpIds: string[]){
    console.log("-> Help.show", helpIds);
    // console.log("HELP_TEXTS = ", HELP_TEXTS);
    this.isOpened() || ui.toggleHelp();
    this.content.innerHTML = '';
    // La liste helpIds va pouvoir être augmentée de
    // certaines aides nécessaires, appelées par exemple
    // par des liens. Il faut donc fonctionner tant 
    // qu'elle n'est pas vide.
    const LocIds: {type: string, locId: string, prefix?: string}[] = [];
    helpIds.forEach((helpId: string) => {
      LocIds.push({type: 'text', locId: helpId})
    })
    this.texts = [];
    let locDef: {type: string, locId: string, prefix?: string} | undefined; 
    while((locDef = LocIds.shift())) {
      console.log("locDef = ", locDef);
      const locId = locDef.locId;
      const locIdpur = locId.replace(/\./g, '');
      let texte = this.getTextOf(locId);
      // console.log("TEXTE INI", texte);
      while(texte.match(/\bt\(/)) { texte = tt(texte) }
      // Est-ce un lien vers une autre partie de
      // l'aide ? (dans lequel cas il faut ajouter cette aide
      // au texte)
      if (texte.match(/help\((.+?)\)/)) {
        texte = texte.replace(/help\((.+?)\)/g, (_tout: string, hid: string) => {
          hid = hid.trim();
          console.log("HID = ", hid);
          const fullIdTitle = `help.${hid}.title`;
          const fullIdPrefix = t(`help.${hid}.level`);
          const fullIdText  = `help.${hid}.text`;
          LocIds.push({type: 'title', locId: fullIdTitle, prefix: fullIdPrefix});
          LocIds.push({type: 'text', locId: fullIdText});
          return `[*${t(fullIdTitle)}*](#help-${fullIdTitle.replace(/\./g, '')})`
        })
      }

      if (locDef.type === 'title') {
        texte = `${locDef.prefix} ${texte}`;
      } else {
        texte = `${texte}\n\n---`
      }

      // console.log("texte = ", texte);
      const formated_text = `<a id="help-${locIdpur}" name="${locIdpur}"></a>\n` 
      + this.finalizeText(texte).trim();

      // console.log("\n\n\nTEXTE AJOUTÉ : ", formated_text);
      this.texts.push(formated_text);
    };


    this.writeText.bind(this)();

    // this.timer = setInterval(() => {
    //   this.writeText.bind(this)();
    //   (DGet(`a#help-${helpIds[0]}`) as HTMLElement).scrollIntoView({behavior: 'smooth', block: 'start'});
    // }, 500);
  }
  private timer?: NodeJS.Timeout;

  private finalizeText(text: string): string {
    // Liens vers l'aide (hlink)
    text = text.replace(/\bhlink\((.+?)\)/g, (_tout: string, args: string) => {
      const [tit, hid] = args.split(',').map((s: string) => s.trim());
      return `<span onclick="help.show(['${hid}'])">${tit}</span>`;
    });
    return text;
  }

  private writeText(){
    var text: string | undefined;
    while ( (text = this.texts.shift()) ) {
      this.write(markdown(text) as string);
    }
  }

  private close(){ui.toggleHelp()}

  private write(text: string): boolean {
    this.content.insertAdjacentHTML('beforeend', text);
    return true;
  }

  private isOpened(){
    return !this.obj.classList.contains('hidden')
  }

  private get obj(){
    return this._obj || (this._obj = DGet('section#help'))
  }
  private _obj!: HTMLElement;

  private get content(){
    return this._content || (this._content = DGet('div#help-content', DGet('section#help')) as HTMLDivElement);
  }; private _content!: HTMLDivElement;

  public init(): boolean {
    DGet('button.btn-close-help').addEventListener('click', this.close.bind(this));
    listenBtn('help-toggle', this.show.bind(this, ['resume_home_page']));
    listenBtn('help-search', this.searchHelp.bind(this), this.obj)
    return true;
  }

  private searchHelp(ev: MouseEvent){
    Flash.notice("Je dois apprendre à chercher dans l'aide")
    let searched: string = DGet('input#help-search-field', this.obj).value as string;
    // if (searched.startsWith('/') && searched.endsWith('/')){
    //   searched = new RegExp(searched.substring(1, searched.length - 1), 'g') as RegExp;
    // }

    // Todo Comment récupérer tous les textes d'aide ?
    // En fait, il faut tous les help.<any>.text et les
    // help.<any>.title
    const keys = loc.getKeys('help');
    const locales = loc.getLocales();
    console.log("Keys", keys);
    const founds: {[x: string]: {
      title: string,
      text: string,
      extraits: string[]
    }} = {};
    keys.forEach((key: string) => {
      if ( 'object' === typeof locales.help[key] && locales.help[key].title) {
        // Une aide fouillable
        const title = t(`help.${key}.title`);
        const text  = t(`help.${key}.text`);
        const textLength = text.length;
        Object.assign(founds, {[key]: {
          title: title,
          text: text,
          extraits: [], 
          helpId: key
        }});
        if (title.indexOf(searched) > -1) {
          (founds as any)[key].extraits.push(title);
        }
        // console.log("Fouiller dans titre : ", title);
        // console.log("Fouiller dans text", text);
        const marge = 200 ;
        let offset = -marge;

        while(offset = text.indexOf(searched, offset + marge - 5)){
          if (offset < 0 ) { break }
          // console.log("offset", offset);
          const prefix:string = offset - 200 > 0 ? '[…] ' : '';
          const suffix: string = offset + 200 > textLength ? '' : ' […]';

          ((founds as any)[key]).extraits.push(prefix + text.substring(offset - 200, offset + 200) + suffix);
        }
      }
    });

    // console.log("founds = ", founds);

    this.content.innerHTML = '';

    for(var [helpId, dataHelp] of Object.entries(founds)){
      const extraits = dataHelp.extraits;
      const title = dataHelp.title;
      if (extraits.length ) {
        console.log("Trouvé dans Titre:", title);
        console.log("Extraits", extraits);
        // Todo : mettre un lien pour rejoindre l'aide entière
        // (ou pour l'afficher entière, plutôt, pour pouvoir 
        // garder les autres)
        const o = document.createElement('DIV');
        o.id = `help-${helpId}`;
        this.content.appendChild(o);
        o.className = 'help-found-container';
        const t = document.createElement('DIV');
        o.appendChild(t);
        t.className = 'found-title';
        const l = document.createElement('button');
        l.className = 'found-show-whole no-btn tiny';
        l.innerHTML = 'tout afficher';
        t.appendChild(l);
        l.addEventListener('click', this.replaceWithWholeHelp.bind(this, helpId))
        const s = document.createElement('span');
        s.innerHTML = title;
        t.appendChild(s);

        const fds = document.createElement('DIV');
        o.appendChild(fds);
        fds.className = 'found-extraits';
        extraits.forEach((extrait: string) => {
          const regexp = new RegExp(searched, 'g');
          extrait = extrait.replace(regexp, `<span class="found">${searched}</span>`);
          const f = document.createElement('DIV');
          f.className = 'found-extrait';
          f.innerHTML = extrait;
          fds.appendChild(f);
        });
      }
    }

  }

  /**
   * Fonction qui permet, lors d'une recherche, de remplacer les
   * extraits par l'aide complète.
   * 
   * @param helpId Identifiant de l'aide
   */
  replaceWithWholeHelp(helpId: string, ev: Event) {
    const div = DGet(`div#help-${helpId} div.found-extraits`) as HTMLDivElement;
    div.innerHTML = t(`help.${helpId}.text`);
    // Il faut supprimer le lien
    (ev.target as HTMLElement).remove();
  }

}

export const help = Help.singleton();
(window as any).help = help;