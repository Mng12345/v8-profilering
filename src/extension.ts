// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode'
import {
  EXTENSION_NAME,
  PROCESSED_FILE_NAME,
  V8_PROFILERING_LOG,
} from './constant'
import * as fsp from 'fs/promises'
import * as fs from 'fs'
import * as cp from 'child_process'
import * as path from 'path'
import { sleep } from 'mng-easy-util/file'
import { stringifyNoCircle } from 'mng-easy-util/json'

type ParseV8LogResult = {
  status: boolean
  content: string
}

async function cleanFile(filePath: string): Promise<boolean> {
  try {
    await fsp.access(filePath)
    try {
      await fsp.writeFile(filePath, '')
      return true
    } catch (e: any) {
      vscode.window.showErrorMessage(
        `clean file \`${filePath}\` failed with error: ${e.message}`
      )
      return false
    }
  } catch (e: any) {
    try {
      await fsp.writeFile(filePath, '')
      return true
    } catch (e: any) {
      vscode.window.showErrorMessage(
        `create file \`${filePath}\` failed with error: ${e.message}`
      )
    }
  }
  return false
}

async function parseV8Log(filePath: string): Promise<ParseV8LogResult> {
  const dir = path.parse(filePath).dir
  const processedFilePath = path.resolve(dir, PROCESSED_FILE_NAME)
  const logPath = path.resolve(dir, V8_PROFILERING_LOG)
  const cleanProcessedFile = await cleanFile(processedFilePath)
  const cleanLogFile = await cleanFile(logPath)
  if (!cleanProcessedFile || !cleanLogFile) {
    return {
      status: false,
      content: '',
    }
  }
  const process = cp.spawn('node', ['--prof-process', filePath])
  process.stdout.on('data', async (data: any) => {
    await fsp.appendFile(processedFilePath, data)
  })
  process.stderr.on('data', async (data: any) => {
    await fsp.appendFile(logPath, data)
  })
  return new Promise((resolve, reject) => {
    if (!process.pid) {
      vscode.window.showErrorMessage(
        `start child process to run node --prof-process failed`
      )
      resolve({
        status: false,
        content: '',
      })
    } else {
      let status = false
      process.addListener('exit', async (code: number) => {
        // read processed file
        const content = (await fsp.readFile(
          processedFilePath
        )) as unknown as string
        vscode.window.showInformationMessage(
          `processing ${processedFilePath} done with code ${code}.`
        )
        status = true
        resolve({
          status: true,
          content,
        })
      })
      const timeout = 5000
      sleep(timeout).then(() => {
        if (status) return
        vscode.window.showErrorMessage(
          `read ${processedFilePath} timeout with ${timeout}ms.`
        )
        resolve({
          status: false,
          content: '',
        })
      })
    }
  })
}

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log('Congratulations, your extension "v8-profilering" is now active!')

  context.subscriptions.push(
    vscode.commands.registerCommand(`${EXTENSION_NAME}.fuck`, () => {
      const editor = vscode.window.activeTextEditor
      let lines = 0
      if (editor) {
        lines = editor.selection.end.line - editor.selection.start.line + 1
      }
      vscode.window.showInformationMessage(`selected ${lines} lines`)
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand(
      `${EXTENSION_NAME}.analyse-log`,
      async (fileUri: { fsPath: string; scheme: string }) => {
        vscode.window.showInformationMessage(
          `analysing log with fileUri[${fileUri.fsPath}]`
        )
        const parsedResult = await parseV8Log(fileUri.fsPath)
        vscode.window.showInformationMessage(`analysing done.`)
      }
    )
  )
}

// this method is called when your extension is deactivated
export function deactivate() {}
