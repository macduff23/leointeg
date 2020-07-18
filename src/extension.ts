import * as vscode from "vscode";
import * as utils from "./utils";
import { Constants } from "./constants";
import { RefreshType } from "./types";
import { LeoIntegration } from "./leoIntegration";
import { LeoNode } from "./leoNode";
import { LeoSettingsWebview } from "./webviews/leoSettingsWebview";
import { LeoButtonNode } from "./leoButtonNode";

/**
 * * Called when extension is activated.
 * * It creates the leoIntegration and the 'welcome/Settings' webview instances.
 */
export function activate(p_context: vscode.ExtensionContext) {

    const w_leoIntegExtension = vscode.extensions.getExtension(Constants.PUBLISHER + '.' + Constants.NAME)!;
    const w_leoIntegVersion = w_leoIntegExtension.packageJSON.version;
    const w_leoIntegration: LeoIntegration = new LeoIntegration(p_context);
    const w_leoSettingsWebview: LeoSettingsWebview = new LeoSettingsWebview(p_context, w_leoIntegration);
    const w_previousVersion = p_context.globalState.get<string>(Constants.VERSION_STATE_KEY);
    const w_start = process.hrtime(); // For calculating total startup time duration

    // EKR: More abbreviations to shorten the lines.
    const bridge = Constants.LEOBRIDGE;
    const cmd = Constants.COMMANDS;
    const leo = w_leoIntegration;
    const prefix = Constants.NAME + ".";
    const noRefresh = RefreshType.NoRefresh;
    const refreshBoth = RefreshType.RefreshTreeAndBody;
    const refreshTree = RefreshType.RefreshTree;
    const showInfo = vscode.window.showInformationMessage;
    const u = undefined;

    // * Reset Extension context flags (used in 'when' clauses in package.json)
    utils.setContext(Constants.CONTEXT_FLAGS.BRIDGE_READY, false); // Connected to a leobridge server?
    utils.setContext(Constants.CONTEXT_FLAGS.TREE_OPENED, false); // Having a Leo file opened on that server?

    const w_commands: [string, (...args: any[]) => any][] = [
    
        // ! REMOVE TESTS ENTRIES FROM PACKAGE.JSON FOR MASTER BRANCH RELEASES !
        [prefix + "test", () => leo.test()], // Test function useful when debugging
        [prefix + "testFromOutline", () => leo.test(true)], // Test function useful when debugging.

        // Define entries for all commands
        [prefix + cmd.EXECUTE, () => leo.executeScript()],
        // Test for undeclared commands VERDICT IT WORKS!
        [prefix + cmd.CLICK_BUTTON, (p_node: LeoButtonNode) => leo.clickButton(p_node)],

        // Cannot be undeclared because its referenced in package.json
        [prefix + cmd.REMOVE_BUTTON, (p_node: LeoButtonNode) => leo.removeButton(p_node)],
        [prefix + cmd.CLOSE_FILE, () => leo.closeLeoFile()],
        [prefix + cmd.NEW_FILE, () => leo.newLeoFile()],
        [prefix + cmd.OPEN_FILE, () => leo.openLeoFile()],
        [prefix + cmd.SAVE_AS_FILE, () => leo.saveAsLeoFile()],
        [prefix + cmd.SAVE_FILE, () => leo.saveLeoFile()],
        [prefix + cmd.SAVE_FILE_FO, () => leo.saveLeoFile(true)],
        [prefix + cmd.SWITCH_FILE, () => leo.switchLeoFile()],

        // Test for undeclared commands VERDICT IT WORKS!
        [prefix + cmd.SET_OPENED_FILE, (p_index: number) => leo.selectOpenedLeoDocument(p_index)],

        [prefix + cmd.REFRESH_FROM_DISK, (p_node: LeoNode) => leo.nodeCommand(bridge.REFRESH_FROM_DISK_PNODE, p_node, refreshBoth, false)],
        [prefix + cmd.REFRESH_FROM_DISK_SELECTION, () => leo.nodeCommand(bridge.REFRESH_FROM_DISK_PNODE, u, refreshBoth, false)],
        [prefix + cmd.REFRESH_FROM_DISK_SELECTION_FO, () => leo.nodeCommand(bridge.REFRESH_FROM_DISK_PNODE, u, refreshBoth, true)],
        [prefix + cmd.HEADLINE, (p_node: LeoNode) => leo.editHeadline(p_node, false)],
        [prefix + cmd.HEADLINE_SELECTION, () => leo.editHeadline(u, false)],
        [prefix + cmd.HEADLINE_SELECTION_FO, () => leo.editHeadline(u, true)],

        // TODO : @boltex More commands to implement #15, #23, #24
        // [prefix + cmd.CLONE_FIND_ALL, () => showInfo("TODO: cloneFindAll command")],
        // [prefix + cmd.CLONE_FIND_ALL_FLATTENED, () => showInfo("TODO: cloneFindAllFlattened command")],
        // [prefix + cmd.CLONE_FIND_MARKED, () => showInfo("TODO: cloneFindMarked command")],
        // [prefix + cmd.CLONE_FIND_FLATTENED_MARKED, () => showInfo("TODO: cloneFindFlattenedMarked command")],
        // [prefix + cmd.EXTRACT, () => showInfo("TODO: extract command")],
        // [prefix + cmd.EXTRACT_NAMES, () => showInfo("TODO: extractNames command")],

        // [prefix + cmd.COPY_MARKED, () => showInfo("TODO: copyMarked command")],
        // [prefix + cmd.DIFF_MARKED_NODES, () => showInfo("TODO: diffMarkedNodes command")],
        // [prefix + cmd.MARK_CHANGED_ITEMS, () => showInfo("TODO: markChangedItems command")],
        // [prefix + cmd.MARK_SUBHEADS, () => showInfo("TODO: markSubheads command")],
        // [prefix + cmd.UNMARK_ALL, () => showInfo("TODO: unmarkAll command")],
        // [prefix + cmd.CLONE_MARKED_NODES, () => showInfo("TODO: cloneMarkedNodes command")],
        // [prefix + cmd.DELETE_MARKED_NODES, () => showInfo("TODO: deleteMarkedNodes command")],
        // [prefix + cmd.MOVE_MARKED_NODES, () => showInfo("TODO: moveMarkedNode command")],

        [prefix + cmd.CLONE_FIND_ALL, () => leo.nodeCommand(bridge.CLONE_FIND_ALL, u, refreshBoth, true)],
        [prefix + cmd.CLONE_FIND_ALL_FLATTENED, () => leo.nodeCommand(bridge.CLONE_FIND_ALL_FLATTENED, u, refreshBoth, true)],
        [prefix + cmd.CLONE_FIND_FLATTENED_MARKED, () => leo.nodeCommand(bridge.CLONE_FIND_FLATTENED_MARKED, u, refreshBoth, true)],
        [prefix + cmd.CLONE_FIND_MARKED, () => leo.nodeCommand(bridge.CLONE_FIND_MARKED, u, refreshBoth, true)],
        [prefix + cmd.CLONE_MARKED_NODES, () => leo.nodeCommand(bridge.CLONE_MARKED_NODES, u, refreshBoth, true)],

        [prefix + cmd.COPY_MARKED, () => leo.nodeCommand(bridge.COPY_MARKED, u, refreshBoth, true)],
        [prefix + cmd.MOVE_MARKED_NODES, () => leo.nodeCommand(bridge.MOVE_MARKED_NODES, u, refreshBoth, true)],
        [prefix + cmd.DELETE_MARKED_NODES, () => leo.nodeCommand(bridge.DELETE_MARKED_NODES, u, refreshBoth, true)],
        [prefix + cmd.DIFF_MARKED_NODES, () => leo.nodeCommand(bridge.DIFF_MARKED_NODES, u, refreshBoth, true)],

        [prefix + cmd.EXTRACT, () => leo.nodeCommand(bridge.EXTRACT, u, refreshBoth, true)],
        [prefix + cmd.EXTRACT_NAMES, () => leo.nodeCommand(bridge.EXTRACT_NAMES, u, refreshBoth, true)],

        [prefix + cmd.MARK_CHANGED_ITEMS, () => leo.nodeCommand(bridge.MARK_CHANGED_ITEMS, u, refreshBoth, true)],
        [prefix + cmd.MARK_SUBHEADS, () => leo.nodeCommand(bridge.MARK_SUBHEADS, u, refreshBoth, true)],
        [prefix + cmd.UNMARK_ALL, () => leo.nodeCommand(bridge.UNMARK_ALL, u, refreshBoth, true)],
        // cut/copy/paste/delete given node.
        [prefix + cmd.COPY, (p_node: LeoNode) => leo.nodeCommand(bridge.COPY_PNODE, p_node, noRefresh, false)],
        [prefix + cmd.CUT, (p_node: LeoNode) => leo.nodeCommand(bridge.CUT_PNODE, p_node, refreshTree, false)],
        [prefix + cmd.DELETE, (p_node: LeoNode) => leo.nodeCommand(bridge.DELETE_PNODE, p_node, refreshTree, false)],
        [prefix + cmd.PASTE, (p_node: LeoNode) => leo.nodeCommand(bridge.PASTE_PNODE, p_node, refreshTree, false)],
        [prefix + cmd.PASTE_CLONE, (p_node: LeoNode) => leo.nodeCommand(bridge.PASTE_CLONE_PNODE, p_node, refreshTree, false)],

        // cut/copy/paste/delete c.p..
        [prefix + cmd.COPY_SELECTION, () => leo.nodeCommand(bridge.COPY_PNODE, u, noRefresh, false)],
        [prefix + cmd.CUT_SELECTION, () => leo.nodeCommand(bridge.CUT_PNODE, u, refreshTree, false)],
        [prefix + cmd.CUT_SELECTION_FO, () => leo.nodeCommand(bridge.CUT_PNODE, u, refreshTree, true)],
        [prefix + cmd.DELETE_SELECTION, () => leo.nodeCommand(bridge.DELETE_PNODE, u, refreshTree, false)],
        [prefix + cmd.DELETE_SELECTION_FO, () => leo.nodeCommand(bridge.DELETE_PNODE, u, refreshTree, true)],
        [prefix + cmd.PASTE_CLONE_SELECTION, () => leo.nodeCommand(bridge.PASTE_CLONE_PNODE, u, refreshTree, false)],
        [prefix + cmd.PASTE_CLONE_SELECTION_FO, () => leo.nodeCommand(bridge.PASTE_CLONE_PNODE, u, refreshTree, true)],
        [prefix + cmd.PASTE_SELECTION, () => leo.nodeCommand(bridge.PASTE_PNODE, u, refreshTree, false)],
        [prefix + cmd.PASTE_SELECTION_FO, () => leo.nodeCommand(bridge.PASTE_PNODE, u, refreshTree, true)],
        [prefix + cmd.CONTRACT_ALL, () => leo.nodeCommand(bridge.CONTRACT_ALL, u, refreshTree, false)],
        [prefix + cmd.CONTRACT_ALL_FO, () => leo.nodeCommand(bridge.CONTRACT_ALL, u, refreshTree, true)],
        [prefix + cmd.CONTRACT_OR_GO_LEFT, () => leo.nodeCommand(bridge.CONTRACT_OR_GO_LEFT, u, refreshBoth, true)],

        [prefix + cmd.EXPAND_AND_GO_RIGHT, () => leo.nodeCommand(bridge.EXPAND_AND_GO_RIGHT, u, refreshBoth, true)],
        [prefix + cmd.GIT_DIFF, () => leo.nodeCommand(bridge.GIT_DIFF, u, refreshBoth, true)],
        [prefix + cmd.GOTO_NEXT_CLONE, (p_node: LeoNode) => leo.nodeCommand(bridge.GOTO_NEXT_CLONE, p_node, refreshBoth, true)],
        [prefix + cmd.GOTO_NEXT_CLONE_SELECTION, () => leo.nodeCommand(bridge.GOTO_NEXT_CLONE, u, refreshBoth, false)],
        [prefix + cmd.GOTO_NEXT_CLONE_SELECTION_FO, () => leo.nodeCommand(bridge.GOTO_NEXT_CLONE, u, refreshBoth, true)],

        [prefix + cmd.GOTO_NEXT_MARKED, () => leo.nodeCommand(bridge.GOTO_NEXT_MARKED, u, refreshBoth, true)],

        [prefix + cmd.GOTO_FIRST_VISIBLE, () => leo.nodeCommand(bridge.GOTO_FIRST_VISIBLE, u, refreshBoth, true)],
        [prefix + cmd.GOTO_LAST_SIBLING, () => leo.nodeCommand(bridge.GOTO_LAST_SIBLING, u, refreshBoth, true)],
        [prefix + cmd.GOTO_LAST_VISIBLE, () => leo.nodeCommand(bridge.GOTO_LAST_VISIBLE, u, refreshBoth, true)],
        [prefix + cmd.GOTO_NEXT_VISIBLE, () => leo.nodeCommand(bridge.GOTO_NEXT_VISIBLE, u, refreshBoth, true)],
        [prefix + cmd.GOTO_PREV_VISIBLE, () => leo.nodeCommand(bridge.GOTO_PREV_VISIBLE, u, refreshBoth, true)],

        [prefix + cmd.DEHOIST, () => leo.nodeCommand(bridge.DEHOIST, u, refreshBoth, false)],
        [prefix + cmd.DEHOIST_FO, () => leo.nodeCommand(bridge.DEHOIST, u, refreshBoth, true)],

        [prefix + cmd.HOIST, (p_node: LeoNode) => leo.nodeCommand(bridge.HOIST_PNODE, p_node, refreshBoth, true)],
        [prefix + cmd.HOIST_SELECTION, () => leo.nodeCommand(bridge.HOIST_PNODE, u, refreshBoth, false)],
        [prefix + cmd.HOIST_SELECTION_FO, () => leo.nodeCommand(bridge.HOIST_PNODE, u, refreshBoth, true)],
        [prefix + cmd.CLONE, (p_node: LeoNode) => leo.nodeCommand(bridge.CLONE_PNODE, p_node, refreshTree, false)],
        [prefix + cmd.CLONE_SELECTION, () => leo.nodeCommand(bridge.CLONE_PNODE, u, refreshTree, false)],
        [prefix + cmd.CLONE_SELECTION_FO, () => leo.nodeCommand(bridge.CLONE_PNODE, u, refreshTree, true)],

        [prefix + cmd.INSERT, (p_node: LeoNode) => leo.insertNode(p_node, false)],
        [prefix + cmd.INSERT_SELECTION, () => leo.insertNode(u, false)],
        [prefix + cmd.INSERT_SELECTION_FO, () => leo.insertNode(u, true)],

        // * Special command for when inserting rapidly more than one node without even specifying a headline label,
        // such as spamming CTRL+I rapidly.
        [prefix + cmd.INSERT_SELECTION_INTERRUPT, () => leo.insertNode(u, u, true)],
        [prefix + cmd.MARK, (p_node: LeoNode) => leo.changeMark(true, p_node, false)],
        [prefix + cmd.MARK_SELECTION, () => leo.changeMark(true, u, false)],
        [prefix + cmd.MARK_SELECTION_FO, () => leo.changeMark(true, u, true)],

        [prefix + cmd.UNMARK, (p_node: LeoNode) => leo.changeMark(false, p_node, false)],
        [prefix + cmd.UNMARK_SELECTION, () => leo.changeMark(false, u, false)],
        [prefix + cmd.UNMARK_SELECTION_FO, () => leo.changeMark(false, u, true)],
        [prefix + cmd.MOVE_DOWN, (p_node: LeoNode) => leo.nodeCommand(bridge.MOVE_PNODE_DOWN, p_node, refreshTree, false)],
        [prefix + cmd.MOVE_DOWN_SELECTION, () => leo.nodeCommand(bridge.MOVE_PNODE_DOWN, u, refreshTree, false)],
        [prefix + cmd.MOVE_DOWN_SELECTION_FO, () => leo.nodeCommand(bridge.MOVE_PNODE_DOWN, u, refreshTree, true)],

        [prefix + cmd.MOVE_LEFT, (p_node: LeoNode) => leo.nodeCommand(bridge.MOVE_PNODE_LEFT, p_node, refreshTree, false)],
        [prefix + cmd.MOVE_LEFT_SELECTION, () => leo.nodeCommand(bridge.MOVE_PNODE_LEFT, u, refreshTree, false)],
        [prefix + cmd.MOVE_LEFT_SELECTION_FO, () => leo.nodeCommand(bridge.MOVE_PNODE_LEFT, u, refreshTree, true)],

        [prefix + cmd.MOVE_RIGHT, (p_node: LeoNode) => leo.nodeCommand(bridge.MOVE_PNODE_RIGHT, p_node, refreshTree, false)],
        [prefix + cmd.MOVE_RIGHT_SELECTION, () => leo.nodeCommand(bridge.MOVE_PNODE_RIGHT, u, refreshTree, false)],
        [prefix + cmd.MOVE_RIGHT_SELECTION_FO, () => leo.nodeCommand(bridge.MOVE_PNODE_RIGHT, u, refreshTree, true)],

        [prefix + cmd.MOVE_UP, (p_node: LeoNode) => leo.nodeCommand(bridge.MOVE_PNODE_UP, p_node, refreshTree, false)],
        [prefix + cmd.MOVE_UP_SELECTION, () => leo.nodeCommand(bridge.MOVE_PNODE_UP, u, refreshTree, false)],
        [prefix + cmd.MOVE_UP_SELECTION_FO, () => leo.nodeCommand(bridge.MOVE_PNODE_UP, u, refreshTree, true)],
        [prefix + cmd.PAGE_UP, () => leo.nodeCommand(bridge.PAGE_UP, u, refreshBoth, true)],
        [prefix + cmd.PAGE_DOWN, () => leo.nodeCommand(bridge.PAGE_DOWN, u, refreshBoth, true)],
        [prefix + cmd.DEMOTE, (p_node: LeoNode) => leo.nodeCommand(bridge.DEMOTE_PNODE, p_node, refreshTree, false)],
        [prefix + cmd.DEMOTE_SELECTION, () => leo.nodeCommand(bridge.DEMOTE_PNODE, u, refreshTree, false)],
        [prefix + cmd.DEMOTE_SELECTION_FO, () => leo.nodeCommand(bridge.DEMOTE_PNODE, u, refreshTree, true)],

        [prefix + cmd.PROMOTE, (p_node: LeoNode) => leo.nodeCommand(bridge.PROMOTE_PNODE, p_node, refreshTree, false)],
        [prefix + cmd.PROMOTE_SELECTION, () => leo.nodeCommand(bridge.PROMOTE_PNODE, u, refreshTree, false)],
        [prefix + cmd.PROMOTE_SELECTION_FO, () => leo.nodeCommand(bridge.PROMOTE_PNODE, u, refreshTree, true)],
        [prefix + cmd.SORT_CHILDREN, () => leo.nodeCommand(bridge.SORT_CHILDREN, u, refreshTree, false)],
        [prefix + cmd.SORT_SIBLING, () => leo.nodeCommand(bridge.SORT_SIBLINGS, u, refreshTree, false)],
        [prefix + cmd.SORT_SIBLING_FO, () => leo.nodeCommand(bridge.SORT_SIBLINGS, u, refreshTree, true)],
        [prefix + cmd.REDO, () => leo.nodeCommand(bridge.REDO, u, refreshBoth, false)],
        [prefix + cmd.REDO_FO, () => leo.nodeCommand(bridge.REDO, u, refreshBoth, true)],

        [prefix + cmd.UNDO, () => leo.nodeCommand(bridge.UNDO, u, refreshBoth, false)],
        [prefix + cmd.UNDO_FO, () => leo.nodeCommand(bridge.UNDO, u, refreshBoth, true)],
        [prefix + cmd.CONNECT, () => leo.connect()],
        [prefix + cmd.START_SERVER, () => leo.startServer()],
        [prefix + cmd.SELECT_NODE, (p_node: LeoNode) => leo.selectTreeNode(p_node, false, false)],
            // Called by nodes in tree when selected
        [prefix + cmd.OPEN_ASIDE, (p_node: LeoNode) => leo.selectTreeNode(p_node, false, true)],

        [prefix + cmd.SHOW_OUTLINE, () => leo.showOutline(true)],
            // Also focuses on outline

        [prefix + cmd.SHOW_LOG, () => leo.showLogPane()],
        [prefix + cmd.SHOW_BODY, () => leo.showBody(false)],
            // Also focuses on body

        [prefix + cmd.SHOW_WELCOME, () => w_leoSettingsWebview.openWebview()],
        [prefix + cmd.SHOW_SETTINGS, () => w_leoSettingsWebview.openWebview()],
            // Same as 'show welcome screen'
            
    ];

    w_commands.map(function (p_command) {
        p_context.subscriptions.push(vscode.commands.registerCommand(...p_command));
    });
    // If the version is newer than last time, then start automatic server and connection
    showWelcomeIfNewer(w_leoIntegVersion, w_previousVersion).then(() => {
        // * Start server and / or connect to it (as specified in settings)
        leo.startNetworkServices();
        p_context.globalState.update(Constants.VERSION_STATE_KEY, w_leoIntegVersion);
        console.log('leoInteg startup launched in ', getDurationMilliseconds(w_start), 'ms');
    });
}

/**
 * * Called when extension is deactivated
 */
export function deactivate() {
    console.log('deactivate called for extension "leointeg"');
}

/**
 * * Show welcome screen if needed, based on last version executed
 * @param p_version Current version, as a string, from packageJSON.version
 * @param p_previousVersion Previous version, as a string, from context.globalState.get service
 * @returns a promise that triggers when command to show the welcome screen is finished, or immediately if not needed
 */
async function showWelcomeIfNewer(p_version: string, p_previousVersion: string | undefined): Promise<unknown> {
    let w_showWelcomeScreen: boolean = false;
    if (p_previousVersion === undefined) {
        console.log('leoInteg first-time install');
        w_showWelcomeScreen = true;
    } else {
        if (p_previousVersion !== p_version) {
            console.log(`leoInteg upgraded from v${p_previousVersion} to v${p_version}`);
        }
        const [w_major, w_minor] = p_version.split('.').map(p_stringVal => parseInt(p_stringVal, 10));
        const [w_prevMajor, w_prevMinor] = p_previousVersion.split('.').map(p_stringVal => parseInt(p_stringVal, 10));
        if (
            (w_major === w_prevMajor && w_minor === w_prevMinor) ||
            // Don't notify on downgrades
            (w_major < w_prevMajor || (w_major === w_prevMajor && w_minor < w_prevMinor))
        ) {
            w_showWelcomeScreen = false;
        } else if (w_major !== w_prevMajor || (w_major === w_prevMajor && w_minor > w_prevMinor)) {
            // Will show on major or minor upgrade (Formatted as 'Major.Minor.Revision' eg. 1.2.3)
            w_showWelcomeScreen = true;
        }
    }
    if (w_showWelcomeScreen) {
        return vscode.commands.executeCommand(Constants.NAME + "." + Constants.COMMANDS.SHOW_WELCOME);
    } else {
        return Promise.resolve();
    }
}

/**
 * * Returns the milliseconds between a given starting process.hrtime tuple and the current call to process.hrtime
 * @param p_start starting process.hrtime to subtract from current immediate time
 * @returns number of milliseconds passed since the given start hrtime
 */
function getDurationMilliseconds(p_start: [number, number]): number {
    const [secs, nanosecs] = process.hrtime(p_start);
    return secs * 1000 + Math.floor(nanosecs / 1000000);
}
