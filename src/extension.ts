import * as vscode from "vscode";
import * as utils from "./utils";
import { Constants } from "./constants";
import { ReqRefresh } from "./types";
import { LeoIntegration } from "./leoIntegration";
import { LeoNode } from "./leoNode";
import { LeoSettingsProvider } from "./webviews/leoSettingsWebview";
import { LeoButtonNode } from "./leoButtonNode";

var LeoInteg: LeoIntegration | undefined = undefined;

/**
 * * Called by vscode when extension is activated
 * It creates the leoIntegration instance
 * Will also open the 'welcome/Settings' webview instance if a new version is opened
 */
export function activate(p_context: vscode.ExtensionContext) {

    const w_start = process.hrtime(); // For calculating total startup time duration

    // * Reset Extension context flags (used in 'when' clauses in package.json)
    utils.setContext(Constants.CONTEXT_FLAGS.BRIDGE_READY, false); // Connected to a leobridge server?
    utils.setContext(Constants.CONTEXT_FLAGS.TREE_OPENED, false); // Having a Leo file opened on that server?

    const w_leoIntegExtension = vscode.extensions.getExtension(Constants.PUBLISHER + '.' + Constants.NAME)!;
    const w_leoIntegVersion = w_leoIntegExtension.packageJSON.version;
    const w_leo: LeoIntegration = new LeoIntegration(p_context);
    if (w_leo) {
        LeoInteg = w_leo;
    }
    const w_leoSettingsWebview: LeoSettingsProvider = w_leo.leoSettingsWebview;
    const w_previousVersion = p_context.globalState.get<string>(Constants.VERSION_STATE_KEY);

    // Shortcut pointers for readability
    const U = undefined;
    const BRIDGE = Constants.LEOBRIDGE;
    const CMD = Constants.COMMANDS;
    // * Refresh helper variables: 'states' refresh will also refresh documents pane.
    const NO_REFRESH: ReqRefresh = {};
    const REFRESH_NODE_BODY: ReqRefresh = {
        node: true, // Reveal the returned 'selected position' without changes to the tree
        body: true, // Goto/select another node needs the body pane refreshed
        states: true // * Also refreshes documents pane if node's 'changed' state differ.
    };
    const REFRESH_TREE: ReqRefresh = {
        tree: true,
        states: true // * Also refreshes documents pane if node's 'changed' state differ.
    };
    const REFRESH_TREE_BODY: ReqRefresh = {
        tree: true,
        body: true,
        states: true // * Also refreshes documents pane if node's 'changed' state differ.
    };

    const w_commands: [string, (...args: any[]) => any][] = [

        // ! REMOVE TESTS ENTRIES FROM PACKAGE.JSON FOR MASTER BRANCH RELEASES !
        ["leointeg.test", () => w_leo.test()], // Test function useful when debugging
        // ["leointeg.testFromOutline", () => w_leo.test(true)], // Test function useful when debugging.

        // * Define entries for all commands
        [CMD.MINIBUFFER, () => w_leo.minibuffer()], // Is referenced in package.json
        [CMD.STATUS_BAR, () => w_leo.statusBarOnClick()],
        [CMD.EXECUTE, () => w_leo.nodeCommand({
            action: BRIDGE.EXECUTE_SCRIPT,
            node: U,
            refreshType: REFRESH_TREE_BODY,
            fromOutline: false
        })],

        [CMD.CLICK_BUTTON, (p_node: LeoButtonNode) => w_leo.clickAtButton(p_node)], // Not referenced in package.json
        [CMD.GOTO_SCRIPT, (p_node: LeoButtonNode) => w_leo.gotoScript(p_node)],
        [CMD.REMOVE_BUTTON, (p_node: LeoButtonNode) => w_leo.removeAtButton(p_node)],

        [CMD.CLOSE_FILE, () => w_leo.closeLeoFile()],
        [CMD.NEW_FILE, () => w_leo.newLeoFile()],

        [CMD.OPEN_FILE, (p_uri?: vscode.Uri) => w_leo.openLeoFile(p_uri)],
        [CMD.IMPORT_ANY_FILE, () => w_leo.importAnyFile()], // No URL passed from the command definition.

        [CMD.CLEAR_RECENT_FILES, () => w_leo.clearRecentLeoFiles()],
        [CMD.RECENT_FILES, () => w_leo.showRecentLeoFiles()],
        [CMD.SAVE_AS_FILE, () => w_leo.saveAsLeoFile()],
        [CMD.SAVE_AS_LEOJS, () => w_leo.saveAsLeoJsFile()],
        [CMD.SAVE_FILE, () => w_leo.saveLeoFile()],
        // [CMD.SAVE_DISABLED, () => { }],
        [CMD.SAVE_FILE_FO, () => w_leo.saveLeoFile(true)],
        [CMD.SWITCH_FILE, () => w_leo.switchLeoFile()],

        [CMD.SET_OPENED_FILE, (p_index: number) => w_leo.selectOpenedLeoDocument(p_index)],

        [CMD.REFRESH_FROM_DISK, (p_node: LeoNode) => w_leo.nodeCommand({
            action: BRIDGE.REFRESH_FROM_DISK_PNODE,
            node: p_node,
            refreshType: REFRESH_TREE_BODY,
            fromOutline: true,
            keepSelection: false
        })],
        [CMD.REFRESH_FROM_DISK_SELECTION, () => w_leo.nodeCommand({
            action: BRIDGE.REFRESH_FROM_DISK_PNODE,
            node: U,
            refreshType: REFRESH_TREE_BODY,
            fromOutline: false
        })],
        [CMD.REFRESH_FROM_DISK_SELECTION_FO, () => w_leo.nodeCommand({
            action: BRIDGE.REFRESH_FROM_DISK_PNODE,
            node: U,
            refreshType: REFRESH_TREE_BODY,
            fromOutline: true
        })],

        [CMD.WRITE_AT_FILE_NODES, () => w_leo.nodeCommand({
            action: BRIDGE.WRITE_AT_FILE_NODES,
            node: U,
            refreshType: REFRESH_TREE,
            fromOutline: false
        })],
        [CMD.WRITE_AT_FILE_NODES_FO, () => w_leo.nodeCommand({
            action: BRIDGE.WRITE_AT_FILE_NODES,
            node: U,
            refreshType: REFRESH_TREE,
            fromOutline: true
        })],
        [CMD.WRITE_DIRTY_AT_FILE_NODES, () => w_leo.nodeCommand({
            action: BRIDGE.WRITE_DIRTY_AT_FILE_NODES,
            node: U,
            refreshType: REFRESH_TREE,
            fromOutline: false
        })],
        [CMD.WRITE_DIRTY_AT_FILE_NODES_FO, () => w_leo.nodeCommand({
            action: BRIDGE.WRITE_DIRTY_AT_FILE_NODES,
            node: U,
            refreshType: REFRESH_TREE,
            fromOutline: true
        })],

        [CMD.GIT_DIFF, () => w_leo.nodeCommand({
            action: BRIDGE.GIT_DIFF,
            node: U,
            refreshType: REFRESH_TREE_BODY,
            fromOutline: false
        })],

        [CMD.HEADLINE, (p_node: LeoNode) => w_leo.editHeadline(p_node, true)],
        [CMD.HEADLINE_SELECTION, () => w_leo.editHeadline(U, false)],
        [CMD.HEADLINE_SELECTION_FO, () => w_leo.editHeadline(U, true)],

        // cut/copy/paste/delete given node.
        [CMD.COPY, (p_node: LeoNode) => w_leo.copyNode(p_node, true)],
        [CMD.CUT, (p_node: LeoNode) => w_leo.cutNode(p_node, true)],

        [CMD.DELETE, (p_node: LeoNode) => w_leo.nodeCommand({
            action: BRIDGE.DELETE_PNODE,
            node: p_node,
            refreshType: REFRESH_TREE_BODY,
            fromOutline: true,
            keepSelection: true
        })],
        [CMD.PASTE, (p_node: LeoNode) => w_leo.pasteNode(p_node, true)],
        [CMD.PASTE_CLONE, (p_node: LeoNode) => w_leo.pasteAsCloneNode(p_node, true)],

        // cut/copy/paste/delete current selection (self.commander.p)
        [CMD.COPY_SELECTION, () => w_leo.copyNode(U, false)],
        [CMD.CUT_SELECTION, () => w_leo.cutNode(U, false)],
        [CMD.CUT_SELECTION_FO, () => w_leo.cutNode(U, true)],

        [CMD.DELETE_SELECTION, () => w_leo.nodeCommand({
            action: BRIDGE.DELETE_PNODE,
            node: U,
            refreshType: REFRESH_TREE_BODY,
            fromOutline: false
        })],
        [CMD.DELETE_SELECTION_FO, () => w_leo.nodeCommand({
            action: BRIDGE.DELETE_PNODE,
            node: U,
            refreshType: REFRESH_TREE_BODY,
            fromOutline: true
        })],
        [CMD.PASTE_SELECTION, () => w_leo.pasteNode(U, false)],
        [CMD.PASTE_SELECTION_FO, () => w_leo.pasteNode(U, true)],
        [CMD.PASTE_CLONE_SELECTION, () => w_leo.pasteAsCloneNode(U, false)],
        [CMD.PASTE_CLONE_SELECTION_FO, () => w_leo.pasteAsCloneNode(U, true)],

        [CMD.CONTRACT_ALL, () => w_leo.nodeCommand({
            action: BRIDGE.CONTRACT_ALL,
            node: U,
            refreshType: REFRESH_TREE_BODY,
            fromOutline: false
        })],
        [CMD.CONTRACT_ALL_FO, () => w_leo.nodeCommand({
            action: BRIDGE.CONTRACT_ALL,
            node: U,
            refreshType: REFRESH_TREE_BODY,
            fromOutline: true
        })],
        [CMD.CONTRACT_OR_GO_LEFT, () => w_leo.nodeCommand({
            action: BRIDGE.CONTRACT_OR_GO_LEFT,
            node: U,
            refreshType: REFRESH_TREE_BODY,
            fromOutline: true
        })],
        [CMD.EXPAND_AND_GO_RIGHT, () => w_leo.nodeCommand({
            action: BRIDGE.EXPAND_AND_GO_RIGHT,
            node: U,
            refreshType: REFRESH_TREE_BODY,
            fromOutline: true
        })],

        [CMD.GOTO_NEXT_CLONE, (p_node: LeoNode) => w_leo.nodeCommand({
            action: BRIDGE.GOTO_NEXT_CLONE,
            node: p_node,
            refreshType: REFRESH_NODE_BODY,
            fromOutline: true
        })],
        [CMD.GOTO_NEXT_CLONE_SELECTION, () => w_leo.nodeCommand({
            action: BRIDGE.GOTO_NEXT_CLONE,
            node: U,
            refreshType: REFRESH_NODE_BODY,
            fromOutline: false
        })],
        [CMD.GOTO_NEXT_CLONE_SELECTION_FO, () => w_leo.nodeCommand({
            action: BRIDGE.GOTO_NEXT_CLONE,
            node: U,
            refreshType: REFRESH_NODE_BODY,
            fromOutline: true
        })],

        [CMD.GOTO_NEXT_MARKED, () => w_leo.nodeCommand({
            action: BRIDGE.GOTO_NEXT_MARKED,
            node: U,
            refreshType: REFRESH_NODE_BODY,
            fromOutline: true
        })],
        [CMD.GOTO_FIRST_VISIBLE, () => w_leo.nodeCommand({
            action: BRIDGE.GOTO_FIRST_VISIBLE,
            node: U,
            refreshType: REFRESH_NODE_BODY,
            fromOutline: true
        })],
        [CMD.GOTO_LAST_SIBLING, () => w_leo.nodeCommand({
            action: BRIDGE.GOTO_LAST_SIBLING,
            node: U,
            refreshType: REFRESH_NODE_BODY,
            fromOutline: true
        })],
        [CMD.GOTO_LAST_VISIBLE, () => w_leo.nodeCommand({
            action: BRIDGE.GOTO_LAST_VISIBLE,
            node: U,
            refreshType: REFRESH_NODE_BODY,
            fromOutline: true
        })],
        [CMD.GOTO_NEXT_VISIBLE, () => w_leo.nodeCommand({
            action: BRIDGE.GOTO_NEXT_VISIBLE,
            node: U,
            refreshType: REFRESH_NODE_BODY,
            fromOutline: true
        })],
        [CMD.GOTO_PREV_VISIBLE, () => w_leo.nodeCommand({
            action: BRIDGE.GOTO_PREV_VISIBLE,
            node: U,
            refreshType: REFRESH_NODE_BODY,
            fromOutline: true
        })],

        [CMD.PAGE_UP, () => w_leo.nodeCommand({
            action: BRIDGE.PAGE_UP,
            node: U,
            refreshType: REFRESH_NODE_BODY,
            fromOutline: true
        })],
        [CMD.PAGE_DOWN, () => w_leo.nodeCommand({
            action: BRIDGE.PAGE_DOWN,
            node: U,
            refreshType: REFRESH_NODE_BODY,
            fromOutline: true
        })],

        [CMD.DEHOIST, () => w_leo.nodeCommand({
            action: BRIDGE.DEHOIST,
            node: U,
            refreshType: REFRESH_TREE_BODY,
            fromOutline: false
        })],
        [CMD.DEHOIST_FO, () => w_leo.nodeCommand({
            action: BRIDGE.DEHOIST,
            node: U,
            refreshType: REFRESH_TREE_BODY,
            fromOutline: true
        })],
        [CMD.HOIST, (p_node: LeoNode) => w_leo.nodeCommand({
            action: BRIDGE.HOIST_PNODE,
            node: p_node,
            refreshType: REFRESH_TREE_BODY,
            fromOutline: true
        })],
        [CMD.HOIST_SELECTION, () => w_leo.nodeCommand({
            action: BRIDGE.HOIST_PNODE,
            node: U,
            refreshType: REFRESH_TREE,
            fromOutline: false
        })],
        [CMD.HOIST_SELECTION_FO, () => w_leo.nodeCommand({
            action: BRIDGE.HOIST_PNODE,
            node: U,
            refreshType: REFRESH_TREE,
            fromOutline: true
        })],

        [CMD.CLONE, (p_node: LeoNode) => w_leo.nodeCommand({
            action: BRIDGE.CLONE_PNODE,
            node: p_node,
            refreshType: REFRESH_TREE_BODY,
            fromOutline: true
        })],
        [CMD.CLONE_SELECTION, () => w_leo.nodeCommand({
            action: BRIDGE.CLONE_PNODE,
            node: U,
            refreshType: REFRESH_TREE,
            fromOutline: false
        })],
        [CMD.CLONE_SELECTION_FO, () => w_leo.nodeCommand({
            action: BRIDGE.CLONE_PNODE,
            node: U,
            refreshType: REFRESH_TREE,
            fromOutline: true
        })],

        [CMD.INSERT, (p_node: LeoNode) => w_leo.insertNode(p_node, true, false)],
        [CMD.INSERT_SELECTION, () => w_leo.insertNode(U, false, false)],
        [CMD.INSERT_SELECTION_FO, () => w_leo.insertNode(U, true, false)],
        [CMD.INSERT_CHILD, (p_node: LeoNode) => w_leo.insertNode(p_node, true, true)],
        [CMD.INSERT_CHILD_SELECTION, () => w_leo.insertNode(U, false, true)],
        [CMD.INSERT_CHILD_SELECTION_FO, () => w_leo.insertNode(U, true, true)],

        // Special command for when inserting rapidly more than one node without
        // even specifying a headline label, such as spamming CTRL+I rapidly.
        [CMD.INSERT_SELECTION_INTERRUPT, () => w_leo.insertNode(U, false, false, true)],
        [CMD.INSERT_CHILD_SELECTION_INTERRUPT, () => w_leo.insertNode(U, false, true, true)],

        [CMD.MARK, (p_node: LeoNode) => w_leo.changeMark(true, p_node, true)],
        [CMD.MARK_SELECTION, () => w_leo.changeMark(true, U, false)],
        [CMD.MARK_SELECTION_FO, () => w_leo.changeMark(true, U, true)],

        [CMD.UNMARK, (p_node: LeoNode) => w_leo.changeMark(false, p_node, true)],
        [CMD.UNMARK_SELECTION, () => w_leo.changeMark(false, U, false)],
        [CMD.UNMARK_SELECTION_FO, () => w_leo.changeMark(false, U, true)],

        [CMD.EXTRACT, () => w_leo.nodeCommand({
            action: BRIDGE.EXTRACT,
            node: U,
            refreshType: REFRESH_TREE_BODY,
            fromOutline: false
        })],
        [CMD.EXTRACT_NAMES, () => w_leo.nodeCommand({
            action: BRIDGE.EXTRACT_NAMES,
            node: U,
            refreshType: REFRESH_TREE_BODY,
            fromOutline: false
        })],

        [CMD.MOVE_DOWN, (p_node: LeoNode) => w_leo.nodeCommand({
            action: BRIDGE.MOVE_PNODE_DOWN,
            node: p_node,
            refreshType: REFRESH_TREE_BODY,
            fromOutline: true,
            keepSelection: true
        })],
        [CMD.MOVE_DOWN_SELECTION, () => w_leo.nodeCommand({
            action: BRIDGE.MOVE_PNODE_DOWN,
            node: U,
            refreshType: REFRESH_TREE,
            fromOutline: false
        })],
        [CMD.MOVE_DOWN_SELECTION_FO, () => w_leo.nodeCommand({
            action: BRIDGE.MOVE_PNODE_DOWN,
            node: U,
            refreshType: REFRESH_TREE,
            fromOutline: true
        })],

        [CMD.MOVE_LEFT, (p_node: LeoNode) => w_leo.nodeCommand({
            action: BRIDGE.MOVE_PNODE_LEFT,
            node: p_node,
            refreshType: REFRESH_TREE_BODY,
            fromOutline: true,
            keepSelection: true
        })],
        [CMD.MOVE_LEFT_SELECTION, () => w_leo.nodeCommand({
            action: BRIDGE.MOVE_PNODE_LEFT,
            node: U,
            refreshType: REFRESH_TREE,
            fromOutline: false
        })],
        [CMD.MOVE_LEFT_SELECTION_FO, () => w_leo.nodeCommand({
            action: BRIDGE.MOVE_PNODE_LEFT,
            node: U,
            refreshType: REFRESH_TREE,
            fromOutline: true
        })],

        [CMD.MOVE_RIGHT, (p_node: LeoNode) => w_leo.nodeCommand({
            action: BRIDGE.MOVE_PNODE_RIGHT,
            node: p_node,
            refreshType: REFRESH_TREE_BODY,
            fromOutline: true,
            keepSelection: true
        })],
        [CMD.MOVE_RIGHT_SELECTION, () => w_leo.nodeCommand({
            action: BRIDGE.MOVE_PNODE_RIGHT,
            node: U,
            refreshType: REFRESH_TREE,
            fromOutline: false
        })],
        [CMD.MOVE_RIGHT_SELECTION_FO, () => w_leo.nodeCommand({
            action: BRIDGE.MOVE_PNODE_RIGHT,
            node: U,
            refreshType: REFRESH_TREE,
            fromOutline: true
        })],

        [CMD.MOVE_UP, (p_node: LeoNode) => w_leo.nodeCommand({
            action: BRIDGE.MOVE_PNODE_UP,
            node: p_node,
            refreshType: REFRESH_TREE_BODY,
            fromOutline: true,
            keepSelection: true
        })],
        [CMD.MOVE_UP_SELECTION, () => w_leo.nodeCommand({
            action: BRIDGE.MOVE_PNODE_UP,
            node: U,
            refreshType: REFRESH_TREE,
            fromOutline: false
        })],
        [CMD.MOVE_UP_SELECTION_FO, () => w_leo.nodeCommand({
            action: BRIDGE.MOVE_PNODE_UP,
            node: U,
            refreshType: REFRESH_TREE,
            fromOutline: true
        })],

        [CMD.DEMOTE, (p_node: LeoNode) => w_leo.nodeCommand({
            action: BRIDGE.DEMOTE_PNODE,
            node: p_node,
            refreshType: REFRESH_TREE_BODY,
            fromOutline: true,
            keepSelection: true
        })],
        [CMD.DEMOTE_SELECTION, () => w_leo.nodeCommand({
            action: BRIDGE.DEMOTE_PNODE,
            node: U,
            refreshType: REFRESH_TREE,
            fromOutline: false
        })],
        [CMD.DEMOTE_SELECTION_FO, () => w_leo.nodeCommand({
            action: BRIDGE.DEMOTE_PNODE,
            node: U,
            refreshType: REFRESH_TREE,
            fromOutline: true
        })],
        [CMD.PROMOTE, (p_node: LeoNode) => w_leo.nodeCommand({
            action: BRIDGE.PROMOTE_PNODE,
            node: p_node,
            refreshType: REFRESH_TREE_BODY,
            fromOutline: true,
            keepSelection: true
        })],
        [CMD.PROMOTE_SELECTION, () => w_leo.nodeCommand({
            action: BRIDGE.PROMOTE_PNODE,
            node: U,
            refreshType: REFRESH_TREE,
            fromOutline: false
        })],
        [CMD.PROMOTE_SELECTION_FO, () => w_leo.nodeCommand({
            action: BRIDGE.PROMOTE_PNODE,
            node: U,
            refreshType: REFRESH_TREE,
            fromOutline: true
        })],

        [CMD.SORT_CHILDREN, () => w_leo.nodeCommand({
            action: BRIDGE.SORT_CHILDREN,
            node: U,
            refreshType: REFRESH_TREE,
            fromOutline: false,
            keepSelection: true
        })],
        [CMD.SORT_CHILDREN_FO, () => w_leo.nodeCommand({
            action: BRIDGE.SORT_CHILDREN,
            node: U,
            refreshType: REFRESH_TREE,
            fromOutline: true,
            keepSelection: true
        })],
        [CMD.SORT_SIBLING, () => w_leo.nodeCommand({
            action: BRIDGE.SORT_SIBLINGS,
            node: U,
            refreshType: REFRESH_TREE,
            fromOutline: false,
            keepSelection: true
        })],
        [CMD.SORT_SIBLING_FO, () => w_leo.nodeCommand({
            action: BRIDGE.SORT_SIBLINGS,
            node: U,
            refreshType: REFRESH_TREE,
            fromOutline: true,
            keepSelection: true
        })],

        [CMD.REDO, () => w_leo.nodeCommand({
            action: BRIDGE.REDO,
            node: U,
            refreshType: REFRESH_TREE_BODY,
            fromOutline: false
        })],
        [CMD.REDO_DISABLED, () => { }],
        [CMD.REDO_FO, () => w_leo.nodeCommand({
            action: BRIDGE.REDO,
            node: U,
            refreshType: REFRESH_TREE_BODY,
            fromOutline: true
        })],
        [CMD.UNDO, () => w_leo.nodeCommand({
            action: BRIDGE.UNDO,
            node: U,
            refreshType: REFRESH_TREE_BODY,
            fromOutline: false
        })],
        [CMD.UNDO_DISABLED, () => { }],
        [CMD.UNDO_FO, () => w_leo.nodeCommand({
            action: BRIDGE.UNDO,
            node: U,
            refreshType: REFRESH_TREE_BODY,
            fromOutline: true
        })],

        [CMD.CONNECT, () => w_leo.connect()],
        [CMD.START_SERVER, () => w_leo.startServer()],
        [CMD.STOP_SERVER, () => w_leo.killServer()],
        [CMD.CHOOSE_LEO_FOLDER, () => w_leo.chooseLeoFolder()],

        // Called by nodes in tree when selected either by mouse, or with enter
        [CMD.SELECT_NODE, (p_node: LeoNode) => w_leo.selectTreeNode(p_node, false, false)],
        [CMD.OPEN_ASIDE, (p_node: LeoNode) => w_leo.selectTreeNode(p_node, false, true)],

        [CMD.SHOW_OUTLINE, () => w_leo.showOutline(true)], // Also focuses on outline

        [CMD.SHOW_LOG, () => w_leo.showLogPane()],
        [CMD.SHOW_BODY, () => w_leo.showBody(false)], // Also focuses on body

        [CMD.SHOW_WELCOME, () => w_leoSettingsWebview.openWebview()],
        [CMD.SHOW_SETTINGS, () => w_leoSettingsWebview.openWebview()], // Same as SHOW_WELCOME

        [CMD.COPY_MARKED, () => w_leo.nodeCommand({
            action: BRIDGE.COPY_MARKED,
            node: U,
            refreshType: REFRESH_TREE_BODY,
            fromOutline: true
        })],
        [CMD.DIFF_MARKED_NODES, () => w_leo.nodeCommand({
            action: BRIDGE.DIFF_MARKED_NODES,
            node: U,
            refreshType: REFRESH_TREE_BODY,
            fromOutline: true
        })],
        [CMD.MARK_CHANGED_ITEMS, () => w_leo.nodeCommand({
            action: BRIDGE.MARK_CHANGED_ITEMS,
            node: U,
            refreshType: REFRESH_TREE_BODY,
            fromOutline: true
        })],
        [CMD.MARK_SUBHEADS, () => w_leo.nodeCommand({
            action: BRIDGE.MARK_SUBHEADS,
            node: U,
            refreshType: REFRESH_TREE_BODY,
            fromOutline: true
        })],
        [CMD.UNMARK_ALL, () => w_leo.nodeCommand({
            action: BRIDGE.UNMARK_ALL,
            node: U,
            refreshType: REFRESH_TREE_BODY,
            fromOutline: true
        })],
        [CMD.CLONE_MARKED_NODES, () => w_leo.nodeCommand({
            action: BRIDGE.CLONE_MARKED_NODES,
            node: U,
            refreshType: REFRESH_TREE_BODY,
            fromOutline: true
        })],
        [CMD.DELETE_MARKED_NODES, () => w_leo.nodeCommand({
            action: BRIDGE.DELETE_MARKED_NODES,
            node: U,
            refreshType: REFRESH_TREE_BODY,
            fromOutline: true
        })],
        [CMD.MOVE_MARKED_NODES, () => w_leo.nodeCommand({
            action: BRIDGE.MOVE_MARKED_NODES,
            node: U,
            refreshType: REFRESH_TREE_BODY,
            fromOutline: true
        })],

        [CMD.PREV_NODE, () => w_leo.prevNextNode(false)],
        [CMD.PREV_NODE_FO, () => w_leo.prevNextNode(false)],
        [CMD.NEXT_NODE, () => w_leo.prevNextNode(true)],
        [CMD.NEXT_NODE_FO, () => w_leo.prevNextNode(true)],

        [CMD.FIND_QUICK, () => w_leo.findQuick()],
        [CMD.FIND_QUICK_SELECTED, () => w_leo.findQuickSelected()],
        [CMD.FIND_QUICK_TIMELINE, () => w_leo.findQuickTimeline()],
        [CMD.FIND_QUICK_CHANGED, () => w_leo.findQuickChanged()],
        [CMD.FIND_QUICK_HISTORY, () => w_leo.findQuickHistory()],
        [CMD.FIND_QUICK_MARKED, () => w_leo.findQuickMarked()],
        [CMD.FIND_QUICK_GO_ANYWHERE, () => w_leo.findQuickGoAnywhere()],

        [CMD.START_SEARCH, () => w_leo.startSearch()],
        [CMD.FIND_ALL, () => w_leo.findAll(false)],
        [CMD.FIND_NEXT, () => w_leo.find(false, false)],
        [CMD.FIND_NEXT_FO, () => w_leo.find(true, false)],
        [CMD.FIND_PREVIOUS, () => w_leo.find(false, true)],
        [CMD.FIND_PREVIOUS_FO, () => w_leo.find(true, true)],
        [CMD.FIND_VAR, () => w_leo.findSymbol(false)],
        [CMD.FIND_DEF, () => w_leo.findSymbol(true)],
        [CMD.REPLACE, () => w_leo.replace(false, false)],
        [CMD.REPLACE_FO, () => w_leo.replace(true, false)],
        [CMD.REPLACE_THEN_FIND, () => w_leo.replace(false, true)],
        [CMD.REPLACE_THEN_FIND_FO, () => w_leo.replace(true, true)],
        [CMD.REPLACE_ALL, () => w_leo.findAll(true)],
        [CMD.GOTO_GLOBAL_LINE, () => w_leo.gotoGlobalLine()],
        [CMD.TAG_CHILDREN, () => w_leo.tagChildren()],

        [CMD.CLONE_FIND_ALL, () => w_leo.cloneFind(false, false)],
        [CMD.CLONE_FIND_ALL_FLATTENED, () => w_leo.cloneFind(false, true)],
        [CMD.CLONE_FIND_TAG, () => w_leo.cloneFindTag()],
        [CMD.CLONE_FIND_MARKED, () => w_leo.cloneFind(true, false)],
        [CMD.CLONE_FIND_FLATTENED_MARKED, () => w_leo.cloneFind(true, true)],

        [CMD.SET_FIND_EVERYWHERE_OPTION, () => w_leo.setSearchSetting(Constants.FIND_INPUTS_IDS.ENTIRE_OUTLINE)],
        [CMD.SET_FIND_NODE_ONLY_OPTION, () => w_leo.setSearchSetting(Constants.FIND_INPUTS_IDS.NODE_ONLY)],
        [CMD.SET_FIND_SUBOUTLINE_ONLY_OPTION, () => w_leo.setSearchSetting(Constants.FIND_INPUTS_IDS.SUBOUTLINE_ONLY)],
        [CMD.TOGGLE_FIND_IGNORE_CASE_OPTION, () => w_leo.setSearchSetting(Constants.FIND_INPUTS_IDS.IGNORE_CASE)],
        [CMD.TOGGLE_FIND_MARK_CHANGES_OPTION, () => w_leo.setSearchSetting(Constants.FIND_INPUTS_IDS.MARK_CHANGES)],
        [CMD.TOGGLE_FIND_MARK_FINDS_OPTION, () => w_leo.setSearchSetting(Constants.FIND_INPUTS_IDS.MARK_FINDS)],
        [CMD.TOGGLE_FIND_REGEXP_OPTION, () => w_leo.setSearchSetting(Constants.FIND_INPUTS_IDS.REG_EXP)],
        [CMD.TOGGLE_FIND_WORD_OPTION, () => w_leo.setSearchSetting(Constants.FIND_INPUTS_IDS.WHOLE_WORD)],
        [CMD.TOGGLE_FIND_SEARCH_BODY_OPTION, () => w_leo.setSearchSetting(Constants.FIND_INPUTS_IDS.SEARCH_BODY)],
        [CMD.TOGGLE_FIND_SEARCH_HEADLINE_OPTION, () => w_leo.setSearchSetting(Constants.FIND_INPUTS_IDS.SEARCH_HEADLINE)],

        [CMD.SET_ENABLE_PREVIEW, () => w_leo.config.setEnablePreview()],
        [CMD.CLEAR_CLOSE_EMPTY_GROUPS, () => w_leo.config.clearCloseEmptyGroups()],
        [CMD.SET_CLOSE_ON_FILE_DELETE, () => w_leo.config.setCloseOnFileDelete()],
    ];

    w_commands.map(function (p_command) {
        p_context.subscriptions.push(vscode.commands.registerCommand(...p_command));
    });

    // * Close remaining Leo Bodies restored by vscode from last session.
    closeLeoTextEditors();

    // * Show a welcome screen on version updates, then start the actual extension.
    showWelcomeIfNewer(w_leoIntegVersion, w_previousVersion, w_leo)
        .then(() => {
            // if setting for preview mode enabled is false then show popup
            setTimeout(() => {
                // A second and a half to make sure first installs have finished setting those
                // and not to try to see if they're set too soon
                w_leo.config.checkEnablePreview();
                w_leo.config.checkCloseEmptyGroups();
                w_leo.config.checkCloseOnFileDelete();
            }, 1500);

            // Start server and/or connect to it, as per user settings
            w_leo.startNetworkServices();
            // Save version # for next startup comparison
            p_context.globalState.update(Constants.VERSION_STATE_KEY, w_leoIntegVersion);

            // * Log time taken for startup
            // console.log('leoInteg startup launched in ', utils.getDurationMs(w_start), 'ms');

        });
}

/**
 * * Called when extension is deactivated
 */
export function deactivate(): Promise<boolean> {
    closeLeoTextEditors();
    if (LeoInteg) {
        LeoInteg.activated = false;
        LeoInteg.cleanupBody().then(() => {
            LeoInteg?.stopConnection();
        });
        // Call to LeoInteg.stopServer() is not needed: server should handle disconnects.
        // Server should open tk GUI dialogs if dirty files still remain before closing itself.
        return new Promise((p_resolve, p_reject) => {
            setTimeout(() => {
                LeoInteg?.killServer();
                p_resolve(true);
            }, 30000);
        }
        );
    } else {
        return Promise.resolve(false);
    }
}

/**
 * * Closes all visible text editors that have Leo filesystem scheme
 */
function closeLeoTextEditors() {
    vscode.window.visibleTextEditors.forEach(p_textEditor => {
        if (p_textEditor.document.uri.scheme === Constants.URI_LEO_SCHEME) {
            if (p_textEditor.hide) {
                p_textEditor.hide();
            }
        }
    });
}

/**
 * * Show welcome screen if needed, based on last version executed
 * @param p_version Current version, as a string, from packageJSON.version
 * @param p_previousVersion Previous version, as a string, from context.globalState.get service
 * @returns A promise that triggers when command to show the welcome screen is finished, or immediately if not needed
 */
async function showWelcomeIfNewer(p_version: string, p_previousVersion: string | undefined, p_leoInteg: LeoIntegration): Promise<unknown> {
    let w_showWelcomeScreen: boolean = false;
    if (p_previousVersion === undefined) {
        console.log('leointeg first-time install');
        // Force-Set/Clear leointeg's required configuration settings
        p_leoInteg.config.setEnablePreview();
        p_leoInteg.config.clearCloseEmptyGroups();
        p_leoInteg.config.setCloseOnFileDelete();
        w_showWelcomeScreen = true;
    } else {
        if (p_previousVersion !== p_version) {
            vscode.window.showInformationMessage(`leoInteg upgraded from v${p_previousVersion} to v${p_version}`);
            // Force-Set/Clear leointeg's required configuration settings but show info messages
            p_leoInteg.config.checkEnablePreview(true);
            p_leoInteg.config.checkCloseEmptyGroups(true);
            p_leoInteg.config.checkCloseOnFileDelete(true);
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
        return vscode.commands.executeCommand(Constants.COMMANDS.SHOW_WELCOME);
    } else {
        return Promise.resolve();
    }
}
