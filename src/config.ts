import * as vscode from "vscode";
import * as utils from "./utils";
import { ConfigMembers } from "./types";
import { Constants } from "./constants";
import { LeoIntegration } from "./leoIntegration";

/**
 * * Configuration Settings Service
 */
export class Config implements ConfigMembers {
    // Some config settings are used in leobridgeserver.py such as defaultReloadIgnore and checkForChangeExternalFiles
    public checkForChangeExternalFiles: string = "none";  // Used in leoBridge script
    public defaultReloadIgnore: string = "none"; // Used in leoBridge script
    public treeKeepFocus: boolean = true;
    public treeKeepFocusWhenAside: boolean = false;
    public treeInExplorer: boolean = true;
    public showOpenAside: boolean = true;
    public statusBarString: string = "";
    public statusBarColor: string = "";
    public showArrowsOnNodes: boolean = false;
    public showAddOnNodes: boolean = false;
    public showMarkOnNodes: boolean = false;
    public showCloneOnNodes: boolean = false;
    public showCopyOnNodes: boolean = false;
    public invertNodeContrast: boolean = false;
    public bodyEditDelay: number = 500;
    public leoPythonCommand: string = "";
    public startServerAutomatically: boolean = true;
    public connectToServerAutomatically: boolean = true;
    public connectionAddress: string = Constants.TCPIP_DEFAULT_ADDRESS;
    public connectionPort: number = Constants.TCPIP_DEFAULT_PORT;

    private _isSettingConfig: boolean = false;

    constructor(
        private _context: vscode.ExtensionContext,
        private _leoIntegration: LeoIntegration
    ) {
    }

    /**
     * * Get Leointeg Configuration
     * @returns An object with all 'live' config settings members such as treeKeepFocus, defaultReloadIgnore, etc.
     */
    public getConfig(): ConfigMembers {
        return {
            checkForChangeExternalFiles: this.checkForChangeExternalFiles,  // Used in leoBridge script
            defaultReloadIgnore: this.defaultReloadIgnore,  // Used in leoBridge script
            treeKeepFocus: this.treeKeepFocus,
            treeKeepFocusWhenAside: this.treeKeepFocusWhenAside,
            treeInExplorer: this.treeInExplorer,
            showOpenAside: this.showOpenAside,
            statusBarString: this.statusBarString,
            statusBarColor: this.statusBarColor,
            showArrowsOnNodes: this.showArrowsOnNodes,
            showAddOnNodes: this.showAddOnNodes,
            showMarkOnNodes: this.showMarkOnNodes,
            showCloneOnNodes: this.showCloneOnNodes,
            showCopyOnNodes: this.showCopyOnNodes,
            invertNodeContrast: this.invertNodeContrast,
            bodyEditDelay: this.bodyEditDelay,
            leoPythonCommand: this.leoPythonCommand,
            startServerAutomatically: this.startServerAutomatically,
            connectToServerAutomatically: this.connectToServerAutomatically,
            connectionAddress: this.connectionAddress,
            connectionPort: this.connectionPort,
        };
    }

    /**
     * * Make changes to the expansion config settings, the updated configuration values are persisted
     * @param p_changes an array of key/values to change in the expansion settings
     * @returns a promise in case additional procedures need to be run upon completion
     */
    public setLeoIntegSettings(p_changes: { code: string, value: any }[]): Promise<void> {
        this._isSettingConfig = true;
        const w_promises: Thenable<void>[] = [];
        const w_vscodeConfig = vscode.workspace.getConfiguration(Constants.CONFIG_SECTION);

        p_changes.forEach(i_change => {
            if (w_vscodeConfig.inspect(i_change.code)!.defaultValue === i_change.value) {
                // set as undefined - same as default
                w_promises.push(w_vscodeConfig.update(i_change.code, undefined, true));
                // console.log("clearing ", change.code, "to undefined");
            } else {
                // set as value which is not default
                w_promises.push(w_vscodeConfig.update(i_change.code, i_change.value, true));
                // console.log("setting ", change.code, "to ", change.value);
            }
        });
        return Promise.all(w_promises).then(() => {
            this._isSettingConfig = false;
            this.buildFromSavedSettings();
        });
    }

    /**
     * * Build config from settings from vscode's saved config settings
     */
    public buildFromSavedSettings(): void {
        if (this._isSettingConfig) {
            // * Currently setting config, wait until its done all, and this will be called automatically
            return;
        } else {
            // * Graphic and theme settings
            this.invertNodeContrast = vscode.workspace.getConfiguration(Constants.CONFIG_SECTION).get(Constants.CONFIGURATION.INVERT_NODES, false);
            this.statusBarString = vscode.workspace.getConfiguration(Constants.CONFIG_SECTION).get(Constants.CONFIGURATION.STATUSBAR_STRING, Constants.GUI.STATUSBAR_DEFAULT_STRING);
            if (this.statusBarString.length > 8) {
                this.statusBarString = Constants.GUI.STATUSBAR_DEFAULT_STRING;
            }
            this.statusBarColor = vscode.workspace.getConfiguration(Constants.CONFIG_SECTION).get(Constants.CONFIGURATION.STATUSBAR_COLOR, Constants.GUI.STATUSBAR_DEFAULT_COLOR);
            if (!utils.isHexColor(this.statusBarColor)) {
                this.statusBarColor = Constants.GUI.STATUSBAR_DEFAULT_COLOR;
            }
            // * Interface elements visibility
            this.checkForChangeExternalFiles = vscode.workspace.getConfiguration(Constants.CONFIG_SECTION).get(Constants.CONFIGURATION.CHECK_FOR_CHANGE_EXTERNAL_FILES, "none");
            this.defaultReloadIgnore = vscode.workspace.getConfiguration(Constants.CONFIG_SECTION).get(Constants.CONFIGURATION.DEFAULT_RELOAD_IGNORE, "none");
            this.treeInExplorer = vscode.workspace.getConfiguration(Constants.CONFIG_SECTION).get(Constants.CONFIGURATION.TREE_IN_EXPLORER, true);
            this.showOpenAside = vscode.workspace.getConfiguration(Constants.CONFIG_SECTION).get(Constants.CONFIGURATION.SHOW_OPEN_ASIDE, true);
            this.showArrowsOnNodes = vscode.workspace.getConfiguration(Constants.CONFIG_SECTION).get(Constants.CONFIGURATION.SHOW_ARROWS, false);
            this.showAddOnNodes = vscode.workspace.getConfiguration(Constants.CONFIG_SECTION).get(Constants.CONFIGURATION.SHOW_ADD, false);
            this.showMarkOnNodes = vscode.workspace.getConfiguration(Constants.CONFIG_SECTION).get(Constants.CONFIGURATION.SHOW_MARK, false);
            this.showCloneOnNodes = vscode.workspace.getConfiguration(Constants.CONFIG_SECTION).get(Constants.CONFIGURATION.SHOW_CLONE, false);
            this.showCopyOnNodes = vscode.workspace.getConfiguration(Constants.CONFIG_SECTION).get(Constants.CONFIGURATION.SHOW_COPY, false);
            // * Interface settings
            this.treeKeepFocus = vscode.workspace.getConfiguration(Constants.CONFIG_SECTION).get(Constants.CONFIGURATION.TREE_KEEP_FOCUS, true);
            this.treeKeepFocusWhenAside = vscode.workspace.getConfiguration(Constants.CONFIG_SECTION).get(Constants.CONFIGURATION.TREE_KEEP_FOCUS_WHEN_ASIDE, false);
            this.bodyEditDelay = vscode.workspace.getConfiguration(Constants.CONFIG_SECTION).get(Constants.CONFIGURATION.BODY_EDIT_DELAY, 500);
            // * Server and connection automation
            this.leoPythonCommand = vscode.workspace.getConfiguration(Constants.CONFIG_SECTION).get(Constants.CONFIGURATION.LEO_PYTHON_COMMAND, "");
            this.startServerAutomatically = vscode.workspace.getConfiguration(Constants.CONFIG_SECTION).get(Constants.CONFIGURATION.AUTO_START_SERVER, true);
            this.connectToServerAutomatically = vscode.workspace.getConfiguration(Constants.CONFIG_SECTION).get(Constants.CONFIGURATION.AUTO_CONNECT, true);
            this.connectionAddress = vscode.workspace.getConfiguration(Constants.CONFIG_SECTION).get(Constants.CONFIGURATION.IP_ADDRESS, Constants.TCPIP_DEFAULT_ADDRESS); // 'ws://'
            this.connectionPort = vscode.workspace.getConfiguration(Constants.CONFIG_SECTION).get(Constants.CONFIGURATION.IP_PORT, Constants.TCPIP_DEFAULT_PORT); // 32125
            // * Set context for tree items visibility that are based on config options
            this._leoIntegration.sendConfigToServer(this.getConfig());
            utils.setContext(Constants.CONTEXT_FLAGS.TREE_IN_EXPLORER, this.treeInExplorer);
            utils.setContext(Constants.CONTEXT_FLAGS.SHOW_OPEN_ASIDE, this.showOpenAside);
            utils.setContext(Constants.CONTEXT_FLAGS.SHOW_ARROWS, this.showArrowsOnNodes);
            utils.setContext(Constants.CONTEXT_FLAGS.SHOW_ADD, this.showAddOnNodes);
            utils.setContext(Constants.CONTEXT_FLAGS.SHOW_MARK, this.showMarkOnNodes);
            utils.setContext(Constants.CONTEXT_FLAGS.SHOW_CLONE, this.showCloneOnNodes);
            utils.setContext(Constants.CONTEXT_FLAGS.SHOW_COPY, this.showCopyOnNodes);
        }
    }
}