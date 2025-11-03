

export interface ResultType {
  ok: boolean;
  error: string | undefined ;
  process: string;
  message?: string;
}

export type RecType = {[x: string]: any};

export type ButtonType = {
  text: string;
  onclick: Function | string;
  role?: 'default' | 'cancel';
}

export interface WorkType {
    id: string;
    active?: number;
    project: string;
    content: string;
    folder: string; // Required (to watch activity)
    script?: string; // path du script de démarrage
    scriptBtn?: string; // nom du bouton
    cron?: string;
    cronedAt: number | null;
    nextCronDateAt: number | null;
    defaultLeftTime?: number;
    totalTime: number;  // Le nombre total de minutes de travail
    cycleTime: number;  // Le nombre de minutes travaillées dans le cycle courant
    leftTime: number;   // Nombre de minutes restant pour finir le cycle
    cycleCount: number; // Nombre de cycles
    startedAt: number;  // Date de démarrage du travail
    lastWorkedAt: number | undefined; // Date de dernier travail
    report: string; // Le Stop Report (rapport de fin, bâton de relais)
    createdAt: number;
}
export const DEFAULT_WORK = {
  id: 'defaultid',
  active: 0,
  project: 'PROJET',
  content: 'DEFAULT CONTENT',
  folder: '/path/to/default',
  defaultLeftTime: 0,
  script: '',
  scriptBtn: '',
  cron: '',
  cronedAt: null,
  nextCronDateAt: null,
  totalTime: 0,
  cycleTime: 0,
  leftTime: 0,
  cycleCount: 0,
  startedAt: null,
  lastWorkedAt: null,
  report: '',
  createdAt: null
}
export const WORK_PROPS = Object.keys(DEFAULT_WORK);

export interface PrefsDataType {
  duree: number;
  clock: 'mini' | 'medium' | 'big';
  theme: 'dark' | 'light';
  random: boolean;
  shortest: boolean; 
  counter: 'clock' | 'countdown';
  lang: 'fr' | 'en';
  scriptBtn?: string;
}
