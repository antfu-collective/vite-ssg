import { Worker } from "node:worker_threads"

import { WorkerDataEntry } from "./build.worker"

type WorKerConstructorArgs = ConstructorParameters<typeof Worker>
type WorkerPath = WorKerConstructorArgs[0]
type WorkerOptions = Omit<WorKerConstructorArgs[1], 'workerData'> & {workerData: WorkerDataEntry}
type Logger = {
  info: (msg: string) => void
  warn: (msg: string) => void
  error: (msg: string) => void
  log: (msg: string) => void
  trace: (msg: string) => void
  debug: (msg: string) => void
  
}

export class BuildWorkerProxy {
  private worker: Worker
  private pending: Map<string, {resolve: (result: any) => void, reject: (error: any) => void}> = new Map()
  constructor(path: WorkerPath, options: WorkerOptions) {
    this.worker = new Worker(path, options)
    this.worker.on('message', (message) => {
      const {type, level='info', args = []} = message
      if(type !== 'log') return
      const fn = console[level as keyof Logger]?.bind(console)
      let msg = args.map((arg:any) => typeof arg === 'object' && !!arg ? "[object]" : arg).join(' ')
      const workerId = options.workerData.workerId
      // process.stdout.write(`[${workerId}] ${msg}\n`)
      fn?.(`[woker #${workerId}] ${msg}`)
    })

    this.worker.on('message', (message) => {
      const {id, type, result = undefined, error = undefined} = message   
      if(!this.pending.has(id)) return
      const {resolve, reject} = this.pending.get(id)!
      if (type === 'result') {
        resolve(result)
      }
      if (type === 'error') {
        reject(error)
      }
    })
  }
  on(type: string, listener: (...args: any[]) => void) {
    this.worker.on(type, listener)
  }
  off(type: string, listener: (...args: any[]) => void) {
    this.worker.off(type, listener)
  }

  async send(type: string, args: any[]) : Promise<any> {
    const id = crypto.randomUUID()    
    const promise =  new Promise((resolve, reject) => {
      this.worker.postMessage({type, id, args})            
      this.pending.set(id, {resolve, reject})
    })    
    promise.finally(() => {
      this.pending.delete(id)
    })
    return promise
  }
  terminate() {
    this.worker.terminate()
  }
  
}