# No-Code UI Automation - Web Application

## Project Overview

Building an enterprise-grade React web application for the No-Code UI Automation Platform.
This frontend consumes the existing Node.js/Express backend API to provide:

- Gherkin feature editor with syntax validation
- Test execution with real-time progress monitoring
- Results dashboard with artifact viewing (videos, screenshots, traces)
- Configuration management for browser and LLM settings

**Tech Stack:**
- React 18 + TypeScript
- Vite (build tool)
- Tailwind CSS + shadcn/ui (styling)
- Zustand (state management)
- React Query (server state & caching)
- Monaco Editor (Gherkin editor)
- React Router v6 (routing)

## Development Philosophy

Follow the same enterprise conventions as the backend:

- **Component-based architecture** - Small, reusable, single-responsibility components
- **Separation of concerns** - UI components don't contain business logic
- **Type safety** - Full TypeScript coverage with interfaces matching backend DTOs
- **API abstraction** - All backend calls go through service layer
- **State management** - Global state in stores, server state via React Query
- **Error boundaries** - Graceful error handling at page level
- **Accessibility** - WCAG 2.1 AA compliance
- **Responsive design** - Mobile-first approach

## Folder Structure

```
no-code/
└── web-app/
    ├── index.html
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.ts
    ├── tailwind.config.js
    ├── postcss.config.js
    ├── .env
    ├── .env.development
    ├── .env.production
    │
    ├── public/
    │   ├── favicon.ico
    │   └── assets/
    │
    └── src/
        ├── main.tsx                    # App entry point
        ├── App.tsx                     # Root component with routing
        ├── vite-env.d.ts
        │
        ├── types/                      # TypeScript interfaces
        │   ├── index.ts
        │   ├── api.types.ts            # API request/response types
        │   ├── execution.types.ts      # Execution domain types
        │   ├── feature.types.ts        # Feature/scenario types
        │   └── config.types.ts         # Configuration types
        │
        ├── config/                     # App configuration
        │   ├── index.ts
        │   ├── api.config.ts           # API base URL, timeouts
        │   ├── editor.config.ts        # Monaco editor settings
        │   └── defaults.config.ts      # Default form values
        │
        ├── services/                   # API service layer
        │   ├── index.ts
        │   ├── api.client.ts           # Axios instance with interceptors
        │   ├── execution.service.ts    # /api/execution/* endpoints
        │   ├── feature.service.ts      # /api/feature/* endpoints
        │   ├── mapping.service.ts      # /api/mapping/* endpoints
        │   ├── mcp.service.ts          # /api/mcp/* endpoints
        │   └── llm.service.ts          # /api/llm/* endpoints
        │
        ├── hooks/                      # Custom React hooks
        │   ├── index.ts
        │   ├── useExecutionPolling.ts  # Poll execution status
        │   ├── useFeatureValidation.ts # Validate Gherkin syntax
        │   ├── useLocalStorage.ts      # Persist to localStorage
        │   ├── useDebounce.ts          # Debounce input changes
        │   └── useMediaQuery.ts        # Responsive breakpoints
        │
        ├── stores/                     # Zustand state stores
        │   ├── index.ts
        │   ├── execution.store.ts      # Current execution state
        │   ├── editor.store.ts         # Editor content & settings
        │   ├── settings.store.ts       # User preferences
        │   └── notification.store.ts   # Toast notifications
        │
        ├── pages/                      # Page components (routes)
        │   ├── index.ts
        │   ├── Dashboard/
        │   │   ├── Dashboard.tsx
        │   │   ├── Dashboard.styles.ts
        │   │   └── components/
        │   │       ├── ExecutionCard.tsx
        │   │       ├── QuickRunForm.tsx
        │   │       └── StatsOverview.tsx
        │   │
        │   ├── Editor/
        │   │   ├── Editor.tsx
        │   │   ├── Editor.styles.ts
        │   │   └── components/
        │   │       ├── GherkinEditor.tsx
        │   │       ├── ValidationPanel.tsx
        │   │       ├── StepPreview.tsx
        │   │       └── RunButton.tsx
        │   │
        │   ├── Execution/
        │   │   ├── Execution.tsx
        │   │   ├── Execution.styles.ts
        │   │   └── components/
        │   │       ├── ProgressTracker.tsx
        │   │       ├── StepList.tsx
        │   │       ├── LivePreview.tsx
        │   │       └── ActionLog.tsx
        │   │
        │   ├── Results/
        │   │   ├── Results.tsx
        │   │   ├── Results.styles.ts
        │   │   └── components/
        │   │       ├── ResultsSummary.tsx
        │   │       ├── ScenarioResult.tsx
        │   │       ├── StepResult.tsx
        │   │       ├── ArtifactViewer.tsx
        │   │       ├── VideoPlayer.tsx
        │   │       ├── ScreenshotGallery.tsx
        │   │       └── GeneratedCode.tsx
        │   │
        │   ├── History/
        │   │   ├── History.tsx
        │   │   └── components/
        │   │       ├── ExecutionTable.tsx
        │   │       ├── FilterBar.tsx
        │   │       └── Pagination.tsx
        │   │
        │   └── Settings/
        │       ├── Settings.tsx
        │       └── components/
        │           ├── BrowserSettings.tsx
        │           ├── LLMSettings.tsx
        │           ├── DefaultsSettings.tsx
        │           └── APISettings.tsx
        │
        ├── components/                 # Shared UI components
        │   ├── ui/                     # shadcn/ui components
        │   │   ├── button.tsx
        │   │   ├── input.tsx
        │   │   ├── select.tsx
        │   │   ├── card.tsx
        │   │   ├── dialog.tsx
        │   │   ├── tabs.tsx
        │   │   ├── toast.tsx
        │   │   ├── badge.tsx
        │   │   ├── progress.tsx
        │   │   └── skeleton.tsx
        │   │
        │   ├── layout/                 # Layout components
        │   │   ├── Header.tsx
        │   │   ├── Sidebar.tsx
        │   │   ├── Footer.tsx
        │   │   ├── PageContainer.tsx
        │   │   └── MainLayout.tsx
        │   │
        │   ├── common/                 # Common reusable components
        │   │   ├── Logo.tsx
        │   │   ├── StatusBadge.tsx
        │   │   ├── LoadingSpinner.tsx
        │   │   ├── ErrorMessage.tsx
        │   │   ├── EmptyState.tsx
        │   │   ├── ConfirmDialog.tsx
        │   │   └── Breadcrumb.tsx
        │   │
        │   └── feature/                # Feature-specific shared components
        │       ├── BrowserConfigForm.tsx
        │       ├── ExecutionOptions.tsx
        │       └── FeaturePreview.tsx
        │
        ├── utils/                      # Utility functions
        │   ├── index.ts
        │   ├── formatters.ts           # Date, duration, size formatting
        │   ├── validators.ts           # Client-side validation
        │   ├── gherkin.utils.ts        # Gherkin syntax helpers
        │   └── storage.utils.ts        # localStorage helpers
        │
        └── styles/                     # Global styles
            ├── globals.css             # Tailwind imports + custom CSS
            └── themes/
                ├── light.css
                └── dark.css
```
