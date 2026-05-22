import React from 'react';

const Settings: React.FC = () => {
    return (
        <div className="flex flex-col h-full p-4 overflow-y-auto">
            <h2 className="text-lg font-bold mb-6 border-b border-[var(--vscode-widget-border)] pb-2">Settings</h2>
            
            <div className="space-y-5">
                {/* API Key Input */}
                <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-semibold">DeepSeek API Key</label>
                    <input 
                        type="password" 
                        placeholder="sk-..." 
                        className="w-full bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)] border border-[var(--vscode-input-border)] rounded-md p-2 focus:outline-none focus:border-blue-500 transition-colors"
                    />
                    <p className="text-xs text-gray-500">Your key is stored securely in VS Code's configuration.</p>
                </div>

                {/* Model Selection */}
                <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-semibold">Model</label>
                    <select className="w-full bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)] border border-[var(--vscode-input-border)] rounded-md p-2 focus:outline-none focus:border-blue-500 transition-colors appearance-none">
                        <option value="deepseek-chat">DeepSeek Chat (V3)</option>
                        <option value="deepseek-reasoning">DeepSeek Reasoning (R1)</option>
                    </select>
                </div>

                {/* Save Button */}
                <button className="w-full bg-blue-600 hover:bg-blue-500 text-white py-2 rounded-md font-medium transition-colors mt-4">
                    Save Settings
                </button>
            </div>
        </div>
    );
};

export default Settings;