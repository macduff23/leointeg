import * as vscode from "vscode";
import * as utils from "./utils";
import { Constants } from "./constants";
import { RevealType, RefreshType } from "./types";
import { LeoIntegration } from "./leoIntegration";
import { LeoNode } from "./leoNode";
import { LeoSettingsWebview } from "./webviews/leoSettingsWebview";

export function activate(context: vscode.ExtensionContext) {
    // * Called when extension is activated
    const start = process.hrtime(); // For calculating total startup time duration

    const leoInteg = vscode.extensions.getExtension(Constants.PUBLISHER + '.' + Constants.NAME)!;

    const leoIntegVersion = leoInteg.packageJSON.version;

    const previousVersion = context.globalState.get<string>(Constants.VERSION_STATE_KEY);

    const leoIntegration: LeoIntegration = new LeoIntegration(context);
    const leoSettingsWebview: LeoSettingsWebview = new LeoSettingsWebview(context, leoIntegration);

    // * Reset Extension context flags (used in 'when' clauses in package.json)
    utils.setContext(Constants.CONTEXT_FLAGS.BRIDGE_READY, false); // connected to a leobridge server?
    utils.setContext(Constants.CONTEXT_FLAGS.TREE_OPENED, false); // Having a Leo file opened on that server?

    const w_cmdPrefix = Constants.NAME + ".";
    const w_commands: [string, (...args: any[]) => any][] = [

        [w_cmdPrefix + "test", () => leoIntegration.test()], // * Test function useful when debugging
        [w_cmdPrefix + "testFromOutline", () => leoIntegration.test(true)], // * Test function useful when debugging

        [w_cmdPrefix + Constants.COMMANDS.SHOW_WELCOME, () => leoSettingsWebview.openWebview()],
        [w_cmdPrefix + Constants.COMMANDS.SHOW_SETTINGS, () => leoSettingsWebview.openWebview()], // Same as 'show welcome screen'
        [w_cmdPrefix + Constants.COMMANDS.START_SERVER, () => leoIntegration.startServer()],
        [w_cmdPrefix + Constants.COMMANDS.CONNECT, () => leoIntegration.connect()],
        [w_cmdPrefix + Constants.COMMANDS.SHOW_LOG, () => leoIntegration.showLogPane()],
        [w_cmdPrefix + Constants.COMMANDS.SHOW_BODY, () => leoIntegration.showBody(false)], // TODO : Consider removing this from menus (redundant/unnecessary)
        [w_cmdPrefix + Constants.COMMANDS.OPEN_FILE, () => leoIntegration.openLeoFile()], // TODO : Support multiple simultaneous opened files
        [w_cmdPrefix + Constants.COMMANDS.SAVE_FILE, () => leoIntegration.saveLeoFile()], // TODO : Specify which file when supporting multiple simultaneous files

        [w_cmdPrefix + Constants.COMMANDS.SELECT_NODE, (p_node: LeoNode) => leoIntegration.selectTreeNode(p_node, false, false)], // Called by nodes in tree when selected
        [w_cmdPrefix + Constants.COMMANDS.OPEN_ASIDE, (p_node: LeoNode) => leoIntegration.selectTreeNode(p_node, false, true)],

        [w_cmdPrefix + Constants.COMMANDS.CONTRACT_ALL, () => leoIntegration.nodeCommand(Constants.LEOBRIDGE.CONTRACT_ALL, undefined, RefreshType.RefreshTree, false)],
        [w_cmdPrefix + Constants.COMMANDS.CONTRACT_ALL_FO, () => leoIntegration.nodeCommand(Constants.LEOBRIDGE.CONTRACT_ALL, undefined, RefreshType.RefreshTree, true)],

        [w_cmdPrefix + Constants.COMMANDS.MARK, (p_node: LeoNode) => leoIntegration.changeMark(true, p_node, false)],
        [w_cmdPrefix + Constants.COMMANDS.UNMARK, (p_node: LeoNode) => leoIntegration.changeMark(false, p_node, false)],
        [w_cmdPrefix + Constants.COMMANDS.MARK_SELECTION, () => leoIntegration.changeMark(true, undefined, false)],
        [w_cmdPrefix + Constants.COMMANDS.UNMARK_SELECTION, () => leoIntegration.changeMark(false, undefined, false)],
        [w_cmdPrefix + Constants.COMMANDS.MARK_SELECTION_FO, () => leoIntegration.changeMark(true, undefined, true)],
        [w_cmdPrefix + Constants.COMMANDS.UNMARK_SELECTION_FO, () => leoIntegration.changeMark(false, undefined, true)],

        [w_cmdPrefix + Constants.COMMANDS.COPY, (p_node: LeoNode) => leoIntegration.nodeCommand(Constants.LEOBRIDGE.COPY_PNODE, p_node, RefreshType.NoRefresh, false)], // No refresh/focus
        [w_cmdPrefix + Constants.COMMANDS.CUT, (p_node: LeoNode) => leoIntegration.nodeCommand(Constants.LEOBRIDGE.CUT_PNODE, p_node, RefreshType.RefreshTree, false)],
        [w_cmdPrefix + Constants.COMMANDS.PASTE, (p_node: LeoNode) => leoIntegration.nodeCommand(Constants.LEOBRIDGE.PASTE_PNODE, p_node, RefreshType.RefreshTree, false)],
        [w_cmdPrefix + Constants.COMMANDS.PASTE_CLONE, (p_node: LeoNode) => leoIntegration.nodeCommand(Constants.LEOBRIDGE.PASTE_CLONE_PNODE, p_node, RefreshType.RefreshTree, false)],
        [w_cmdPrefix + Constants.COMMANDS.DELETE, (p_node: LeoNode) => leoIntegration.nodeCommand(Constants.LEOBRIDGE.DELETE_PNODE, p_node, RefreshType.RefreshTree, false)],

        [w_cmdPrefix + Constants.COMMANDS.COPY_SELECTION, () => leoIntegration.nodeCommand(Constants.LEOBRIDGE.COPY_PNODE, undefined, RefreshType.NoRefresh, false)], // No refresh/focus
        [w_cmdPrefix + Constants.COMMANDS.CUT_SELECTION, () => leoIntegration.nodeCommand(Constants.LEOBRIDGE.CUT_PNODE, undefined, RefreshType.RefreshTree, false)],
        [w_cmdPrefix + Constants.COMMANDS.CUT_SELECTION_FO, () => leoIntegration.nodeCommand(Constants.LEOBRIDGE.CUT_PNODE, undefined, RefreshType.RefreshTree, true)],
        [w_cmdPrefix + Constants.COMMANDS.PASTE_SELECTION, () => leoIntegration.nodeCommand(Constants.LEOBRIDGE.PASTE_PNODE, undefined, RefreshType.RefreshTree, false)],
        [w_cmdPrefix + Constants.COMMANDS.PASTE_SELECTION_FO, () => leoIntegration.nodeCommand(Constants.LEOBRIDGE.PASTE_PNODE, undefined, RefreshType.RefreshTree, true)],
        [w_cmdPrefix + Constants.COMMANDS.PASTE_CLONE_SELECTION, () => leoIntegration.nodeCommand(Constants.LEOBRIDGE.PASTE_CLONE_PNODE, undefined, RefreshType.RefreshTree, false)],
        [w_cmdPrefix + Constants.COMMANDS.PASTE_CLONE_SELECTION_FO, () => leoIntegration.nodeCommand(Constants.LEOBRIDGE.PASTE_CLONE_PNODE, undefined, RefreshType.RefreshTree, true)],
        [w_cmdPrefix + Constants.COMMANDS.DELETE_SELECTION, () => leoIntegration.nodeCommand(Constants.LEOBRIDGE.DELETE_PNODE, undefined, RefreshType.RefreshTree, false)],
        [w_cmdPrefix + Constants.COMMANDS.DELETE_SELECTION_FO, () => leoIntegration.nodeCommand(Constants.LEOBRIDGE.DELETE_PNODE, undefined, RefreshType.RefreshTree, true)],

        [w_cmdPrefix + Constants.COMMANDS.HEADLINE, (p_node: LeoNode) => leoIntegration.editHeadline(p_node, false)],
        [w_cmdPrefix + Constants.COMMANDS.HEADLINE_SELECTION, () => leoIntegration.editHeadline(undefined, false)],
        [w_cmdPrefix + Constants.COMMANDS.HEADLINE_SELECTION_FO, () => leoIntegration.editHeadline(undefined, true)],

        [w_cmdPrefix + Constants.COMMANDS.MOVE_DOWN, (p_node: LeoNode) => leoIntegration.nodeCommand(Constants.LEOBRIDGE.MOVE_PNODE_DOWN, p_node, RefreshType.RefreshTree, false)],
        [w_cmdPrefix + Constants.COMMANDS.MOVE_LEFT, (p_node: LeoNode) => leoIntegration.nodeCommand(Constants.LEOBRIDGE.MOVE_PNODE_LEFT, p_node, RefreshType.RefreshTree, false)],
        [w_cmdPrefix + Constants.COMMANDS.MOVE_RIGHT, (p_node: LeoNode) => leoIntegration.nodeCommand(Constants.LEOBRIDGE.MOVE_PNODE_RIGHT, p_node, RefreshType.RefreshTree, false)],
        [w_cmdPrefix + Constants.COMMANDS.MOVE_UP, (p_node: LeoNode) => leoIntegration.nodeCommand(Constants.LEOBRIDGE.MOVE_PNODE_UP, p_node, RefreshType.RefreshTree, false)],
        [w_cmdPrefix + Constants.COMMANDS.INSERT, (p_node: LeoNode) => leoIntegration.insertNode(p_node, false)],
        [w_cmdPrefix + Constants.COMMANDS.CLONE, (p_node: LeoNode) => leoIntegration.nodeCommand(Constants.LEOBRIDGE.CLONE_PNODE, p_node, RefreshType.RefreshTree, false)],
        [w_cmdPrefix + Constants.COMMANDS.PROMOTE, (p_node: LeoNode) => leoIntegration.nodeCommand(Constants.LEOBRIDGE.PROMOTE_PNODE, p_node, RefreshType.RefreshTree, false)],
        [w_cmdPrefix + Constants.COMMANDS.DEMOTE, (p_node: LeoNode) => leoIntegration.nodeCommand(Constants.LEOBRIDGE.DEMOTE_PNODE, p_node, RefreshType.RefreshTree, false)],
        [w_cmdPrefix + Constants.COMMANDS.REFRESH_FROM_DISK, (p_node: LeoNode) => leoIntegration.nodeCommand(Constants.LEOBRIDGE.REFRESH_FROM_DISK_PNODE, p_node, RefreshType.RefreshTreeAndBody, false)],

        [w_cmdPrefix + Constants.COMMANDS.MOVE_DOWN_SELECTION, () => leoIntegration.nodeCommand(Constants.LEOBRIDGE.MOVE_PNODE_DOWN, undefined, RefreshType.RefreshTree, false)],
        [w_cmdPrefix + Constants.COMMANDS.MOVE_DOWN_SELECTION_FO, () => leoIntegration.nodeCommand(Constants.LEOBRIDGE.MOVE_PNODE_DOWN, undefined, RefreshType.RefreshTree, true)],
        [w_cmdPrefix + Constants.COMMANDS.MOVE_LEFT_SELECTION, () => leoIntegration.nodeCommand(Constants.LEOBRIDGE.MOVE_PNODE_LEFT, undefined, RefreshType.RefreshTree, false)],
        [w_cmdPrefix + Constants.COMMANDS.MOVE_LEFT_SELECTION_FO, () => leoIntegration.nodeCommand(Constants.LEOBRIDGE.MOVE_PNODE_LEFT, undefined, RefreshType.RefreshTree, true)],
        [w_cmdPrefix + Constants.COMMANDS.MOVE_RIGHT_SELECTION, () => leoIntegration.nodeCommand(Constants.LEOBRIDGE.MOVE_PNODE_RIGHT, undefined, RefreshType.RefreshTree, false)],
        [w_cmdPrefix + Constants.COMMANDS.MOVE_RIGHT_SELECTION_FO, () => leoIntegration.nodeCommand(Constants.LEOBRIDGE.MOVE_PNODE_RIGHT, undefined, RefreshType.RefreshTree, true)],
        [w_cmdPrefix + Constants.COMMANDS.MOVE_UP_SELECTION, () => leoIntegration.nodeCommand(Constants.LEOBRIDGE.MOVE_PNODE_UP, undefined, RefreshType.RefreshTree, false)],
        [w_cmdPrefix + Constants.COMMANDS.MOVE_UP_SELECTION_FO, () => leoIntegration.nodeCommand(Constants.LEOBRIDGE.MOVE_PNODE_UP, undefined, RefreshType.RefreshTree, true)],
        [w_cmdPrefix + Constants.COMMANDS.INSERT_SELECTION, () => leoIntegration.insertNode(undefined, false)],
        [w_cmdPrefix + Constants.COMMANDS.INSERT_SELECTION_FO, () => leoIntegration.insertNode(undefined, true)],
        [w_cmdPrefix + Constants.COMMANDS.CLONE_SELECTION, () => leoIntegration.nodeCommand(Constants.LEOBRIDGE.CLONE_PNODE, undefined, RefreshType.RefreshTree, false)],
        [w_cmdPrefix + Constants.COMMANDS.CLONE_SELECTION_FO, () => leoIntegration.nodeCommand(Constants.LEOBRIDGE.CLONE_PNODE, undefined, RefreshType.RefreshTree, true)],
        [w_cmdPrefix + Constants.COMMANDS.PROMOTE_SELECTION, () => leoIntegration.nodeCommand(Constants.LEOBRIDGE.PROMOTE_PNODE, undefined, RefreshType.RefreshTree, false)],
        [w_cmdPrefix + Constants.COMMANDS.PROMOTE_SELECTION_FO, () => leoIntegration.nodeCommand(Constants.LEOBRIDGE.PROMOTE_PNODE, undefined, RefreshType.RefreshTree, true)],
        [w_cmdPrefix + Constants.COMMANDS.DEMOTE_SELECTION, () => leoIntegration.nodeCommand(Constants.LEOBRIDGE.DEMOTE_PNODE, undefined, RefreshType.RefreshTree, false)],
        [w_cmdPrefix + Constants.COMMANDS.DEMOTE_SELECTION_FO, () => leoIntegration.nodeCommand(Constants.LEOBRIDGE.DEMOTE_PNODE, undefined, RefreshType.RefreshTree, true)],

        [w_cmdPrefix + Constants.COMMANDS.REFRESH_FROM_DISK_SELECTION, () => leoIntegration.nodeCommand(Constants.LEOBRIDGE.REFRESH_FROM_DISK_PNODE, undefined, RefreshType.RefreshTreeAndBody, false)],
        [w_cmdPrefix + Constants.COMMANDS.REFRESH_FROM_DISK_SELECTION_FO, () => leoIntegration.nodeCommand(Constants.LEOBRIDGE.REFRESH_FROM_DISK_PNODE, undefined, RefreshType.RefreshTreeAndBody, true)],

        [w_cmdPrefix + Constants.COMMANDS.SORT_CHILDREN, () => leoIntegration.nodeCommand(Constants.LEOBRIDGE.SORT_CHILDREN, undefined, RefreshType.RefreshTree, false)],
        [w_cmdPrefix + Constants.COMMANDS.SORT_SIBLING, () => leoIntegration.nodeCommand(Constants.LEOBRIDGE.SORT_SIBLINGS, undefined, RefreshType.RefreshTree, false)],

        [w_cmdPrefix + Constants.COMMANDS.UNDO, () => leoIntegration.nodeCommand(Constants.LEOBRIDGE.UNDO, undefined, RefreshType.RefreshTreeAndBody, false)],
        [w_cmdPrefix + Constants.COMMANDS.UNDO_FO, () => leoIntegration.nodeCommand(Constants.LEOBRIDGE.UNDO, undefined, RefreshType.RefreshTreeAndBody, true)],
        [w_cmdPrefix + Constants.COMMANDS.REDO, () => leoIntegration.nodeCommand(Constants.LEOBRIDGE.REDO, undefined, RefreshType.RefreshTreeAndBody, false)],
        [w_cmdPrefix + Constants.COMMANDS.REDO_FO, () => leoIntegration.nodeCommand(Constants.LEOBRIDGE.REDO, undefined, RefreshType.RefreshTreeAndBody, true)],
        [w_cmdPrefix + Constants.COMMANDS.EXECUTE, () => leoIntegration.nodeCommand(Constants.LEOBRIDGE.EXECUTE_SCRIPT, undefined, RefreshType.RefreshTreeAndBody, false)],

        // TODO : More commands to implement
        [w_cmdPrefix + Constants.COMMANDS.CLOSE_FILE, () => leoIntegration.closeLeoFile()], // TODO : Implement & support multiple simultaneous files
        [w_cmdPrefix + Constants.COMMANDS.HOIST, () => vscode.window.showInformationMessage("TODO: hoistNode command")],
        [w_cmdPrefix + Constants.COMMANDS.HOIST_SELECTION, () => vscode.window.showInformationMessage("TODO: hoistSelection command")],
        [w_cmdPrefix + Constants.COMMANDS.DEHOIST, () => vscode.window.showInformationMessage("TODO: deHoist command")],
        [w_cmdPrefix + Constants.COMMANDS.CLONE_FIND_ALL, () => vscode.window.showInformationMessage("TODO: cloneFindAll command")],
        [w_cmdPrefix + Constants.COMMANDS.CLONE_FIND_ALL_FLATTENED, () => vscode.window.showInformationMessage("TODO: cloneFindAllFlattened command")],
        [w_cmdPrefix + Constants.COMMANDS.CLONE_FIND_MARKED, () => vscode.window.showInformationMessage("TODO: cloneFindMarked command")],
        [w_cmdPrefix + Constants.COMMANDS.CLONE_FIND_FLATTENED_MARKED, () => vscode.window.showInformationMessage("TODO: cloneFindFlattenedMarked command")],
        [w_cmdPrefix + Constants.COMMANDS.EXTRACT, () => vscode.window.showInformationMessage("TODO: extract command")],
        [w_cmdPrefix + Constants.COMMANDS.EXTRACT_NAMES, () => vscode.window.showInformationMessage("TODO: extractNames command")],
        [w_cmdPrefix + Constants.COMMANDS.COPY_MARKED, () => vscode.window.showInformationMessage("TODO: copyMarked command")],
        [w_cmdPrefix + Constants.COMMANDS.DIFF_MARKED_NODES, () => vscode.window.showInformationMessage("TODO: diffMarkedNodes command")],
        [w_cmdPrefix + Constants.COMMANDS.GOTO_NEXT_MARKED, () => vscode.window.showInformationMessage("TODO: gotoNextMarked command")],
        [w_cmdPrefix + Constants.COMMANDS.MARK_CHANGED_ITEMS, () => vscode.window.showInformationMessage("TODO: markChangedItems command")],
        [w_cmdPrefix + Constants.COMMANDS.MARK_SUBHEADS, () => vscode.window.showInformationMessage("TODO: markSubheads command")],
        [w_cmdPrefix + Constants.COMMANDS.UNMARK_ALL, () => vscode.window.showInformationMessage("TODO: unmarkAll command")],
        [w_cmdPrefix + Constants.COMMANDS.CLONE_MARKED_NODES, () => vscode.window.showInformationMessage("TODO: cloneMarkedNodes command")],
        [w_cmdPrefix + Constants.COMMANDS.DELETE_MARKED_NODES, () => vscode.window.showInformationMessage("TODO: deleteMarkedNodes command")],
        [w_cmdPrefix + Constants.COMMANDS.MOVE_MARKED_NODES, () => vscode.window.showInformationMessage("TODO: moveMarkedNode command")]
    ];

    w_commands.map(function (p_command) { context.subscriptions.push(vscode.commands.registerCommand(...p_command)); });

    // * Show Welcome / settings screen if the version is newer than last time, then start automatic server and connection
    showWelcome(leoIntegVersion, previousVersion).then(() => {
        // * Start server and / or connect to it (as specified in settings)
        leoIntegration.startNetworkServices();
        context.globalState.update(Constants.VERSION_STATE_KEY, leoIntegVersion);
        console.log('leoInteg startup launched in ', getDurationMilliseconds(start), 'ms');
    });
}

export function deactivate() {
    // * Called when extension is deactivated
    console.log('deactivate called for extension "leointeg"');
}

async function showWelcome(version: string, previousVersion: string | undefined): Promise<unknown> {
    // * Show welcome screen if needed, based on last version executed
    let w_showWelcomeScreen: boolean = false;
    if (previousVersion === undefined) {
        console.log('leoInteg first-time install');
        w_showWelcomeScreen = true;
    } else {
        if (previousVersion !== version) {
            console.log(`leoInteg upgraded from v${previousVersion} to v${version}`);
        }
        const [major, minor] = version.split('.').map(v => parseInt(v, 10));
        const [prevMajor, prevMinor] = previousVersion.split('.').map(v => parseInt(v, 10));
        if (
            (major === prevMajor && minor === prevMinor) ||
            // Don't notify on downgrades
            (major < prevMajor || (major === prevMajor && minor < prevMinor))
        ) {
            w_showWelcomeScreen = false;
        } else if (major !== prevMajor || (major === prevMajor && minor > prevMinor)) {
            // Will show on major or minor upgrade, Formatted as 'Major.Minor.Revision' eg. 1.2.3
            w_showWelcomeScreen = true;
        }
    }
    if (w_showWelcomeScreen) {
        return vscode.commands.executeCommand(Constants.NAME + "." + Constants.COMMANDS.SHOW_WELCOME);
    } else {
        return Promise.resolve();
    }
}

function getDurationMilliseconds(start: [number, number]): number {
    // * Returns the milliseconds between a given starting process.hrtime tuple and the current call to process.hrtime
    const [secs, nanosecs] = process.hrtime(start);
    return secs * 1000 + Math.floor(nanosecs / 1000000);
}
