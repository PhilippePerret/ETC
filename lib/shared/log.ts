

class Log { /* singleton log */

  public info(message: string, data: any | undefined = undefined){
    console.log(message, data)
  }
  public warn(message: string, data: any | undefined = undefined){
    console.warn(message, data)
  }
  public error(message: string, data: any | undefined = undefined){
    console.error(message, data)
  }


  private constructor(){}
  private static _inst: Log;
  public static singleton(){ return this._inst || (this._inst = new Log())}
}

const log = Log.singleton();
export default log;