/**
 * Module pour checker les dossiers/fichiers qui sont détectés
 * dans la surveillance d'un dossier.
 * 
 *  * Ouvrir le dossier ./test/assets/folders/Work1
 *  * Lancer ce script
 *  * Modifier les fichiers/dossier à l'intérieur
 *  * Voir le résultat (indication que l'user est détecté actif, 
 *    et par quel fichier)
 *  * Au bout du dixième check, le script s'arrête de lui-même
 * 
 */




// import path from 'path';
// import { isUserWorkingOnProject } from '../lib/server/Activity_isUserWorking';


// const FOLDER_PATH = path.join(__dirname, 'assets', 'folders', 'Work1');
// // const ilyaQuelquesMinutes = new Date().getTime() - 20 * 60 * 1000;

// let nombreFois = 10

// async function teste() {
//   return new Promise((ok, ko) => {
//     setInterval(() => {
//       const res = isUserWorkingOnProject(FOLDER_PATH, ilyaQuelquesMinutes);
//       console.log("L'user est ", res ? 'actif' : 'inactif');
//       ilyaQuelquesMinutes = new Date().getTime() - 30 * 1000;
//       nombreFois --;
//       if (nombreFois < 0) {ok(null)};
//     }, 15 * 1000);
//   });
// }
// let ilyaQuelquesMinutes = new Date().getTime() - 30 * 1000;

// await teste();