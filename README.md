# CWH Smart Todo List

A feature-rich, Angular 22 todo application with AI-assisted task decomposition, focus mode, voice input, priority quadrant classification, and calendar integrations.

## Features

- **Smart Task Creation** — Add tasks with title, description, estimated duration, due time, and energy level (Deep Work / Creative Flow / Quick Wins)
- **AI Blueprint & Auto-Decomposition** — Every new task generates a structured blueprint and is automatically broken into subtasks based on its context
- **Priority Quadrant** — Tasks are automatically classified as Do First, Schedule, Delegate, or Drop based on description keywords and due date
- **Focus Mode** — Enter a fullscreen focus timer with ambient sound, velocity tracking, and a doomscroll blocker (tab-leave warning)
- **Voice Input** — Hold Spacebar to capture tasks by voice using the Web Speech API
- **Quick Brain-Dump** — Single-line freeform input that auto-parses duration, energy level, and title
- **Code / Error Scanner** — Paste stack traces or code snippets to instantly generate a debugging task with starter snippet
- **Dev Context Generator** — Suggests install commands and starter code for each task based on keywords
- **Due-Time Notifications** — Browser notifications and in-app toasts fire when a task's scheduled time is reached
- **Calendar Export** — Export any task to a `.ics` file or open directly in Google Calendar
- **Activity Log** — Live history of all create, complete, delete, and voice-add events
- **Ghosted Task Detection** — Tasks older than 48 hours are flagged with a decompose-or-drop prompt
- **Low Energy Mode** — Filters the board to show only Quick Wins tasks
- **Dark / Light Theme** — Persisted via `localStorage`

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Angular 22 (standalone components, signals) |
| Styling | Bootstrap 5, Tailwind CSS 4, custom glass UI |
| Forms | Angular Reactive Forms |
| Build | Angular CLI 22 / `@angular/build` (esbuild) |
| Testing | Vitest |
| Formatting | Prettier |

## Getting Started

### Prerequisites

- Node.js 18+
- npm 11+

### Install

```bash
cd cwh-todo-list
npm install
```

### Run Development Server

```bash
npm start
```

Open [http://localhost:4200](http://localhost:4200) in your browser.

### Build for Production

```bash
npm run build
```

Output is placed in `cwh-todo-list/dist/`.

### Run Tests

```bash
npm test
```

### Watch Mode (dev build)

```bash
npm run watch
```

## Project Structure

```
cwh-todo-list/
├── src/
│   ├── app/
│   │   ├── app.ts          # Root component — all state, logic, and signals
│   │   ├── app.html        # Template — task board, forms, focus modal, toasts
│   │   ├── app.css         # Glass UI, task card, and focus modal styles
│   │   ├── app.routes.ts   # Angular router config
│   │   └── app.config.ts   # App-level providers
│   ├── styles.css          # Global styles
│   ├── main.ts             # Bootstrap entry point
│   └── index.html          # HTML shell
├── angular.json            # Angular workspace config
├── tsconfig.json           # TypeScript config
└── package.json
```

## Key Interfaces

```typescript
interface Task {
  id: number;
  title: string;
  description: string;
  estimatedMinutes: number;
  actualMinutes?: number;
  dueTime?: string;
  completed: boolean;
  priorityQuadrant: 'Do First' | 'Schedule' | 'Delegate' | 'Drop';
  subtasks: SubTask[];
  blueprint?: TaskBlueprint;
  energyLevel?: 'Deep Work' | 'Creative Flow' | 'Quick Wins';
  ghosted?: boolean;
  devContext?: { cmd: string; snippet: string; open?: boolean };
}
```

## Usage Tips

- **Voice shortcut**: Hold `Space` anywhere on the page to start voice capture; release to stop and auto-create the task.
- **Brain-Dump**: Type something like `"Fix navbar link urgently in 20 mins"` into the Quick Brain-Dump input to create a task instantly.
- **Code Scanner**: Paste any stack trace or error into the "Paste Error / Code" textarea and click **Scan Code** to turn it into a debugging task.
- **Focus Mode**: Click **Focus** on any task card to start a timer with ambient rain sound. Switching tabs will trigger a warning chime.
- **Accuracy Tracking**: Enter an actual duration when completing tasks to track your estimation accuracy over time (shown in the header).
