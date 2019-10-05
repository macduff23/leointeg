import * as vscode from "vscode";
import { LeoIntegration } from "./leoIntegration";
import { LeoNode } from "./leoNode";

export function activate(context: vscode.ExtensionContext) {
  const leoIntegration: LeoIntegration = new LeoIntegration(context);

  // Reset Extension context flags (used in 'when' clauses in package.json)
  vscode.commands.executeCommand('setContext', 'leoBridgeReady', false);
  vscode.commands.executeCommand('setContext', 'leoTreeOpened', false);

  context.subscriptions.push(vscode.commands.registerCommand("leointeg.test", () => leoIntegration.test()));
  context.subscriptions.push(vscode.commands.registerCommand("leointeg.killLeo", () => leoIntegration.killLeoBridge()));

  context.subscriptions.push(vscode.commands.registerCommand("leointeg.openLeoFile", () => leoIntegration.openLeoFile()));
  // TODO : Fleshout this function, also support closing, re-opening and multiple simultaneous Leo documents support
  context.subscriptions.push(vscode.commands.registerCommand("leointeg.closeLeoFile", () => leoIntegration.closeLeoFile()));

  // Select a LeoNode Action
  context.subscriptions.push(vscode.commands.registerCommand("leointeg.selectTreeNode", (p_node: LeoNode) => leoIntegration.selectTreeNode(p_node)));

  // LeoNode Context Menu Actions
  context.subscriptions.push(vscode.commands.registerCommand("leointeg.editHeadline", (p_node: LeoNode) => leoIntegration.editHeadline(p_node)));
  context.subscriptions.push(vscode.commands.registerCommand("leointeg.openAside", (node: LeoNode) => leoIntegration.showBodyDocumentAside(node)));

  // TODO : Fleshout the functions below and setup the rest of outline and body editing, scripting and other functionality of Leo!
  context.subscriptions.push(vscode.commands.registerCommand("leointeg.mark", (node: LeoNode) => leoIntegration.mark(node)));
  context.subscriptions.push(vscode.commands.registerCommand("leointeg.unmark", (node: LeoNode) => leoIntegration.unmark(node)));
  context.subscriptions.push(vscode.commands.registerCommand("leointeg.copyNode", (node: LeoNode) => leoIntegration.copyNode(node)));
  context.subscriptions.push(vscode.commands.registerCommand("leointeg.cutNode", (node: LeoNode) => leoIntegration.cutNode(node)));
  context.subscriptions.push(vscode.commands.registerCommand("leointeg.pasteNode", (node: LeoNode) => leoIntegration.pasteNode(node)));
  context.subscriptions.push(vscode.commands.registerCommand("leointeg.pasteNodeAsClone", (node: LeoNode) => leoIntegration.pasteNodeAsClone(node)));
  context.subscriptions.push(vscode.commands.registerCommand("leointeg.delete", (node: LeoNode) => leoIntegration.delete(node)));

}

export function deactivate() {
  console.log('Extension "leointeg" is deactivated');
}
