# CWH Smart Todo — AI-Powered Task Manager

> Built with **Angular 22** · Signals · Standalone Components · Web APIs

A feature-rich todo application with AI-assisted task decomposition, focus mode, voice input, priority quadrant classification, tags, recurring tasks, and dark mode.

🔗 **Live Demo → [https://warm-treacle-cf201e.netlify.app](https://warm-treacle-cf201e.netlify.app)**

---

## Features

| Feature | Description |
|---|---|
| **Smart Task Creation** | Add tasks with title, description, estimated duration, due time, energy level, tags, and recurrence |
| **AI Blueprint** | Every task auto-generates a structured delivery blueprint |
| **Auto Subtask Decomposition** | Tasks are broken into actionable subtasks automatically |
| **Priority Quadrant** | Auto-classifies tasks as Do First / Schedule / Delegate / Drop |
| **Filter & Search** | Search by keyword, filter by priority, energy level, or tag |
| **Tags System** | Assign Work / Personal / Health / Study tags with one-click filter tabs |
| **Recurring Tasks** | Mark tasks as Daily or Weekly — they respawn automatically when completed |
| **Edit Task** | Inline edit any task's title, description, due time, tags, and recurrence |
| **Undo Delete** | 5-second undo window after deleting a task |
| **Focus Mode** | Fullscreen focus timer with ambient rain sound and velocity tracking |
| **Voice Input** | Hold `Space` to capture tasks by voice using the Web Speech API |
| **Quick Brain-Dump** | Single-line freeform input that auto-parses duration, energy level, and title |
| **Code / Error Scanner** | Paste stack traces to instantly generate a debugging task |
| **Dev Context Generator** | Suggests install commands and starter code per task |
| **Due-Time Notifications** | Browser notifications and in-app toasts fire at the scheduled time |
| **Calendar Export** | Export any task to `.ics` or open directly in Google Calendar |
| **Activity Log** | Live history of all create, complete, delete, and voice-add events |
| **Ghosted Task Detection** | Tasks older than 48 hours are flagged with a decompose-or-drop prompt |
| **Completed Archive** | Completed tasks collapse into a clean archive section |
| **localStorage Persistence** | All tasks and history survive page refreshes |
| **Dark / Light Theme** | Fully themed dark mode, persisted via `localStorage` |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Angular 22 (standalone components, signals) |
| State | Angular Signals + `computed()` + `effect()` |
| Styling | Bootstrap 5, Tailwind CSS 4, custom glass UI |
| Forms | Angular Reactive Forms |
| Storage | localStorage (zero backend required) |
| APIs | Web Speech API, Web Audio API, Notifications API |
| Build | Angular CLI 22 / `@angular/build` (esbuild) |

---

## Getting Started

### Prerequisites
- Node.js 18+
- npm 11+

### Install & Run

```bash
cd cwh-todo-list
npm install
npm start
```

Open [http://localhost:4200](http://localhost:4200)

### Build for Production

```bash
npm run build
```

Output goes to `dist/cwh-todo-list/browser/`

---

## Usage Tips

- **Voice shortcut** — Hold `Space` anywhere (not in an input) to start voice capture; release to stop and auto-create the task
- **Brain-Dump** — Type `"Fix navbar link urgently in 20 mins"` and hit Quick Add — it parses duration and priority automatically
- **Code Scanner** — Paste any stack trace into the "Paste Error / Code" textarea and click **Scan Code**
- **Focus Mode** — Click **Focus** on any task to start a Pomodoro timer with ambient sound. Switching tabs triggers a warning chime
- **Recurring Tasks** — Set a task to Daily or Weekly; completing it auto-creates the next occurrence
- **Undo** — Deleted a task by mistake? Hit **Undo** in the toast within 5 seconds

---

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
  tags?: string[];
  recurring?: 'none' | 'daily' | 'weekly';
  ghosted?: boolean;
  devContext?: { cmd: string; snippet: string; open?: boolean };
}
```

---

## Project Structure

```
cwh-todo-list/
├── src/
│   ├── app/
│   │   ├── app.ts          # Root component — all state, logic, and signals
│   │   ├── app.html        # Template — task board, forms, focus modal, toasts
│   │   ├── app.css         # Glass UI, task card, dark mode styles
│   │   ├── app.routes.ts   # Angular router config
│   │   └── app.config.ts   # App-level providers
│   ├── styles.css          # Global styles + dark theme CSS variables
│   ├── main.ts             # Bootstrap entry point
│   └── index.html          # HTML shell with meta/OG tags
├── screenshots/            # README screenshots
├── angular.json
├── tsconfig.json
└── package.json
```

---

## License

MIT
