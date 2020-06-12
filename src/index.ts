import * as path from 'path'
import * as fs from 'fs'
import { DiagnosticCategory } from 'typescript'
import { getInput, setFailed } from '@actions/core'
import * as YarnLockFile from '@yarnpkg/lockfile'
import { Doctor } from './doctor'
import { loadTSModule } from './loadTSModule'

function parseTSVersion(currentDir: string) {
  const yarnLockFilePath = path.resolve(currentDir, 'yarn.lock')
  const packageLockFile = path.resolve(currentDir, 'package-lock.json')
  if (fs.existsSync(yarnLockFilePath)) {
    const content = fs.readFileSync(yarnLockFilePath, 'utf8')
    return parseTSVersionFromYarnLockFile(content)
  } else if (fs.existsSync(packageLockFile)) {
    const content = fs.readFileSync(packageLockFile, 'utf8')
    return parseTSVersionFromPackageLockFile(content)
  } else {
    throw new Error('no lock file found.')
  }
}

function parseTSVersionFromYarnLockFile(content: string) {
  const { type, object } = YarnLockFile.parse(content)
  if (type !== 'success') {
    throw new Error('failed to parse yarn.lock')
  }
  const packages = Object.keys(object)
  const _typescript = packages.find(p => /^typescript@.*/.test(p))
  if (!_typescript) {
    throw new Error('could not find typescript in yarn.lock')
  }
  const _typescriptInfo = object[_typescript]
  const tsVersion = _typescriptInfo && _typescriptInfo['version']
  if (typeof tsVersion !== 'string') {
    throw new Error('could not par typescript version from yarn.lock')
  }
  return tsVersion
}

function parseTSVersionFromPackageLockFile(content: string) {
  const json = JSON.parse(content)
  const dependencies = json['dependencies'] || {}
  const _typescriptInfo = dependencies['typescript']
  if (!_typescriptInfo) {
    throw new Error('could not find typescript in package-lock.json')
  }
  const tsVersion = _typescriptInfo['version']
  if (typeof tsVersion !== 'string') {
    throw new Error('could not par typescript version from yarn.lock')
  }
  return tsVersion
}

async function main() {
  try {

    let currentDir = getInput('workingDirectory', {
      required: false,
    })

    if (currentDir === '') {
      currentDir = process.cwd()
    }

    const configPath = path.resolve(currentDir, 'tsconfig.json')
    if (!fs.existsSync(configPath)) {
      throw new Error(`could not find tsconfig.json at: ${currentDir}`)
    }

    const tsVersion = parseTSVersion(currentDir)
    const remoteTS = await loadTSModule(tsVersion)
  
    const doctor = Doctor.fromConfigFile(configPath, remoteTS)
    const diagnostics = doctor.getSemanticDiagnostics()

    if (diagnostics) {
      doctor.reporter.reportDiagnostics(diagnostics)
      const errors = diagnostics.filter(d => d.category === DiagnosticCategory.Error)
      if (errors.length) {
        setFailed(`Found ${errors.length} errors!`)
      }
    }

  } catch (e) {
    setFailed(e)
  }
}

main()
