import express from 'express';
import log from '../shared/log';
import { setupRoutes } from './routes';
import { HOST, PORT } from '../server/constants_server';

const app = express();

// --- middleware ---
app.use(express.json());
app.use(express.static('public'));

// --- Définition des routes ---
setupRoutes(app);

app.listen(PORT, () => {
  log.info(`Server running on ${HOST}`);
});
