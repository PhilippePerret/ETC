import fs from 'fs';
import path from 'path';
import log from '../shared/log';


/**
 * @api
 * 
 * Vérifie que l'utilisateur est encore en train de travailler sur
 * son projet et renvoie True le cas échéant. False otherwise.
 * 
 * @param folder Path du dossier du projet
 * @param lastCheckAt Date de dernier check (par défaut : il y a 15 minutes)
 */
export function isUserWorkingOnProject(folder: string, lastCheckAt: number): boolean {
  
  const checkedPaths = new Set();

  /**
   * Vérifie si le fichier/dossier +hpath+ a été modifié depuis la
   * dernière date de vérification.
   * 
   * @param hpath Full real path of the file to check
   * @param date Of the last check
   */
  function hasBeenModifiedSince(stats: fs.Stats, lastCheck: number): boolean {
    return stats.mtimeMs > lastCheck ;
  }

  /**
   * Résoud les liens symboliques (if any)
   */
  function hardPathOf(folder:string, dirent: fs.Dirent): string | undefined {
    const fullPath = path.join(folder, String(dirent.name));
    if (dirent.isSymbolicLink()) {
      try {
        const target: string = fs.readlinkSync(fullPath);
        return path.resolve(folder, target);      
      } catch(error) {
        console.error('Unable to read link of ' + fullPath);
        return ;
      }
    } else {
      return fullPath; 
    }
  }

  /**
   * Fouille le dossier +folder+ pour trouver un premier élément 
   * modifié depuis la dernière date de check.
   * 
   * @param folder Path du dossier
   * @returns null | string (chemin d'accès au fichier modifié)
   */
  function traverseFolder(folder: string): null | string {
    log.info("traverse folder", folder);
    let entries: fs.Dirent[];
    let found: null | string;
    let stats: fs.Stats;
    try {
      entries = fs.readdirSync(folder, { withFileTypes: true });
    } catch(error) {
      console.error(`Unable to read '${folder}' directory…`)
      return null;
    }
    // Loop on all entries
    for (const entry of entries) {
      const hardPath: string | undefined = hardPathOf(folder, entry);
      if (undefined === hardPath) continue; // erreur
      if ( checkedPaths.has(hardPath) ) {
        log.info("KNOWN: ", hardPath);
        continue 
      } else { 
        checkedPaths.add(hardPath) 
      }
      try {
        stats = fs.statSync(hardPath);
      } catch(error) {
        console.error('Unable to read stat of ' + hardPath);
        continue;
      }
      if (hasBeenModifiedSince(stats, lastCheckAt)) {
        log.info("MODIFIED: ", hardPath);
        return hardPath; 
      } else if (stats.isDirectory()) {
        if ( (found = traverseFolder(hardPath)) ) { return found; }
      }
    }
    return null;
  }
  return !!traverseFolder(folder) ;
}
