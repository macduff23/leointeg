import * as vscode from "vscode";
import { Constants } from "./constants";
import { LeoIntegration } from "./leoIntegration";
import { ArchivedPosition } from "./types"; // * TO HELP DEBUG

/**
 * * Implementation of tree nodes for usage in a TreeDataProvider
 */
export class LeoNode extends vscode.TreeItem {

    public cursorSelection: any; // TODO : #39 @boltex Keep body's cursor and selection position from vscode to get it back
    public contextValue: string; // * Context string is checked in package.json with 'when' clauses

    constructor(
        public label: string, // Node headline
        public gnx: string,
        public collapsibleState: vscode.TreeItemCollapsibleState, // Computed in receiver/creator
        public apJson: string, // Key for leo/python side of things
        public childIndex: number, // For debugging purposes
        public cloned: boolean,
        public dirty: boolean,
        public marked: boolean,
        public atFile: boolean,
        public hasBody: boolean,
        private _leoIntegration: LeoIntegration,
        private _id: string
    ) {
        super(label, collapsibleState);
        this.contextValue = this._getContextValue(marked, atFile);
        this.command = {
            command: Constants.NAME + "." + Constants.COMMANDS.SELECT_NODE,
            title: '',
            arguments: [this]
        };
    }

    // * TO HELP DEBUG

    // get description(): string {
    //     // * some smaller grayed-out text accompanying the main label
    //     const w_ap: ArchivedPosition = JSON.parse(this.apJson);
    //     return "child:" + w_ap.childIndex + " lvl:" + w_ap.level + " gnx:" + w_ap.gnx;
    // }

    // get description(): string {
    //     // * some smaller grayed-out text accompanying the main label
    //     return "id:" + this.id;
    // }

    /**
     * * Sets this node properties (dirty, marked, etc.) by copying from a given node.
     * * This is needed by the outline provider when refreshing a single node.
     * @param p_node Node to copy properties from
     */
    public copyProperties(p_node: LeoNode): LeoNode {
        this.label = p_node.label;
        this.gnx = p_node.gnx;
        this.collapsibleState = p_node.collapsibleState;
        this.apJson = p_node.apJson;
        this.childIndex = p_node.childIndex;
        this.cloned = p_node.cloned;
        this.dirty = p_node.dirty;
        this.marked = p_node.marked;
        this.atFile = p_node.atFile;
        this.hasBody = p_node.hasBody;
        this.contextValue = this._getContextValue(p_node.marked, p_node.atFile);
        return this;
    }

    private _getContextValue(p_marked: boolean, p_atFile: boolean): string {
        let w_contextValue = Constants.CONTEXT_FLAGS.SELECTED_UNMARKED; // * Start it with 'leoNodeMarked' or 'leoNodeUnmarked'
        if (p_marked) {
            w_contextValue = Constants.CONTEXT_FLAGS.SELECTED_MARKED;
        }
        if (p_atFile) {
            w_contextValue += Constants.CONTEXT_FLAGS.SELECTED_ATFILE; // * then append 'leoNodeAtFile' to existing if needed
        }
        return w_contextValue;
    }

    public getCursorSelection(): any {
        return this.cursorSelection;
    }

    public setCursorSelection(p_cursorSelection: any): void {
        this.cursorSelection = p_cursorSelection;
    }

    public get iconPath(): { light: string; dark: string } {
        // From Leo's leoNodes.py computeIcon function
        // 1=has Body, 2=marked, 4=cloned, 8=dirty
        let w_dirty: boolean = this._leoIntegration.config.invertNodeContrast ? !this.dirty : this.dirty;
        let w_icon: number =
            (+w_dirty << 3) |
            (+this.cloned << 2) |
            (+this.marked << 1) |
            +this.hasBody;
        return this._leoIntegration.icons[w_icon];
    }

    // Optional id for the tree item that has to be unique across tree.
    // The id is used to preserve the selection and expansion state of the tree item.
    // If not provided, an id is generated using the tree item's label.
    // Note that when labels change, ids will change and that selection and expansion state cannot be kept stable anymore.
    public get id(): string { return this._id; }

    public get tooltip(): string { return this.label; } // * Whole headline as tooltip
}