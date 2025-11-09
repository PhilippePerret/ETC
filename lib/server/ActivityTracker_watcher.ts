// lib/ActivityTracker_worker.ts
import log from '../shared/log';
import { isUserWorkingOnProject } from './Activity_isUserWorking';

self.addEventListener('message', (event: MessageEvent) => {
  const { folder, lastCheckAt } = event.data;
  const isActive = isUserWorkingOnProject(folder, lastCheckAt);
  log.info('Worker - isActive:', isActive);
  self.postMessage({ active: isActive });
});
