import * as vscode from "vscode";
import { Constants } from "./constants";
import * as path from "path"; // TODO: Use this library to have reliable support for window-vs-linux file-paths

export class LeoFiles {
    // * Handles opening of file browser for choosing leo files to open

    private _fileBrowserOpen: boolean = false;

    constructor(private _context: vscode.ExtensionContext) { }

    private _getBestOpenFolderUri(): vscode.Uri {
        // Find a folder to propose when opening the browse-for-leo-file chooser
        let w_openedFileEnvUri: vscode.Uri | boolean = false;
        let w_activeUri: vscode.Uri | undefined = undefined;

        // let w_activeUri: Uri | undefined = vscode.window.activeTextEditor?vscode.window.activeTextEditor.document.uri:undefined;
        if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders[0]) {
            w_activeUri = vscode.workspace.workspaceFolders[0].uri;
        }

        if (w_activeUri) {
            const w_defaultFolder = vscode.workspace.getWorkspaceFolder(w_activeUri);
            if (w_defaultFolder) {
                w_openedFileEnvUri = w_defaultFolder.uri; // Set as current opened document-path's folder
            }
        }
        if (!w_openedFileEnvUri) {
            w_openedFileEnvUri = vscode.Uri.file("~"); // TODO : set as home folder properly, this doesn't work
            // ! EXAMPLE WITH os : const homedir = require('os').homedir();
        }
        return w_openedFileEnvUri;
    }

    // TODO : Use 'path' library to have reliable support for Windows
    public getLeoFileUrl(): Promise<string> {
        if (this._fileBrowserOpen) {
            return Promise.resolve("");
        }
        return new Promise((resolve, reject) => {
            vscode.window
                .showOpenDialog({
                    canSelectMany: false,
                    defaultUri: this._getBestOpenFolderUri(),
                    filters: {
                        "Leo Files": [Constants.LEO_FILE_TYPE_EXTENSION]
                    }
                })
                .then(p_chosenLeoFile => {
                    this._fileBrowserOpen = false;
                    if (p_chosenLeoFile) {
                        resolve(p_chosenLeoFile[0].fsPath.replace(/\\/g, "/")); // Replace backslashes for windows support
                    } else {
                        reject("");
                    }
                });
        });
    }
}