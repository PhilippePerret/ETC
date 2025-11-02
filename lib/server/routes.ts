import path from 'path';
import type { Express } from 'express';
import log from 'electron-log/main';
import { prefs } from './prefs';
import { loc, t, tf } from '../shared/Locale';
import db from './db';
import { Work } from "./work";
import { existsSync, statSync } from 'fs';
import { execFileSync, execSync } from 'child_process';
import type { RecType, ResultType, WorkType } from '../shared/types';
import { activTracker } from './activityTracker';
import { manual } from './Manual';


const APP_PATH = path.resolve('.');
console.log("APP_PATH = %s", APP_PATH);
const MAIN_HTML_FILE = path.join(APP_PATH, 'public', 'main.html');
console.log("MAIN_HTML_FILE = %s", MAIN_HTML_FILE);


export function setupRoutes(app: Express) {
  
  app.get('/', (_req, res) => {
    // log("-> route /")
    log.info("->route /");
    prefs.load();
    loc.init(prefs.data.lang);
    db.init();
    // On rend la page
    res.send(tf(MAIN_HTML_FILE));
  });


  app.post('/prefs/load', (req, res) => {
    log.info('->route /prefs/load');
    const data = req.body // process seulement
    const dprefs = prefs.loaded ? prefs.data : prefs.load();
    Object.assign(data, {
      ok: true, 
      prefs: dprefs
    });
    res.json(data)
  });

  app.post('/work/save-session', (req, res) => {
    log.info("-> /work/save-session");
    const dwork = req.body;
    log.info("Sauvegarde de la session : ", dwork);
    db.updateWorkTimes(dwork);
    res.json({
      ok: true,
      next: Work.getCurrentWork(),
      options: {canChange: db.lastChangeIsFarEnough()}
    });
  });

  app.post('/work/get-current', (req, res) => {
    log.info("-> /work/get-current");
    let result = {ok: true, error: ''};
    const options = req.body
    try {
      Object.assign(result, {
        work: Work.getCurrentWork(options),
        options: { canChange: db.lastChangeIsFarEnough()}
      });
    } catch(err) {
      result = {ok: false, error: (err as any).message}
    }
    res.json(result);
  });

  app.post('/work/change', (req, res) => {
    const dreq = req.body;
    let result: {
      ok: boolean,
      error: string,
      work?: RecType & WorkType
    } = {ok: true, error: '', work: undefined};

    // Est-ce qu'on peut changer la tâche ?
    if (db.lastChangeIsFarEnough()) {
      const retour = Work.getCurrentWork({but: dreq.workId});
      // choisir une autre
      if ((retour as any).ok === false) {
        result = {
          ok: false,
          error: t('error.no_other_work_complete_that_one'),
          work: Work.get(dreq.workId)
        }
      } else {
        Object.assign(result, {work: retour as WorkType})
      }
      // Enregistrer la transaction
      db.setLastChange();
    } else {
      result = {ok: false, error: t('error.work_already_changed_today')}
    }
    res.json(result);
  });

  // Pour détruire un travail
  app.post('/work/remove', (req, res) => {
    const dreq = req.body;
    db.removeWork(dreq.workId);
    res.json(Object.assign(dreq, {ok: true, error: ''}))
  })

  // Retourne toutes les tâches, mais seulement les
  // information dans le fichier des données, pas les
  // temps.
  app.post('/works/all', (req, res) => {
    const dreq = req.body;
    Object.assign(dreq, {
      ok: true, 
      works: db.getAllWorks(),
      order: db.getWorksOrder()
    })
    res.json(dreq);
  });

  app.post('/works/get-all-data', (req, res) => {
    const data: RecType = req.body;
    const works = db.getAllActiveWorks();
    res.json(Object.assign(data, {
      ok: true,
      works: works,
    }));
  });

  app.post('/works/save', (req, res) => {
    const dreq = req.body;
    const works = dreq.works;
    const result: ResultType = {ok: true, error: undefined, process: dreq.process};
    if ( works.length ) {
      Object.assign(result, db.saveAllWorks(dreq.works))
    }
    Object.assign(result, db.saveWorksOrder(dreq.order))
    res.json(result);
  });

  app.post('/prefs/save', (req, res) => {
    const report = prefs.save(req.body);
    res.json(report);
  });

  app.post('/localization/get-all', (req, res) => {
    log.info("->route /localization/get-all")
    const lang = req.body.lang;
    let retour = {ok: true, error: '', locales: loc.getLocales()};
    retour.locales.ui.app.mode = process.env.ETC_MODE;
    res.json(retour);
  });

  app.post('/work/check-activity', async (req, res) => {
    log.info("->route /work/check-activity");
    req.setTimeout(30 * 60 * 1000);
    res.setTimeout(30 * 60 * 1000);
    let response: RecType = {};
    try {
      const dreq = req.body;
      const folder: string = dreq.projectFolder;
      const lastCheck = dreq.lastCheck;
      const isActive = await activTracker.watchActivity(folder, lastCheck);
      log.info('Data watcher activity:', {isActive, folder, lastCheck, date: new Date(lastCheck)});
      if (isActive === false) {
        // TODO Activer l'application pour voir le dialogue
      }
      response = {ok: true, isActive: isActive}
    } catch (err) {
      log.error("ERREURS IN /work/check-activity", err);
      response = {ok: false, error: (err as any).message }
    }
    res.json(response);
  });

  app.post('/check/id-existence', (req, res) => {
    const dreq = req.body;
    const idExists = db.workIdExists(dreq.workId);
    res.json(Object.assign(dreq, {ok: true, idExists, error: ''}));
  })
  app.post('/check/folder-existence', (req, res) => {
    const dreq = req.body;
    const folderExists: boolean = existsSync(dreq.folder);
    res.json(Object.assign(dreq, {ok: true, folderExists, error: ''}));
  })

  app.post('/check/file-existence', (req, res) => {
    const dreq = req.body;
    const fileExists: boolean = existsSync(dreq.file);
    res.json(Object.assign(dreq, {ok: true, fileExists: fileExists, error: ''}));
  })

  app.post('/check/file-executable', (req, res) => {
    const dreq = req.body;
    const stats = statSync(dreq.file);
    const isExecutable = !!(stats.mode & 0o111);
    res.json(Object.assign(dreq, {ok: true, isExecutable, error: ''}));
  })

  app.post('/tool/open-folder', (req, res) => {
    const dreq = req.body;
    let result: ResultType = {ok: true, error: undefined, process: dreq.process};
    if (existsSync(path.resolve(dreq.folder))) {
      try {
        execSync(`open -a Finder "${dreq.folder}"`);
      } catch(err: any) {
        console.error("ERREUR OUVERTURE FOLDER: ", err);
        result.error = String(err.stderr)
      }
    } else {
      result.error = t('error.unfound_folder', [dreq.folder]);
    }
    result.ok = result.error === undefined;
    res.json(result);
  });

  app.post('/tool/run-script', (req, res) => {
    const dreq = req.body;
    let result: ResultType = {
      ok: true, 
      error: undefined, 
      process: dreq.process,
      message: undefined
    };
    dreq.script = path.resolve(dreq.script);
    // log.info("Je dois jouer le script", dreq.script);
    if (existsSync(dreq.script)) {
      try {
        const res = execFileSync(dreq.script, {encoding: 'utf8'});
        log.info("Résultat du script", res);
        result.message = res;
      } catch(err: any) {
        result.error = err.stderr;
      }
    } else {
      result.error =  t('error.unfound_script', [dreq.script]);
    }
    result.ok = result.error === undefined;
    res.json(result);
  })

  app.post('/tool/reset-cycle', async (req, res) => {
    log.info("->route /tool/reset-cycle")
    const data = req.body;
    const {ok, error} = db.resetCycle();
    res.json(Object.assign(data, {ok, error}));
  });

  app.post('/manual/produce', (req, res) => {
    log.info('->route /manual/produce');
    const data = req.body;
    const result: ResultType = manual.produce(data.lang);
    res.json(Object.assign(data, result));
  });

  app.post('/manual/open', (req, res) => {
    log.info('->route /manual/open');
    const data = req.body;
    const lang = data.lang;
    manual.open(lang);
    res.json(Object.assign(data, {ok: true}));
  })

}// fin de setupRoutes