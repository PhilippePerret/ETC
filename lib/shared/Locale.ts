import type { RecType } from "./types";
import path from 'path';
import yaml from 'js-yaml';
import { readFileSync } from "fs";


// console.log('APP_PATH =', process.env.APP_PATH);
console.log('__dirname =', __dirname);

// FOIRE: const LOCALES_FOLDER = path.resolve(path.join(__dirname,'..','locales'));
// FOIRE: const LOCALES_FOLDER = path.join(process.env.APP_PATH || __dirname, 'lib', 'locales'); // correction bug \#177
// FOIRE const LOCALES_FOLDER = process.env.APP_PATH 
//   ? path.join(process.env.APP_PATH, 'lib', 'locales')
//   : path.resolve(path.join(__dirname, '..', 'locales'));

const LOCALES_FOLDER = typeof process !== 'undefined' && process.env?.APP_PATH
  ? path.join(process.env.APP_PATH, 'lib', 'locales')
  : path.resolve(path.join(__dirname, '..', 'locales'));

// const SERVER_SIDE = typeof window === 'undefined';

console.log('LOCALES_FOLDER =', LOCALES_FOLDER);

/**
 * Service de LOCALISATION
 * 
 */
export function t(route: string, params?: string[]): string {
  const rawRes = t_strict(route, params);
  if ( rawRes ) { 
    return rawRes 
  } else { 
    return `[LOC: ${route}]` 
  }
}

// Comme @t, mais retourne undefined si l'aide n'existe pas
// (permet donc de tester l'existence)
export function t_strict(route: string, params?: string[]): string | undefined {
  // console.log("route = '%s'", route, params);
  const rawString = loc.translate(route, true);
  if (params && rawString) {
    let template = rawString
    for(var i in params){
      const regexp = new RegExp(`_${i}_`, 'g');
      template = template.replace(regexp, params[i] as string);
    }
    return template;
  } else {
    return rawString;
  }
}
export function tf(fpath: string) {
  return loc.translateText(readFileSync(fpath, 'utf8'));
}

/**
 * @api
 * Permet de traduire tout un texte quand il contient des 
 * balises de localisation (t(route)).
 * 
 * @param text Un texte contenant des balises de localisation
 * @returns Le texte traduit
 */
export function tt(text: string){
  return loc.translateText(text);
}

class Locale {

  private BASEFILES = ['messages', 'ui', 'help'];

  public getLocales(){return this.locales}

  public translateText(texte: string){
    // console.log("-> Locale.translateText")
    return texte.replace(/\bt\((.+?)\)/g, this.replacementMethod.bind(this));
  }

  public getKeys(key: string): string[] {
    return Object.keys(this.locales[key]);
  }

  /**
   * @api
   * 
   * Reçoit une route et retourne la valeur locale.
   */
  public translate(route: string, strict: boolean = false): string | undefined {
    const translated = route.split('.').reduce((obj, key) => obj?.[key], this.locales) ;
    if ('string' === typeof translated) {
      this._loading_confirmed = true;
      return translated;
    } else {
      // En cas de route non trouvée, si une première route trouvée
      // n'a pas confirmé que les données étaient bien chargées, on
      // fait un test avec une route qu'on sait exister. Elle ne 
      // renvoie pas le texte attendu, on recharge les locales en 
      // signalant l'erreur.
      if (this._loading_confirmed){
        // Vraiment une locale qui n'existe pas
        if (strict) { return }
        else { return `[LOC: ${route}]` }
      } else {
        // Fatale Error
        const side = typeof window === 'undefined' ? 'server' : 'client';
        throw new Error(`Locales should be loaded (${side} side)`);
      }
    }
  }

  private _loading_confirmed: boolean = false;


  private replacementMethod(tout: string, route:string): string {
    // console.log("Traduction de %s = ", route, this.translate(route));
    return this.translate(route, false) as string;
  }

  /**
   * Initialisation des locales
   * Consiste principalement à charger le fichier des locales
   */
  public async init(lang: string): Promise<boolean> {
    // console.log("Initialisation des locales (%s)", lang);
    if ( typeof window === 'undefined' /* server side */) {
      return this.initServerSide(lang);
    } else /* client side */ {
      const { postToServer } = await import("../client/utils");
      const retour = await postToServer('/localization/get-all', {lang: lang});
      if (retour.ok) { 
        // console.log("Locales remontées : ", retour.locales);
        this.locales = retour.locales 
      }
      return retour.ok;
    }
    // console.log("Toutes les locales : ", this.locales);
  }

  private initServerSide(lang: string){
    this.locales = {}
    const folderLang = path.join(LOCALES_FOLDER, lang);
    this.BASEFILES.forEach((base: string) => {
      const pathLocale = path.join(folderLang, `${base}.yaml`)
      Object.assign(this.locales, yaml.load(readFileSync(pathLocale, 'utf8')));
    })
    return true;
  }



  private locales!: RecType;


  private constructor(){}
  public static singleton(){return this.inst || (this.inst = new Locale())}
  private static inst: Locale;
}

export const loc = Locale.singleton();