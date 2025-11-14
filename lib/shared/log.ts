import path from 'path';
import * as os from 'os';
import { appendFileSync, existsSync, mkdirSync } from "fs";
import { serverSide } from "./which_side";
// import { format as prettyFormat } from 'pretty-format';

const PATHS = {
  log: path.join(os.homedir(), 'Library', 'Logs')
};

class Log { /* singleton log */

  public info(message: string, data: any | undefined = undefined){
    serverSide && this.logInFile(message, data, 'info');
  }
  
  public warn(message: string, data: any | undefined = undefined){
    serverSide && this.logInFile(message, data, 'warn');
  }
  public error(message: string, data: any | undefined = undefined){
    serverSide && this.logInFile(message, data, 'error');
  }

  private logInFile(message: string, data: any, errorLevel: 'info' | 'warn' | 'error'){
    if (data) {
      console[errorLevel](message, data);
      data = JSON.stringify(data);
      message += "\n" + data;
    } else {
      console[errorLevel](message);
    }
    message = `[${this.now()}] ${this.PREFIXBYERRORLEVEL[errorLevel]}${message}`
    appendFileSync(this.logFile, message, 'utf8'); 
  }

  private now(){
    const n = new Date();
    const year = n.getFullYear();
    const month = (n.getMonth() + 1).toString(10).padStart(2,'0');
    const day = n.getDate().toString(10).padStart(2,'0');
    const hour = n.getHours().toString(10).padStart(2,'0');
    const minute = n.getMinutes().toString(10).padStart(2,'0');
    const second = n.getSeconds().toString(10).padStart(2,'0');
    return `${year}-${month}-${day} ${hour}:${minute}:${second}`
  }

  PREFIXBYERRORLEVEL = {
    info: '', error: 'ERROR: ', warn: 'WARN: '
  }
  private get logFile(){
    return this._logfile || (this._logfile = this.ensureLogFile())
  }; private _logfile!: string;

  private ensureLogFile(){
    existsSync(PATHS.log) || mkdirSync(PATHS.log);
    return path.join(PATHS.log, 'ETC', 'main.log');
  }

  private constructor(){}
  private static _inst: Log;
  public static singleton(){ return this._inst || (this._inst = new Log())}
}

const log = Log.singleton();
export default log;