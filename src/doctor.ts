import * as _ts from 'typescript'
import * as fs from 'fs'
import * as path from 'path'
import { createHost, createService } from './langSvc'
import { Reporter } from './reporter'
import { FileEntry } from './types'
import { getAllLibs, uniq } from './utils'
import stripJsonComments from 'strip-json-comments'

export class Doctor {
  private service: _ts.LanguageService
  public reporter: Reporter

  scriptVersions: FileEntry = new Map()

  constructor(public fileNames: string[], private compilerOptions: _ts.CompilerOptions, ts: typeof _ts) {
    const host = createHost(fileNames, compilerOptions, this.scriptVersions, ts)
    this.service = createService(host, ts)
    this.reporter = new Reporter(ts)
  }

  static fromConfigFile(configPath: string, ts: typeof _ts): Doctor {
    const content = stripJsonComments(fs.readFileSync(configPath).toString(), {whitespace: false});
    try {
      const parsed = ts.parseJsonConfigFileContent(
        JSON.parse(content),
        ts.sys,
        path.dirname(configPath)
      );
      const compilerOptions = parsed.options

      const defaultLibFileName = _ts.getDefaultLibFileName(compilerOptions)
      const libs =  [defaultLibFileName, ...(compilerOptions.lib || [])]
      const allLibs = getAllLibs(uniq(libs))

      /**
       * Note:
       * 
       * since we use CDN-hosted TS runtime, which is a bundled version,
       * we need to manually added lib.*.d.ts. 
       */
      const fileNames = [
        ...parsed.fileNames,
        ...allLibs
      ]

      return new Doctor(fileNames, compilerOptions, ts)
    } catch (error) {
      console.error(error)
      throw error
    }
  }

  getSemanticDiagnostics() {
    const { service } = this
    const result = service.getProgram()!.getSemanticDiagnostics()
    return [...result]
  }
}
