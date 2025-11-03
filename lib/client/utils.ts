import { HOST } from '../../public/js/constants';
import { DGet } from '../../public/js/dom';
import { Flash } from '../../public/js/flash';
import type { RecType } from '../shared/types';
import { t } from '../shared/Locale';

/**
 * Pour faciliter l'observation des clicks sur les boutons.
 * 
 * Le bouton doit obligatoire avoir une classe qui commence par
 * 'btn-' suivi de son "id"
 * La fonction doit être bindée
 */
export function listenBtn(id: string, method: Function, container = document.body) {
  DGet(`button.btn-${id}`, container).addEventListener("click", method);
}

export function listenChange(selector: string, method: Function, container = document.body) {
  DGet(selector, container).addEventListener('change', method);
}


export async function postToServer(route: string, data: RecType){
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30 * 60 * 1000);
  let response;
  try {
    response = await fetch(HOST+route, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(r => {
      console.log("r = ", r);
      switch(r.status) {
        case 500:
          return {
            ok: false, 
            error: `Internal Server Error (route: ${route}, process: ${data.process || 'inconnu (add it to data)'})`, 
            process: 'fetch'
          }
        case 404:
          return {
            ok: false,
            error: `Route not found: ${route}`,
            process: data.process
          }
        default:
          return r.json();
      }
    });
  } catch(err) {
    console.error(err);
    response = {ok: false, process: 'fetch', error: `ERREUR postToServer: ${(err as any).message}`}
  } finally {
    clearTimeout(timeoutId);
  }
  if (response.ok === false) {
    let error = response.error || t('error.unknown');
    if (null === error.match(' ')) {error = t.call(null, error)}
    let msg = `${t('error.occurred', [error])}`;
    if (response.process) { msg = `[${response.process}] ${msg}` }
    Flash.error(msg);
  }
  return response;
}