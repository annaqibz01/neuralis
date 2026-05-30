.
├── neuralis/                   # (Sub-project / Core AI logic jika ada)
├── src/                        # EXTENSION HOST (Backend / Node.js)/
│   ├── contracts/              # KONTRAK DATA BACKEND/
│   │   └── message.contracts.ts # Definisi tipe request/response API & IPC
│   ├── providers/
│   │   └── sidebarProvider.ts  # Hanya handle Webview (The Pure Controller)
│   ├── services/
│   │   ├── deepseekClient.ts   # Integrasi API (Mengonsumsi kontrak chat)
│   │   ├── sessionManager.ts   # Persistence (Save/Load Chat JSON)
│   │   └── configManager.ts    # Manajemen API Key & Model settings
│   └── utils/
│       ├── messageRouter.ts    # Dispatcher (Penerima & pengarah kontrak pesan)
│       ├── constrans.ts
│       └── extension.ts            # Entry point utama ekstensi
├── webview-ui/                 # FRONTEND (Webview / React + Vite)/
│   ├── src/
│   │   ├── contracts/          # KONTRAK DATA FRONTEND (Mirror dari Backend)/
│   │   │   └── webview.contracts.ts # Tipe data pesan, status, dan payload UI
│   │   ├── components/         # Reusable UI (Dumb Components)/
│   │   │   └── Chat/
│   │   │       ├── ChatMessage.tsx # Wrapper pesan
│   │   │       ├── UserBubble.tsx  # Bubble user dengan efek glow
│   │   │       ├── AiBubble.tsx    # Bubble AI dengan markdown & loading dots
│   │   │       ├── ChatInput.tsx   # Area input prompt & file attach
│   │   │       └── Shared/
│   │   ├── hooks/
│   │   ├── useChat.ts      # Logika state, history, & efek interaktif (The Orchestrator)
│   │   ├── pages/              # Routed Halaman Utama/
│   │   │   ├── Chat.tsx        # Sangat ringkas, hanya layouting utama
│   │   │   ├── History.tsx
│   │   │   └── Settings.tsx    # Tempat client input API Key & Model
│   │   ├── App.tsx             # Routing & Global State Setup
│   │   └── main.tsx
│   ├── index.html
│   ├── package.json
│   ├── postcss.config.js
│   ├── tailwind.config.js
│   └── vite.config.js
├── out/
├── .gitignore
├── package.json
└── tsconfig.json