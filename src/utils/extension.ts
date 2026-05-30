import * as vscode from 'vscode';
import { SidebarProvider } from '../providers/sidebarprovider';

export function activate(context: vscode.ExtensionContext) {
    // Instantiate the sidebar provider service layer
    const sidebarProvider = new SidebarProvider(context);

    // Register the provider instance matching the view identifier declared in package.json
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            'neuralis.sidebar',
            sidebarProvider
        )
    );
}

// Sub-routine lifecycle hook triggered when the extension execution context terminates
export function deactivate() {}