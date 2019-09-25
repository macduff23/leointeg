import * as vscode from "vscode";
import { LeoIntegration } from "./leoIntegration";
import { LeoNode } from "./leoNode";

export class LeoOutlineProvider implements vscode.TreeDataProvider<LeoNode> {
  private _onDidChangeTreeData: vscode.EventEmitter<LeoNode | undefined> =
    new vscode.EventEmitter<LeoNode | undefined>();
  readonly onDidChangeTreeData: vscode.Event<LeoNode | undefined> = this._onDidChangeTreeData.event;

  // TODO : Save and restore selection / cursor position from selection object saved in each node
  // TODO : before / upon selection of other nodes

  constructor(private leoIntegration: LeoIntegration) {
    // give the event for 'refresh' of either root, without params, or a node when passed as parameter
    leoIntegration.setupRefreshFn(this._onDidChangeTreeData);
  }

  public refresh(): void {
    // * Not used for now. Kept as example from treeoutline extension template
    this._onDidChangeTreeData.fire();
    console.log("Leo outline refresh");
  }

  getTreeItem(element: LeoNode): Thenable<LeoNode> | LeoNode {
    if (this.leoIntegration.refreshSingleNodeFlag) {
      this.leoIntegration.refreshSingleNodeFlag = false;
      // return this.leoIntegration.getPNode(element.apJson).then(p_node => {
      //   element.label = p_node.label;
      //   element.gnx = p_node.gnx;
      //   element.collapsibleState = p_node.collapsibleState;
      //   element.apJson = p_node.apJson;
      //   element.cloned = p_node.cloned;
      //   element.dirty = p_node.dirty;
      //   element.marked = p_node.marked;
      //   element.hasBody = p_node.hasBody;
      //   return element;
      // });
      return element; // TODO : REPLACE ABOVE COMMENTS
    } else {
      return element;
    }
  }

  getParent(element: LeoNode): Thenable<LeoNode> | null {
    if (this.leoIntegration.fileOpenedReady) {
      // return this.leoIntegration.getParent(element ? element.apJson : undefined);
      return null; // TODO : REPLACE ABOVE COMMENTS
    } else {
      return null; // default give an empty tree
    }
  }
  getChildren(element?: LeoNode): Thenable<LeoNode[]> {
    if (this.leoIntegration.fileOpenedReady) {
      // return this.leoIntegration.getChildren(element ? element.apJson : undefined);
      return Promise.resolve([]); // TODO : REPLACE ABOVE COMMENTS
    } else {
      return Promise.resolve([]); // default give an empty tree
    }
  }
}


