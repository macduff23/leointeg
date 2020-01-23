import * as vscode from "vscode";
import * as child from 'child_process';
import { Constants } from "./constants";
import { LeoBridgePackage, RevealType, ArchivedPosition } from "./types";
import { LeoFiles } from "./leoFiles";
import { LeoNode } from "./leoNode";
import { LeoOutlineProvider } from "./leoOutline";
import { LeoBodyProvider } from "./leoBody";
import { LeoBridge } from "./leoBridge";
import { Config } from "./config.interface";
import { DocumentManager } from "./eamodioEditorManager/documentManager";
import { ServerService } from "./serverService";

export class LeoIntegration {
    // * Leo Editor Integration with Visual Studio Code

    // * Status Flags
    public fileOpenedReady: boolean = false;
    public leoBridgeReady: boolean = false;
    public leoIsConnecting: boolean = false;
    private _leoBridgeReadyPromise: Promise<LeoBridgePackage> | undefined; // Set when leoBridge has a leo controller ready
    private _leoBridgeActionBusy: boolean = false;

    // * Control Flags
    private _leoCyclingBodies: boolean = false; // Used when closing removed bodies: onActiveEditorChanged, onChangeEditorSelection
    private _lastOperationChangedTree: boolean = true; // Refresh helper: Structure may have changed, as opposed to selecting, opening aside, expanding and collapsing
    private _lastOperationSelectedBody: boolean = false; // Refresh helper : An already opened body has been selected, structure is unchanged

    // * Configuration Settings
    private _isSettingConfig: boolean = false;
    public config: Config = {
        treeKeepFocus: true,
        treeKeepFocusWhenAside: false,
        treeInExplorer: true,
        showOpenAside: true,
        showArrowsOnNodes: false,
        showAddOnNodes: false,
        showMarkOnNodes: false,
        showCloneOnNodes: false,
        showCopyOnNodes: false,
        invertNodeContrast: false,
        bodyEditDelay: 500,
        leoPythonCommand: "",
        startServerAutomatically: true,
        connectToServerAutomatically: true,
        connectionAddress: Constants.LEO_TCPIP_DEFAULT_ADDRESS,
        connectionPort: Constants.LEO_TCPIP_DEFAULT_PORT
    };

    // * Icon Paths
    public icons: { light: string; dark: string; }[] = [];

    // * Leo Bridge Server Process
    private _serverProcess: child.ChildProcess | undefined;

    // * File Browser
    private _leoFilesBrowser: LeoFiles;

    // * LeoBridge
    public leoBridge: LeoBridge;

    // * Outline Pane
    public leoTreeDataProvider: LeoOutlineProvider;
    public leoTreeView: vscode.TreeView<LeoNode>;
    public leoTreeExplorerView: vscode.TreeView<LeoNode>;
    private _lastSelectedLeoNode: LeoNode | undefined; // last selected node we got a hold of; leoTreeView.selection maybe newer and unprocessed
    public outlineRefreshCount: number = 0; // Used when refreshing leoTextDocumentNodesRef to protect the selected node - which may be a selected clone

    // * Outline Pane redraw/refresh 'helper flags'
    public refreshSingleNodeFlag: boolean = false; // read/cleared by leoOutline, so getTreeItem should refresh or return as-is
    public revealSelectedNode: RevealType = RevealType.NoReveal; // to be read/cleared in arrayToLeoNodesArray, to check if any should self-select

    // * Body Pane
    public leoFileSystem: LeoBodyProvider; // as per https://code.visualstudio.com/api/extension-guides/virtual-documents#file-system-api
    private _bodyUri: vscode.Uri = vscode.Uri.parse(Constants.LEO_URI_SCHEME_HEADER);
    private _bodyTextDocument: vscode.TextDocument | undefined;
    private _documentManager: DocumentManager;

    private _bodyTextDocumentSameUri: boolean = false; // Flag used when checking if clicking a node requires opening a body pane text editor
    private _bodyMainSelectionColumn: vscode.ViewColumn | undefined;
    private _forceBodyFocus: boolean = false; // Flag used to force focus in body when next 'showing' of this body occurs (after edit headline if already selected)

    // * Body pane dictionary of GNX linking to leoNodes, used when showing a body pane to force selection in outline
    // private leoTextDocumentNodesRef: { [gnx: string]: LeoNode } = {}; // Kept updated in the apToLeoNode function
    private _leoTextDocumentNodesRef: { [gnx: string]: { node: LeoNode; refreshCount: number; } } = {}; // Kept updated in the apToLeoNode function

    // * Log Pane
    public leoLogPane: vscode.OutputChannel = vscode.window.createOutputChannel("Leo Log Window"); // Copy-pasted from leo's log pane

    // * Status Bar
    public leoStatusBarItem: vscode.StatusBarItem;
    public leoObjectSelected: boolean = false; // represents having focus on a leo body, as opposed to anything else
    public statusbarNormalColor = new vscode.ThemeColor("statusBar.foreground");  // "statusBar.foreground"
    private _updateStatusBarTimeout: NodeJS.Timeout | undefined;

    // * Edit Headline Input Box
    private _editHeadlineInputOptions: vscode.InputBoxOptions = {
        ignoreFocusOut: false, // clicking outside cancels the headline change
        value: "", // will be replaced live upon showing from the node's text
        valueSelection: undefined,
        prompt: 'Edit Headline'
    };
    // * Insert Node Headline Input Box
    private _newHeadlineInputOptions: vscode.InputBoxOptions = {
        ignoreFocusOut: false, // clicking outside cancels the headline change
        value: "New Headline", // will be replaced live upon showing from the node's text
        valueSelection: undefined,
        prompt: 'Insert Node'
    };

    // * Automatic server start service
    private _serverService: ServerService;

    // * Timing
    private _bodyChangeTimeout: NodeJS.Timeout | undefined;
    private _bodyChangeTimeoutSkipped: boolean = false; // Used for instant tree node refresh trick
    private _lastBodyChangedRootRefreshedGnx: string = "";
    private _bodyLastChangedDocument: vscode.TextDocument | undefined;

    constructor(private _context: vscode.ExtensionContext) {
        // * Get configuration settings
        this._getLeoIntegSettings();

        // * Build Icon filename paths
        this.icons = Array(16)
            .fill("")
            .map((_, p_index) => {
                return {
                    light: _context.asAbsolutePath('resources/light/box' + ("0" + p_index).slice(-2) + '.svg'),
                    dark: _context.asAbsolutePath('resources/dark/box' + ("0" + p_index).slice(-2) + '.svg')
                };
            });

        // * File Browser
        this._leoFilesBrowser = new LeoFiles(_context);

        // * Setup leoBridge
        this.leoBridge = new LeoBridge(_context, this);

        // * Same data provider for both outline trees, Leo view and Explorer view
        this.leoTreeDataProvider = new LeoOutlineProvider(this);

        // * Leo view outline panes
        this.leoTreeView = vscode.window.createTreeView("leoIntegration", { showCollapseAll: true, treeDataProvider: this.leoTreeDataProvider });
        this.leoTreeView.onDidChangeSelection((p_event => this._onTreeViewChangedSelection(p_event)));
        this.leoTreeView.onDidExpandElement((p_event => this.onTreeViewExpandedElement(p_event)));
        this.leoTreeView.onDidCollapseElement((p_event => this._onTreeViewCollapsedElement(p_event)));
        this.leoTreeView.onDidChangeVisibility((p_event => this._onTreeViewVisibilityChanged(p_event, false))); // * Trigger 'show tree in Leo's view'

        // * Explorer view outline pane
        this.leoTreeExplorerView = vscode.window.createTreeView("leoIntegrationExplorer", { showCollapseAll: true, treeDataProvider: this.leoTreeDataProvider });
        this.leoTreeExplorerView.onDidChangeSelection((p_event => this._onTreeViewChangedSelection(p_event)));
        this.leoTreeExplorerView.onDidExpandElement((p_event => this.onTreeViewExpandedElement(p_event)));
        this.leoTreeExplorerView.onDidCollapseElement((p_event => this._onTreeViewCollapsedElement(p_event)));
        this.leoTreeExplorerView.onDidChangeVisibility((p_event => this._onTreeViewVisibilityChanged(p_event, true))); // * Trigger 'show tree in explorer view'

        // * Body Pane
        this.leoFileSystem = new LeoBodyProvider(this);
        this._bodyMainSelectionColumn = 1;
        // set workbench.editor.closeOnFileDelete to true

        // * DocumentManager
        this._documentManager = new DocumentManager(_context);

        // * Status bar
        // Keyboard Shortcut "Reminder/Flag" to signify keyboard shortcuts are altered in leo mode
        this.leoStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 0);
        this.leoStatusBarItem.color = Constants.LEO_STATUSBAR_COLOR;
        this.leoStatusBarItem.command = "leointeg.test"; // just call test function for now
        this.leoStatusBarItem.text = Constants.LEO_STATUSBAR_STRING; // `$(keyboard) Literate`;
        this.leoStatusBarItem.tooltip = "Leo Key Bindings are in effect";
        _context.subscriptions.push(this.leoStatusBarItem);
        this.leoStatusBarItem.hide();

        // * Automatic server start service
        this._serverService = new ServerService(_context);

        // * React to change in active panel/text editor (window.activeTextEditor) - also fires when the active editor becomes undefined
        vscode.window.onDidChangeActiveTextEditor(p_event => this._onActiveEditorChanged(p_event)); // TODO : handle deleted bodies
        // * other events
        vscode.window.onDidChangeTextEditorSelection(p_event => this._onChangeEditorSelection(p_event));
        vscode.window.onDidChangeTextEditorViewColumn(p_event => this._onChangeEditorViewColumn(p_event)); // TODO : handle deleted bodies
        vscode.window.onDidChangeVisibleTextEditors(p_event => this._onChangeVisibleEditors(p_event)); // TODO : handle deleted bodies
        vscode.window.onDidChangeWindowState(p_event => this._onChangeWindowState(p_event));

        // * React when typing and changing body pane
        vscode.workspace.onDidChangeTextDocument(p_event => this._onDocumentChanged(p_event));
        vscode.workspace.onDidSaveTextDocument(p_event => this._onDocumentSaved(p_event));

        // * React to configuration settings events
        vscode.workspace.onDidChangeConfiguration(p_event => this._onChangeConfiguration(p_event));

        // * Start server and / or connect to it (as specified in settings)
        this.startNetworkServices(); // TODO : Maybe start from extension.ts instead
    }

    public startNetworkServices(): void {
        // * (via settings) Start a server (and also connect automatically to a server upon extension activation)
        if (this.config.startServerAutomatically) {
            this.startServer();
        } else {
            // * (via settings) Connect to Leo Bridge server automatically without starting one first
            if (this.config.connectToServerAutomatically) {
                this.connect();
            }
        }
    }

    public startServer(): void {
        this._serverService.startServer(this._serverProcess, this.config.leoPythonCommand)
            .then((p_message) => {
                vscode.commands.executeCommand('setContext', Constants.CONTEXT_FLAGS.SERVER_STARTED, true); // server started
                if (this.config.connectToServerAutomatically) {
                    this.connect();
                }
            }, (p_reason) => {
                vscode.window.showErrorMessage('Error - Cannot start Server: ' + p_reason);
            });
    }

    public connect(): void {
        if (this.leoBridgeReady || this.leoIsConnecting) {
            console.log('Already connected');
            return;
        }
        this.leoIsConnecting = true;
        this._leoBridgeReadyPromise = this.leoBridge.initLeoProcess();
        this._leoBridgeReadyPromise.then((p_package) => {
            this.leoIsConnecting = false;
            if (p_package.id !== 1) {
                this.cancelConnect("Leo Bridge Connection Error: Incorrect id");
            } else {
                this.leoBridgeReady = true;
                vscode.commands.executeCommand('setContext', Constants.CONTEXT_FLAGS.BRIDGE_READY, true);
                if (!this.config.connectToServerAutomatically) {
                    vscode.window.showInformationMessage(`Connected`);
                }
            }
        },
            (p_reason) => {
                this.cancelConnect("Leo Bridge Connection Failed");
            });
    }

    public cancelConnect(p_message?: string): void {
        // * Also called from leoBridge.ts when its websocket reports disconnection
        if (this.leoBridgeReady) {
            // * Real disconnect error versus a simple 'failed to connect'
            vscode.window.showErrorMessage(p_message ? p_message : "Disconnected");
            vscode.commands.executeCommand('setContext', Constants.CONTEXT_FLAGS.DISCONNECTED, true);
        } else {
            vscode.window.showInformationMessage(p_message ? p_message : "Disconnected");
        }

        vscode.commands.executeCommand('setContext', Constants.CONTEXT_FLAGS.TREE_OPENED, false);
        this.fileOpenedReady = false;

        vscode.commands.executeCommand('setContext', Constants.CONTEXT_FLAGS.BRIDGE_READY, false);
        this.leoBridgeReady = false;

        this.leoIsConnecting = false;
        this._leoBridgeReadyPromise = undefined;
        this.leoObjectSelected = false;
        this._updateStatusBar();

        this.leoTreeDataProvider.refreshTreeRoot(RevealType.RevealSelect);
    }

    public setLeoIntegSettings(p_changes: { code: string, value: any }[]): Promise<void> {
        // also returns as a promise in case additional procedures need to be run on completion
        this._isSettingConfig = true;
        const w_promises: Thenable<void>[] = [];
        const w_vscodeConfig = vscode.workspace.getConfiguration('leoIntegration');

        p_changes.forEach(change => {
            if (w_vscodeConfig.inspect(change.code)!.defaultValue === change.value) {
                // set as undefined - same as default
                w_promises.push(w_vscodeConfig.update(change.code, undefined, true));
                // console.log('clearing ', change.code, 'to undefined');
            } else {
                // set as value which is not default
                w_promises.push(w_vscodeConfig.update(change.code, change.value, true));
                // console.log('setting ', change.code, 'to ', change.value);
            }
        });

        return Promise.all(w_promises).then(() => {
            this._isSettingConfig = false;
            this._getLeoIntegSettings();
        });
    }

    private _getLeoIntegSettings(): void {
        if (this._isSettingConfig) {
            return; // * Currently setting config, wait until its done all, and this will be called automatically
        } else {
            // * Graphic and theme settings
            this.config.invertNodeContrast = vscode.workspace.getConfiguration('leoIntegration').get('invertNodeContrast', false);
            // * Interface elements visibility
            this.config.treeInExplorer = vscode.workspace.getConfiguration('leoIntegration').get('treeInExplorer', true);
            this.config.showOpenAside = vscode.workspace.getConfiguration('leoIntegration').get('showOpenAside', true);
            this.config.showArrowsOnNodes = vscode.workspace.getConfiguration('leoIntegration').get('showArrowsOnNodes', false);
            this.config.showAddOnNodes = vscode.workspace.getConfiguration('leoIntegration').get('showAddOnNodes', false);
            this.config.showMarkOnNodes = vscode.workspace.getConfiguration('leoIntegration').get('showMarkOnNodes', false);
            this.config.showCloneOnNodes = vscode.workspace.getConfiguration('leoIntegration').get('showCloneOnNodes', false);
            this.config.showCopyOnNodes = vscode.workspace.getConfiguration('leoIntegration').get('showCopyOnNodes', false);
            // * Interface settings
            this.config.treeKeepFocus = vscode.workspace.getConfiguration('leoIntegration').get('treeKeepFocus', true);
            this.config.treeKeepFocusWhenAside = vscode.workspace.getConfiguration('leoIntegration').get('treeKeepFocusWhenAside', false);
            this.config.bodyEditDelay = vscode.workspace.getConfiguration('leoIntegration').get('bodyEditDelay', 500);
            // * Server and connection automation
            this.config.leoPythonCommand = vscode.workspace.getConfiguration('leoIntegration').get('leoPythonCommand', "");
            this.config.startServerAutomatically = vscode.workspace.getConfiguration('leoIntegration').get('startServerAutomatically', true);
            this.config.connectToServerAutomatically = vscode.workspace.getConfiguration('leoIntegration').get('connectToServerAutomatically', true);
            this.config.connectionAddress = vscode.workspace.getConfiguration('leoIntegration').get('connectionAddress', Constants.LEO_TCPIP_DEFAULT_ADDRESS); // 'ws://'
            this.config.connectionPort = vscode.workspace.getConfiguration('leoIntegration').get('connectionPort', Constants.LEO_TCPIP_DEFAULT_PORT); // 32125
            // * Set context for tree items visibility that are based on config options
            vscode.commands.executeCommand('setContext', Constants.CONTEXT_FLAGS.TREE_IN_EXPLORER, this.config.treeInExplorer);
            vscode.commands.executeCommand('setContext', Constants.CONTEXT_FLAGS.SHOW_OPEN_ASIDE, this.config.showOpenAside);
            vscode.commands.executeCommand('setContext', Constants.CONTEXT_FLAGS.SHOW_ARROWS, this.config.showArrowsOnNodes);
            vscode.commands.executeCommand('setContext', Constants.CONTEXT_FLAGS.SHOW_ADD, this.config.showAddOnNodes);
            vscode.commands.executeCommand('setContext', Constants.CONTEXT_FLAGS.SHOW_MARK, this.config.showMarkOnNodes);
            vscode.commands.executeCommand('setContext', Constants.CONTEXT_FLAGS.SHOW_CLONE, this.config.showCloneOnNodes);
            vscode.commands.executeCommand('setContext', Constants.CONTEXT_FLAGS.SHOW_COPY, this.config.showCopyOnNodes);
        }
    }

    private _onChangeConfiguration(p_event: vscode.ConfigurationChangeEvent): void {
        if (p_event.affectsConfiguration('leoIntegration')) {
            // console.log('Detected Change of vscode config in leoIntegration !');
            this._getLeoIntegSettings();
        }
    }

    private _onTreeViewChangedSelection(p_event: vscode.TreeViewSelectionChangeEvent<LeoNode>): void {
        // * We capture and act upon the the 'select node' command, so this event is redundant for now
        // console.log("treeViewChangedSelection, selection length:", p_event.selection.length);
    }
    private onTreeViewExpandedElement(p_event: vscode.TreeViewExpansionEvent<LeoNode>): void {
        // * May reveal nodes, but this event occurs *after* the getChildren event from the tree provider, so not useful to interfere in it.
        this.leoBridge.action("expandNode", p_event.element.apJson).then(() => {
            // console.log('back from expand');
        });
    }
    private _onTreeViewCollapsedElement(p_event: vscode.TreeViewExpansionEvent<LeoNode>): void {
        this.leoBridge.action("collapseNode", p_event.element.apJson).then(() => {
            // console.log('back from collapse');
        });
    }

    private _onTreeViewVisibilityChanged(p_event: vscode.TreeViewVisibilityChangeEvent, p_explorerView: boolean): void {
        if (p_event.visible && this._lastSelectedLeoNode) {
            this.leoTreeDataProvider.refreshTreeRoot(RevealType.NoReveal); // TODO: test if really needed, along with timeout (0) "getSelectedNode"
            setTimeout(() => {
                this.leoBridge.action("getSelectedNode", "{}").then(
                    (p_answer: LeoBridgePackage) => {
                        this.reveal(this.apToLeoNode(p_answer.node), { select: true, focus: true });
                    }
                );
            }, 0);
        }
    }

    private _onActiveEditorChanged(p_event: vscode.TextEditor | undefined, p_internalCall?: boolean): void {
        // * Active editor should be reflected in the outline if it's a leo body pane
        if (this._leoCyclingBodies && !p_internalCall) {
            // Active Editor might change during 'delete expired gnx'
            return;
        }
        if (!p_internalCall) {
            this._triggerBodySave(); // Save in case edits were pending
        }
        // selecting another editor of the same window by the tab
        // * Status flag check
        if (!p_event && this.leoObjectSelected) {
            // console.log('status flag check');
            // this.leoObjectSelected = false; // no editor!
            // this._updateStatusBarDebounced();
            return;
        }
        // * Close and return if deleted
        if (p_event && p_event.document.uri.scheme === Constants.LEO_URI_SCHEME) {
            const w_editorGnx: string = p_event.document.uri.fsPath.substr(1);
            // If already deleted and not closed: just close it and return!
            if (!this.leoFileSystem.gnxValid(w_editorGnx)) {
                vscode.commands.executeCommand('workbench.action.closeActiveEditor')
                    .then(() => {
                        console.log('got back from "closeActiveEditor" EDITOR HAD CHANGED TO A DELETED GNX!');
                    });
                return;
            }
            // * Reveal in outline tree if needed
            const w_node: LeoNode | undefined = this._leoTextDocumentNodesRef[w_editorGnx].node;
            if (w_node && this._lastSelectedLeoNode && (this._lastSelectedLeoNode.gnx !== w_node.gnx)) {
                // * setSelectedNode will also try to find by gnx if node doesn't exit and returns what it could select
                this.leoBridge.action("setSelectedNode", w_node.apJson).then((p_answer: LeoBridgePackage) => {
                    const p_selectedNode = this.apToLeoNode(p_answer.node);
                    this._lastSelectedLeoNode = p_selectedNode;
                    this.reveal(p_selectedNode, { select: true, focus: false });
                });
            }
        }
        // * Status flag check
        if (vscode.window.activeTextEditor) {
            if (vscode.window.activeTextEditor.document.uri.scheme === Constants.LEO_URI_SCHEME) {
                if (!this.leoObjectSelected) {
                    // console.log("editor changed to : leo! SET STATUS!");
                    this.leoObjectSelected = true;
                    this._updateStatusBar();
                    return;
                }
            } else {
                // console.log("editor changed to : other, no status!");
                if (this.leoObjectSelected) {
                    this.leoObjectSelected = false;
                    this._updateStatusBar();
                    return;
                }
            }
        }
    }

    private _onChangeEditorSelection(p_event: vscode.TextEditorSelectionChangeEvent): void {
        // * Changed the selection in a text editor - just refresh the statusBar for now
        if (this._leoCyclingBodies) {
            // Active Editor might change during 'delete expired gnx'
            return;
        }
        // * Status flag check
        if (vscode.window.activeTextEditor) {
            // Yes an editor is active, just check if its leo scheme
            if (p_event.textEditor.document.uri.scheme === Constants.LEO_URI_SCHEME && vscode.window.activeTextEditor.document.uri.scheme === Constants.LEO_URI_SCHEME) {
                if (!this.leoObjectSelected) {
                    this.leoObjectSelected = true;
                    this._updateStatusBarDebounced();
                    return;
                }
            } else {
                if (this.leoObjectSelected) {
                    this.leoObjectSelected = false;
                    this._updateStatusBarDebounced();
                    return;
                }
            }
        } else {
            // No editor even active
            // if (this.leoObjectSelected) {
            //     this.leoObjectSelected = false;
            //     this._updateStatusBarDebounced();
            //     return;
            // }
        }
    }

    private _onChangeEditorViewColumn(p_event: vscode.TextEditorViewColumnChangeEvent): void {
        // * This trigger when shifting editors through closing/inserting editors or closing columns
        // * No effect when dragging editor tabs: it just closes and reopens in other column, see 'onChangeVisibleEditors'
    }

    private _onChangeVisibleEditors(p_event: vscode.TextEditor[]): void {
        // * Triggers when a different text editor in any column, either tab or body, is focused
        // * This is also what triggers after drag and drop, see onChangeEditorViewColumn
        // console.log('onDidChangeVisibleTextEditors:', p_event.length);
    }

    private _onChangeWindowState(p_event: vscode.WindowState): void {
        // * Triggers when a vscode window have gained or lost focus
    }

    private _onDocumentSaved(p_event: vscode.TextDocument): void {
        // * Edited and saved the document, does it on any document in editor
    }

    private _onDocumentChanged(p_event: vscode.TextDocumentChangeEvent): void {
        // * Edited the document: ".length" check necessary, see https://github.com/microsoft/vscode/issues/50344
        if (p_event.document.uri.scheme === Constants.LEO_URI_SCHEME && p_event.contentChanges.length) {

            if (this._bodyLastChangedDocument && (p_event.document.uri.fsPath !== this._bodyLastChangedDocument.uri.fsPath)) {
                // console.log('Switched Node while waiting edit debounce!');
                this._triggerBodySave(true); //Set p_forcedRefresh flag, this will also have cleared timeout
            }

            // * Instant tree node refresh trick: If icon should change then do it now, but only if there was no document edits pending
            if (!this._bodyChangeTimeout && !this._bodyChangeTimeoutSkipped) {
                if (this._lastSelectedLeoNode && p_event.document.uri.fsPath.substr(1) === this._lastSelectedLeoNode.gnx) {
                    if (!this._lastSelectedLeoNode.dirty || (this._lastSelectedLeoNode.hasBody === !p_event.document.getText().length)) {
                        // console.log('NO WAIT');
                        this._bodyChangeTimeoutSkipped = true;
                        this.bodySaveDocument(p_event.document, true);
                        return;
                    }
                }
            }

            this._bodyChangeTimeoutSkipped = false;
            let w_delay = this.config.bodyEditDelay; // debounce by restarting the timeout
            if (this._bodyChangeTimeout) {
                clearTimeout(this._bodyChangeTimeout);
            }
            this._bodyLastChangedDocument = p_event.document; // setup trigger
            this._bodyChangeTimeout = setTimeout(() => {
                this._triggerBodySave(); // no .then for clearing timer, done in trigger instead
            }, w_delay);
        }
    }

    private _triggerBodySave(p_forcedRefresh?: boolean): Thenable<boolean> {
        // * Clear possible timeout if triggered by event from other than 'onDocumentChanged'
        if (this._bodyChangeTimeout) {
            clearTimeout(this._bodyChangeTimeout);
        }
        this._bodyChangeTimeout = undefined; // make falsy
        // * Send body to Leo
        if (this._bodyLastChangedDocument) {
            const w_document = this._bodyLastChangedDocument; // backup
            this._bodyLastChangedDocument = undefined; // make falsy
            if (this._lastBodyChangedRootRefreshedGnx !== w_document.uri.fsPath.substr(1)) {
                p_forcedRefresh = true;
            }
            return this.bodySaveDocument(w_document, p_forcedRefresh);
        } else {
            return Promise.resolve(true);
        }
    }

    public bodySaveDocument(p_document: vscode.TextDocument, p_forceRefreshTree?: boolean): Thenable<boolean> {
        // * Sets new body text of currently selected node on leo's side (test: ALSO SAVE leo scheme file)
        if (p_document && (p_document.isDirty || p_forceRefreshTree)) {
            // * Fetch gnx and document's body text first, to be reused more than once in this method
            const w_param = {
                gnx: p_document.uri.fsPath.substr(1), // uri.fsPath.substr(1),
                body: p_document.getText()
            };
            // * Setup refresh if dirtied or filled/emptied
            let w_needsRefresh = false;
            if (this._lastSelectedLeoNode && (w_param.gnx === this._lastSelectedLeoNode.gnx)) {
                if (!this._lastSelectedLeoNode.dirty || (this._lastSelectedLeoNode.hasBody === !w_param.body.length)) {
                    w_needsRefresh = true;
                    this._lastSelectedLeoNode.dirty = true;
                    this._lastSelectedLeoNode.hasBody = !!w_param.body.length;
                }
            }
            // * Maybe it was an 'aside' body pane, if so, force a full refresh
            if (this._lastSelectedLeoNode && (w_param.gnx !== this._lastSelectedLeoNode.gnx)) {
                w_needsRefresh = true;
            }
            // * Perform refresh if needed
            // TODO : CHECK IF REFRESH IS APPROPRIATE FOR
            if (p_forceRefreshTree || (w_needsRefresh && this._lastSelectedLeoNode)) {
                // console.log(p_forceRefreshTree ? 'force refresh' : 'needed refresh');
                // * Refresh root because of need to dirty parent if in derived file
                this.leoTreeDataProvider.refreshTreeRoot(RevealType.NoReveal); // No focus this.leoTreeDataProvider.refreshTreeRoot
                this._lastBodyChangedRootRefreshedGnx = w_param.gnx;
            }
            this._bodyChangeTimeoutSkipped = false;
            return this.leoBridge.action("setBody", JSON.stringify(w_param)).then(p_result => {
                // console.log('Back from setBody to leo');
                return p_document.save();
                // return Promise.resolve(true);
            });
        } else {
            return Promise.resolve(false);
        }
    }

    public apToLeoNode(p_ap: ArchivedPosition): LeoNode {
        let w_collapse: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.None;
        if (p_ap.hasChildren) {
            w_collapse = p_ap.expanded ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed;
        }
        const w_leoNode = new LeoNode(
            p_ap.headline, p_ap.gnx, w_collapse, JSON.stringify(p_ap), !!p_ap.cloned, !!p_ap.dirty, !!p_ap.marked, !!p_ap.hasBody, this
        );
        // * keep leoTextDocumentNodesRef up to date
        if (this._leoTextDocumentNodesRef[w_leoNode.gnx]) {
            if (p_ap.selected) {
                console.log('got selected');
                this._leoTextDocumentNodesRef[w_leoNode.gnx].node = w_leoNode;
                this._leoTextDocumentNodesRef[w_leoNode.gnx].refreshCount = this.outlineRefreshCount;
            } else if (this._lastOperationChangedTree && this._leoTextDocumentNodesRef[w_leoNode.gnx].refreshCount < this.outlineRefreshCount) {
                this._leoTextDocumentNodesRef[w_leoNode.gnx].node = w_leoNode;
            } else {
                console.log('prevented');
            }
        }
        return w_leoNode;
    }

    private _revealConvertedNode(p_leoNode: LeoNode, p_selected: boolean): void {
        if (this.revealSelectedNode && p_selected) { // * revealSelectedNode flag: Reveal, select and focus or even show body pane!
            const w_selectFlag = this.revealSelectedNode >= RevealType.RevealSelect; // at least RevealSelect
            let w_focusFlag = this.revealSelectedNode >= RevealType.RevealSelectFocus;  // at least RevealSelectFocus
            if (this.revealSelectedNode === RevealType.RevealSelectShowBody) {
                w_focusFlag = false;
            }
            const w_showBodyFlag = this.revealSelectedNode >= RevealType.RevealSelectFocusShowBody; // at least RevealSelectFocusShowBody
            this.revealSelectedNode = RevealType.NoReveal; // ok reset
            if (!this._lastSelectedLeoNode && this.revealSelectedNode < RevealType.RevealSelectFocusShowBody) { // very first time
                this._lastSelectedLeoNode = p_leoNode;
            }
            setTimeout(() => {
                // don't use this.treeKeepFocus
                this.reveal(p_leoNode, { select: w_selectFlag, focus: w_focusFlag })
                    .then(() => {
                        if (w_showBodyFlag) {
                            this.selectTreeNode(p_leoNode, true);
                        }
                    });
            }, 0);
        }
    }

    public arrayToLeoNodesArray(p_array: ArchivedPosition[]): LeoNode[] {
        const w_leoNodesArray: LeoNode[] = [];
        for (let w_apData of p_array) {
            const w_leoNode = this.apToLeoNode(w_apData);
            this._revealConvertedNode(w_leoNode, w_apData.selected);
            w_leoNodesArray.push(w_leoNode);
        }
        return w_leoNodesArray;
    }

    private _locateOpenedBody(p_gnx: string): boolean {
        this._bodyTextDocumentSameUri = false;
        // * Only gets to visible editors, not every tab per editor
        // TODO : fix with newer vscode API or eamodio's hack
        vscode.window.visibleTextEditors.forEach(p_textEditor => {
            if (p_textEditor.document.uri.fsPath.substr(1) === p_gnx) {
                this._bodyTextDocumentSameUri = true;
                this._bodyMainSelectionColumn = p_textEditor.viewColumn;
                this._bodyTextDocument = p_textEditor.document;
            }
        });
        return this._bodyTextDocumentSameUri;
    }

    public reveal(p_leoNode: LeoNode, p_options?: { select?: boolean, focus?: boolean, expand?: boolean | number }): Thenable<void> {
        //* 'TreeView.reveal' for any opened leo outline
        if (this.leoTreeView.visible) {
            return this.leoTreeView.reveal(p_leoNode, p_options);
        }
        if (this.leoTreeExplorerView.visible && this.config.treeInExplorer) {
            return this.leoTreeExplorerView.reveal(p_leoNode, p_options);
        }
        // * Defaults to resolving even if both are hidden
        return Promise.resolve();
    }

    public selectTreeNode(p_node: LeoNode, p_internalCall?: boolean | undefined): Thenable<boolean> {
        // * User has selected a node via mouse click or 'enter' keypress in the outline
        // otherwise flag p_internalCall if used internally
        if (!p_internalCall) {
            this._lastOperationChangedTree = false;
            this._lastOperationSelectedBody = true;
            if (!this._leoTextDocumentNodesRef[p_node.gnx]) {
                this._leoTextDocumentNodesRef[p_node.gnx] = { node: p_node, refreshCount: this.outlineRefreshCount };
            }
        }

        let w_apJsonString: string = "";
        w_apJsonString = w_apJsonString + p_node.apJson + " ";
        w_apJsonString = w_apJsonString.trim();
        // console.log("Clicked on : ", p_node.label, w_apJsonString);

        // TODO / FIX THIS : WHY TF DOES THIS MAKE THE STATUS BAR INDICATOR FLASH BACK WHITE?
        // ! this.leoObjectSelected = true;
        // ! this.updateStatusBar();

        // TODO : Save and restore selection, along with cursor position, from selection object saved in each node (or gnx array)

        // * First check if having already this exact node selected
        if (p_node === this._lastSelectedLeoNode) {
            // same so just find and reopen
            this._locateOpenedBody(p_node.gnx);
            return this.showSelectedBodyDocument();
        }

        // * Get a promise to set selected node in Leo via leoBridge
        this.leoBridge.action("setSelectedNode", p_node.apJson).then(() => {
            // console.log('Back from setSelectedNode in Leo');
            // Place other functionality pending upon node selection here if needed
        });

        // * don't wait for promise to resolve a selection because there's no tree structure change
        this._triggerBodySave(); // trigger event to save previous document if timer to save if already started for another document

        this._lastSelectedLeoNode = p_node; // kept mostly in order to do refreshes if it changes, as opposed to a full tree refresh
        vscode.commands.executeCommand('setContext', Constants.CONTEXT_FLAGS.SELECTED_MARKED, this._lastSelectedLeoNode.marked);

        if (this._bodyTextDocument && !this._bodyTextDocument.isClosed) {

            // locateOpenedBody checks if already opened and visible,
            // locateOpenedBody also sets bodyTextDocumentSameUri, bodyMainSelectionColumn, bodyTextDocument
            this._locateOpenedBody(p_node.gnx);
            // * Save body to leo for the bodyTextDocument, then check if already opened, if not save and rename to clear undo buffer
            return this.bodySaveDocument(this._bodyTextDocument).then(p_result => {
                if (this._bodyTextDocument) { // have to re-test inside .then, oh well

                    if (this._bodyTextDocumentSameUri) {
                        this._bodyUri = vscode.Uri.parse(Constants.LEO_URI_SCHEME_HEADER + p_node.gnx);
                        return this.showSelectedBodyDocument(); // already opened in a column so just tell vscode to show it
                    } else {
                        return this._bodyTextDocument.save().then((p_result) => {
                            const w_edit = new vscode.WorkspaceEdit();
                            w_edit.renameFile(
                                this._bodyUri,
                                vscode.Uri.parse(Constants.LEO_URI_SCHEME_HEADER + p_node.gnx),
                                { overwrite: true, ignoreIfExists: true }
                            );
                            // * Rename file operation to clear undo buffer
                            return vscode.workspace.applyEdit(w_edit).then(p_result => {
                                this._bodyUri = vscode.Uri.parse(Constants.LEO_URI_SCHEME_HEADER + p_node.gnx);
                                return this.showSelectedBodyDocument();
                            });
                        });
                    }

                } else {
                    return Promise.resolve(true);
                }

            });

        } else {
            this._bodyUri = vscode.Uri.parse(Constants.LEO_URI_SCHEME_HEADER + p_node.gnx);
            return this.showSelectedBodyDocument();
        }
    }

    public showSelectedBodyDocument(): Thenable<boolean> {
        // * Make sure not to open unnecessary TextEditors
        return vscode.workspace.openTextDocument(this._bodyUri).then(p_document => {
            if (this._lastSelectedLeoNode) {
                // set entry of leoNodes Ref : leoTextDocumentNodesRef
                // (used when showing a body text, to force selection of node when editor tabs are switched)
                if (this._leoTextDocumentNodesRef[p_document.uri.fsPath.substr(1)]) {
                    if (this._leoTextDocumentNodesRef[p_document.uri.fsPath.substr(1)].refreshCount < this.outlineRefreshCount) {
                        this._leoTextDocumentNodesRef[p_document.uri.fsPath.substr(1)].node = this._lastSelectedLeoNode;
                    }
                } else {
                    this._leoTextDocumentNodesRef[p_document.uri.fsPath.substr(1)] = { node: this._lastSelectedLeoNode, refreshCount: this.outlineRefreshCount };
                }
            }
            this._bodyTextDocument = p_document;

            vscode.window.visibleTextEditors.forEach(p_textEditor => {
                if (p_textEditor.document.uri.fsPath === p_document.uri.fsPath) {
                    // console.log('new selection found last second!: ', p_textEditor.viewColumn);
                    this._bodyMainSelectionColumn = p_textEditor.viewColumn;
                    this._bodyTextDocument = p_textEditor.document;
                }
            });
            const w_keepFocus = this._forceBodyFocus ? false : this.config.treeKeepFocus;
            if (this._forceBodyFocus) {
                this._forceBodyFocus = false; // Reset this single-use flag
            }
            return vscode.window.showTextDocument(this._bodyTextDocument, {
                viewColumn: this._bodyMainSelectionColumn ? this._bodyMainSelectionColumn : 1,
                preserveFocus: w_keepFocus, // an optional flag that when true will stop the editor from taking focus
                preview: false // should text document be in preview only? set false for fully opened
                // selection: new Range( new Position(0,0), new Position(0,0) ) // TODO : Set scroll position of node if known / or top
            }).then(w_bodyEditor => {
                // w_bodyEditor.options.lineNumbers = OFFSET ; // TODO : if position is in an derived file node show relative position
                // other possible interactions: revealRange / setDecorations / visibleRanges / options.cursorStyle / options.lineNumbers
                return Promise.resolve(true);
            });
        });
    }

    public showBodyDocumentAside(p_node: LeoNode, p_internalCall?: boolean | undefined): Thenable<boolean> {
        // * User has right-clicked a node and chosen 'open aside' in the context menu
        // otherwise flag p_internalCall if used internally
        if (!p_internalCall) {
            this._lastOperationChangedTree = false;
            this._lastOperationSelectedBody = true;
        }
        // Trigger event to save previous document just in in case (if timer to save is already started for another document)
        this._triggerBodySave();
        return vscode.workspace.openTextDocument(vscode.Uri.parse(Constants.LEO_URI_SCHEME_HEADER + p_node.gnx)).then(p_document => {
            if (!this.config.treeKeepFocusWhenAside) {
                this.leoBridge.action("setSelectedNode", p_node.apJson).then((p_answer: LeoBridgePackage) => {
                    const p_selectedNode = this.apToLeoNode(p_answer.node);

                    if (this._leoTextDocumentNodesRef[p_node.gnx]) {
                        this._leoTextDocumentNodesRef[p_node.gnx].node = p_selectedNode;
                    } else {
                        this._leoTextDocumentNodesRef[p_node.gnx] = { node: p_selectedNode, refreshCount: this.outlineRefreshCount };
                    }

                    this.reveal(p_selectedNode, { select: true, focus: false });
                });
            }
            return vscode.window.showTextDocument(p_document, {
                viewColumn: vscode.ViewColumn.Beside,
                preserveFocus: this.config.treeKeepFocusWhenAside, // an optional flag that when true will stop the editor from taking focus
                preview: true // should text document be in preview only? set false for fully opened
                // selection: new Range( new Position(0,0), new Position(0,0) ) // TODO : Set scroll position of node if known / or top
            }).then(w_bodyEditor => {
                // w_bodyEditor.options.lineNumbers = OFFSET ; // TODO : if position is in an derived file node show relative position
                // other possible interactions: revealRange / setDecorations / visibleRanges / options.cursorStyle / options.lineNumbers
                return Promise.resolve(true);
            });
        });
    }

    public focusBodyIfVisible(p_gnx: string): Thenable<boolean> {
        let w_found: undefined | vscode.TextEditor;
        vscode.window.visibleTextEditors.forEach(p_textEditor => {
            if (!w_found && (p_textEditor.document.uri.fsPath.substr(1) === p_gnx)) {
                w_found = p_textEditor;
            }
        });
        if (w_found) {
            return vscode.window.showTextDocument(w_found.document, {
                viewColumn: w_found.viewColumn,
                preserveFocus: false, // an optional flag that when true will stop the editor from taking focus
                preview: false // should text document be in preview only? set false for fully opened
                // selection: new Range( new Position(0,0), new Position(0,0) ) // TODO : Set scroll position of node if known / or top
            }).then(w_bodyEditor => {
                // console.log('focusBodyIfVisible in column: ', w_bodyEditor.viewColumn);
                // w_bodyEditor.options.lineNumbers = OFFSET ; // TODO : if position is in an derived file node show relative position
                // other possible interactions: revealRange / setDecorations / visibleRanges / options.cursorStyle / options.lineNumbers
                return Promise.resolve(true);
            });
        } else {
            return Promise.resolve(false);
        }
    }

    public leoBridgeAction(p_action: string, p_node?: LeoNode): Promise<LeoBridgePackage> {
        //
        // * For actions that need no refreshes at all
        if (!p_node && this._lastSelectedLeoNode) {
            p_node = this._lastSelectedLeoNode;
        }
        if (p_node) {
            return this.leoBridge.action(p_action, p_node.apJson).then(p_package => {
                this._lastOperationChangedTree = false;
                this._lastOperationSelectedBody = false;
                return Promise.resolve(p_package);
            });
        } else {
            return Promise.resolve({ id: 0 });
        }
    }

    public leoBridgeActionAndRefresh(p_action: string, p_node?: LeoNode, p_revealType?: RevealType | undefined): Promise<LeoBridgePackage> {
        // * For actions that do not need full bodies gnx list to refresh (moving, renaming nodes)
        if (!p_node && this._lastSelectedLeoNode) {
            p_node = this._lastSelectedLeoNode;
        }
        if (p_node) {
            return this.leoBridge.action(p_action, p_node.apJson).then(p_package => {
                this._lastOperationChangedTree = true;
                this._lastOperationSelectedBody = false;
                this.leoTreeDataProvider.refreshTreeRoot(p_revealType); // refresh all, needed to get clones to refresh too!
                return Promise.resolve(p_package);
            });
        } else {
            return Promise.resolve({ id: 0 });
        }
    }

    public leoBridgeActionAndFullRefresh(p_action: string, p_node?: LeoNode, p_refreshBodyContent?: boolean): void {
        // * For actions that may delete or add nodes so that bodies gnx list need refreshing
        // * Perform action on node and close bodies of removed nodes, if any
        if (this._leoBridgeActionBusy) {
            // * Debounce by waiting for command to resolve, and also initiate refresh, before accepting other 'leo commands'
            console.log('Too fast! leoBridgeActionAndFullRefresh: ' + p_action);
        } else {
            if (!p_node && this._lastSelectedLeoNode) {
                p_node = this._lastSelectedLeoNode;
            }
            if (p_node) {
                this._leoBridgeActionBusy = true;
                this._leoCyclingBodies = true;
                // start by finishing any pending edits by triggering body save
                this._triggerBodySave()
                    .then(p_saveResult => {
                        return this.leoBridge.action(p_action, p_node!.apJson); // p_node was just checked
                    })
                    .then(p_package => {
                        // this.bodyUri = vscode.Uri.parse(Constants.LEO_URI_SCHEME_HEADER + p_package.node.gnx); // ! don't showSelectedBodyDocument yet
                        return this.leoFileSystem.getExpiredGnxList();
                    })
                    .then(p_expiredList => {
                        p_expiredList.forEach(p_expiredGnx => {
                            // console.log('expired list item gnx: ', p_expiredGnx);
                            vscode.workspace.fs.delete(vscode.Uri.parse(Constants.LEO_URI_SCHEME_HEADER + p_expiredGnx));
                        });
                        // console.log('done calling delete on all expired gnx still opened');
                        return this._documentManager.closeExpired(p_expiredList);
                    })
                    .then(p_docResult => {
                        // console.log('Back from doc manager', p_docResult);
                        // With any remaining opened text editors watched:
                        return this.leoFileSystem.getRemainingWatchedGnxList();
                    })
                    .then((p_remainingGnxList) => {
                        // console.log('Back from get remaining Gnx List', p_remainingGnxList);
                        if (p_refreshBodyContent) {
                            this.leoFileSystem.fireRefreshFiles(); // watched files may have changed their content
                        }
                        let w_located: boolean | string = false;
                        p_remainingGnxList.forEach(p_remainingGnx => {
                            if (!w_located && this._locateOpenedBody(p_remainingGnx)) {
                                w_located = p_remainingGnx;
                            }
                        });
                        return Promise.resolve(w_located);
                    })
                    .then(p_locatedResult => {
                        // console.log('Back from locate (false if not found):', p_locatedResult);
                        // * If this.lastSelectedLeoNode is undefined it will be set by arrayToLeoNodesArray when refreshing tree root
                        this._leoCyclingBodies = false;
                        this._leoBridgeActionBusy = false;
                        this._lastOperationChangedTree = true;
                        this._lastOperationSelectedBody = false;
                        this.leoTreeDataProvider.refreshTreeRoot(RevealType.RevealSelectFocusShowBody); // ! finish by refreshing the tree and selecting the node
                    });
            }
        }
    }

    public editHeadline(p_node?: LeoNode, p_isSelectedNode?: boolean) {
        if (this._leoBridgeActionBusy) {
            // * Debounce by waiting for command to resolve, and also initiate refresh, before accepting other 'leo commands'
            console.log('Too fast! editHeadline');
        } else {
            if (!p_node && this._lastSelectedLeoNode) {
                p_node = this._lastSelectedLeoNode;
            }
            if (p_node) {
                if (!p_isSelectedNode && p_node === this._lastSelectedLeoNode) {
                    p_isSelectedNode = true;
                }
                this._leoBridgeActionBusy = true;
                this._editHeadlineInputOptions.value = p_node.label; // preset input pop up
                vscode.window.showInputBox(this._editHeadlineInputOptions)
                    .then(p_newHeadline => {
                        if (p_newHeadline) {
                            p_node!.label = p_newHeadline; // ! When labels change, ids will change and that selection and expansion state cannot be kept stable anymore.
                            this.leoBridge.action("setNewHeadline", "{\"node\":" + p_node!.apJson + ", \"headline\": \"" + p_newHeadline + "\"}")
                                .then((p_answer: LeoBridgePackage) => {
                                    if (p_isSelectedNode) {
                                        this._forceBodyFocus = true;
                                    }
                                    this._lastOperationChangedTree = true;
                                    this._lastOperationSelectedBody = false;
                                    // ! p_revealSelection flag needed because we voluntarily refreshed the automatic ID
                                    this.leoTreeDataProvider.refreshTreeRoot(p_isSelectedNode ? RevealType.RevealSelect : RevealType.RevealSelectFocus); // refresh all, needed to get clones to refresh too!
                                    // focus on body pane
                                    // if (p_isSelectedNode) {
                                    //     this.focusBodyIfVisible(p_node.gnx);
                                    // }
                                    this._leoBridgeActionBusy = false;
                                }
                                );
                        } else {
                            if (p_isSelectedNode) {
                                this.focusBodyIfVisible(p_node!.gnx);
                            }
                            this._leoBridgeActionBusy = false;
                        }
                    }
                    );
            }
        }
    }

    public mark(p_node?: LeoNode): void {
        if (this._leoBridgeActionBusy) {
            // * Debounce by waiting for command to resolve, and also initiate refresh, before accepting other 'leo commands'
            console.log('Too fast! mark');
        } else {
            if (!p_node && this._lastSelectedLeoNode) {
                p_node = this._lastSelectedLeoNode;
            }
            if (p_node) {
                this._leoBridgeActionBusy = true;
                this.leoBridgeActionAndRefresh("markPNode", p_node)
                    .then(() => {
                        this._leoBridgeActionBusy = false;
                    });
                vscode.commands.executeCommand('setContext', Constants.CONTEXT_FLAGS.SELECTED_MARKED, true);
            }
        }
    }

    public unmark(p_node?: LeoNode): void {
        if (this._leoBridgeActionBusy) {
            // * Debounce by waiting for command to resolve, and also initiate refresh, before accepting other 'leo commands'
            console.log('Too fast! unmark');
        } else {
            if (!p_node && this._lastSelectedLeoNode) {
                p_node = this._lastSelectedLeoNode;
            }
            if (p_node) {
                this._leoBridgeActionBusy = true;
                this.leoBridgeActionAndRefresh("unmarkPNode", p_node)
                    .then(() => {
                        this._leoBridgeActionBusy = false;
                    });
                vscode.commands.executeCommand('setContext', Constants.CONTEXT_FLAGS.SELECTED_MARKED, false);
            }
        }
    }

    public insertNode(p_node?: LeoNode): void {
        if (this._leoBridgeActionBusy) {
            // * Debounce by waiting for command to resolve, and also initiate refresh, before accepting other 'leo commands'
            console.log('Too fast! insert');
        } else {
            if (!p_node && this._lastSelectedLeoNode) {
                p_node = this._lastSelectedLeoNode;
            }
            if (p_node) {
                const w_node = p_node; // ref for .then
                // * New way of doing inserts: Show the input headline box, then either create the new node with the input, or with "New Headline" if canceled
                this._leoBridgeActionBusy = true;
                vscode.window.showInputBox(this._newHeadlineInputOptions)
                    .then(p_newHeadline => {
                        const w_action = p_newHeadline ? "insertNamedPNode" : "insertPNode";
                        const w_para = p_newHeadline ? "{\"node\":" + w_node!.apJson + ", \"headline\": \"" + p_newHeadline + "\"}" : w_node.apJson;
                        this.leoBridge.action(w_action, w_para)
                            .then(p_package => {
                                this.leoFileSystem.addGnx(p_package.node.gnx);
                                this._lastOperationChangedTree = true;
                                this._lastOperationSelectedBody = false;
                                this._forceBodyFocus = true;
                                this.leoTreeDataProvider.refreshTreeRoot(RevealType.RevealSelectShowBody); // refresh all, needed to get clones to refresh too!
                                // this.focusBodyIfVisible(p_package.node.gnx);
                                this._leoBridgeActionBusy = false;
                            });
                    });

                /*
                * Old way of doing inserts tried to mimic Leo by showing you it created a new node in the outline, while allowing you to edit its headline
                this.leoBridge.action("insertPNode", p_node.apJson)
                    .then(p_package => {
                        this.leoFileSystem.addGnx(p_package.node.gnx);
                        this._lastOperationChangedTree = true;
                        this._lastOperationSelectedBody = false;
                        this.leoTreeDataProvider.refreshTreeRoot(RevealType.RevealSelectShowBody); // refresh all, needed to get clones to refresh too!

                        this._newHeadlineInputOptions.value = p_package.node.headline; // preset input pop up
                        this._leoBridgeActionBusy = false;
                        vscode.window.showInputBox(this._newHeadlineInputOptions)
                            .then(p_newHeadline => {
                                if (p_newHeadline) {
                                    // ! When labels change, ids will change and that selection and expansion state cannot be kept stable anymore.
                                    p_node!.label = p_newHeadline;
                                    this.leoBridge.action("setNewHeadline", "{\"node\":" + JSON.stringify(p_package.node) + ", \"headline\": \"" + p_newHeadline + "\"}")
                                        .then((p_answer: LeoBridgePackage) => {
                                            this._forceBodyFocus = true;
                                            // ! p_revealSelection flag needed because we voluntarily refreshed the automatic ID
                                            this.leoTreeDataProvider.refreshTreeRoot(RevealType.RevealSelect); // refresh all, needed to get clones to refresh too!
                                        });
                                } else {
                                    this.leoTreeDataProvider.refreshTreeRoot(RevealType.RevealSelect); // refresh all, needed to get clones to refresh too!
                                    this.focusBodyIfVisible(p_node!.gnx);
                                }
                            });
                    });
                */
            }
        }
    }

    // * Critical Leo Bridge Actions
    public undo(): void {
        if (this._leoBridgeActionBusy) {
            // * Debounce by waiting for command to resolve, and also initiate refresh, before accepting other 'leo commands'
            console.log('Too fast! undo');
            return;
        }
        if (this._lastSelectedLeoNode) {
            this.leoBridgeActionAndFullRefresh("undo", this._lastSelectedLeoNode, true);
        }
    }

    public executeScript(): void {
        vscode.window.showInformationMessage(`TODO: executeScript`); // temp placeholder
    }

    public saveLeoFile(): void {
        vscode.window.showInformationMessage(`TODO: saveLeoFile : Try to save Leo File`); // temp placeholder
    }

    public closeLeoFile(): void {
        if (this.fileOpenedReady) {
            vscode.window.showInformationMessage(`TODO: close leo file`); // temp placeholder
        } else {
            console.log('Error: Cannot close. No Files Opened.');
        }
    }

    public openLeoFile(): void {
        if (this.fileOpenedReady) {
            vscode.window.showInformationMessage("leo file already opened!");
            return;
        }
        this._leoFilesBrowser.getLeoFileUrl()
            .then(p_chosenLeoFile => {
                return this.leoBridge.action("openFile", '"' + p_chosenLeoFile + '"');
            }, p_reason => {
                // console.log('canceled', p_reason); // File Open is Canceled - Ignore
                return Promise.reject(p_reason);
            })
            .then((p_result: LeoBridgePackage) => {
                // TODO : Validate p_result
                // * Start body pane system
                this._context.subscriptions.push(vscode.workspace.registerFileSystemProvider(Constants.LEO_URI_SCHEME, this.leoFileSystem, { isCaseSensitive: true }));
                // * Startup flag
                this.fileOpenedReady = true;
                // * First valid redraw of tree
                this.leoTreeDataProvider.refreshTreeRoot(RevealType.RevealSelect); // p_revealSelection flag set
                // * set body URI for body filesystem
                this._bodyUri = vscode.Uri.parse(Constants.LEO_URI_SCHEME_HEADER + p_result.node.gnx);
                // * First StatusBar appearance
                this._updateStatusBar();
                this.leoStatusBarItem.show();
                // * Show leo log pane
                this.leoLogPane.show(true);
                // * First Body appearance
                return this.leoFileSystem.refreshPossibleGnxList();
            })
            .then(p_list => {
                return vscode.commands.executeCommand('setContext', Constants.CONTEXT_FLAGS.TREE_OPENED, true);
            })
            .then(p_result => {
                return this.showSelectedBodyDocument();
            });
    }

    private _updateStatusBarDebounced(): void {
        if (this._updateStatusBarTimeout) {
            clearTimeout(this._updateStatusBarTimeout);
        }
        this._updateStatusBarTimeout = setTimeout(() => {
            this._updateStatusBar();
        }, 200);
    }

    private _updateStatusBar(): void {
        if (this._updateStatusBarTimeout) { // Can be called directly, so clear timer if any
            clearTimeout(this._updateStatusBarTimeout);
        }
        vscode.commands.executeCommand('setContext', Constants.CONTEXT_FLAGS.LEO_SELECTED, !!this.leoObjectSelected);
        if (this.leoObjectSelected && this.fileOpenedReady) { // * Also check in constructor for statusBar properties (the createStatusBarItem call itself)
            this.leoStatusBarItem.color = Constants.LEO_STATUSBAR_COLOR;
            this.leoStatusBarItem.tooltip = "Leo Key Bindings are in effect";
            // this.leoStatusBarItem.text = Constants.LEO_STATUSBAR_STRING; // `$(keyboard) Literate `;
            // this.leoStatusBarItem.show();
        } else {
            this.leoStatusBarItem.color = this.statusbarNormalColor;
            this.leoStatusBarItem.tooltip = "Leo Key Bindings off";
            // this.leoStatusBarItem.hide();
        }
    }

    private _showLeoCommands(): void {
        // * Status bar indicator clicked: Offer all leo commands in the command palette
        vscode.commands.executeCommand('workbench.action.quickOpen', '>leo: ');
    }

    public setTreeViewTitle(p_title: string): void {
        // TODO - Available soon, see enable-proposed-api https://code.visualstudio.com/updates/v1_39#_treeview-message-api
        // * Set/Change outline pane title e.g. "NOT CONNECTED", "CONNECTED", "LEO: OUTLINE"
        // this.leoTreeView.title = p_title;
        // this.leoTreeExplorerView.title = p_title; // "NOT CONNECTED", "CONNECTED", "LEO: OUTLINE"
    }

    public test(): void {
        if (this.fileOpenedReady) {
            // this._showLeoCommands();
            // console.log("sending test 'getSelectedNode'");
            // * if no parameter required, still send "{}"
            this.leoBridge.action("getSelectedNode", "{}")
                .then((p_answer: LeoBridgePackage) => {
                    console.log('Test got Back from getSelectedNode, now revealing :', p_answer.node.headline, p_answer.node.childIndex);
                    // this.leoTreeDataProvider.refreshTreeRoot(RevealType.RevealSelect);
                    // this._lastOperationChangedTree = true;
                    // this.outlineRefreshCount = this.outlineRefreshCount + 1;
                    // return Promise.resolve(this.reveal(this.apToLeoNode(p_answer.node), { select: true, focus: true }));
                    this.reveal(this.apToLeoNode(p_answer.node), { select: false, focus: false }).then(() => {
                        this.leoTreeDataProvider.refreshTreeRoot(RevealType.RevealSelect);
                        this._showLeoCommands(); // lol
                    });
                });

            // .then(() => {
            //     console.log("...now testing documentManager ");
            //     return this.documentManager.countOpen();
            // })
            // .then(p_docResult => {
            //     console.log('Back from doc manager', p_docResult);
            // });
        } else {
            vscode.window.showInformationMessage("Click the folder icon on the Leo Outline sidebar to open a Leo file");
        }
    }
}