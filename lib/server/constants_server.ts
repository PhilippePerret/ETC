import log from '../shared/log';

export const userDataPath = process.env.USER_DATA_PATH;
export const PORT = process.env.PORT;
export const HOST = process.env.HOST;
export const ENV = process.env.NODE_ENV;

log.info("ENV = ", ENV);
