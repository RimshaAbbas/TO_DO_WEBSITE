import { CommonModule } from '@angular/common';
import { Component, computed, signal, OnInit, OnDestroy, effect } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';

export interface SubTask {
  id: string;
  title: string;
  completed: boolean;
}

export interface BlueprintSection {
  name: string;
  details: string[];
}

export interface TaskBlueprint {
  title: string;
  goal: string;
  sections: BlueprintSection[];
  preview: string[];
}

export interface Task {
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
  notified?: boolean;
  energyLevel?: 'Deep Work' | 'Creative Flow' | 'Quick Wins';
  createdAt?: number;
  ghosted?: boolean;
  tags?: string[];
  recurring?: 'none' | 'daily' | 'weekly';
  devContext?: {
    cmd: string;
    snippet: string;
    open?: boolean;
  };
}

export interface HistoryLog {
  id: number;
  action: string;
  taskTitle: string;
  timestamp: string;
}

export interface ActiveToast {
  id: number;
  title: string;
  message: string;
  undoTaskId?: number;
}

const STORAGE_KEY_TODOS = 'cwh_todos';
const STORAGE_KEY_HISTORY = 'cwh_history';
const ALL_TAGS = ['Work', 'Personal', 'Health', 'Study', 'Finance', 'Errands', 'Creative'];

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit, OnDestroy {
  protected readonly title = signal('CWH Smart Todo');

  // --- Core State ---
  readonly todos = signal<Task[]>(this.loadTodos());
  readonly history = signal<HistoryLog[]>(this.loadHistory());
  readonly toasts = signal<ActiveToast[]>([]);

  // --- Editing ---
  readonly editingTaskId = signal<number | null>(null);
  readonly editForm: FormGroup;

  // --- Filter & Search ---
  readonly searchQuery = signal('');
  readonly filterPriority = signal<string>('All');
  readonly filterEnergy = signal<string>('All');
  readonly filterTag = signal<string>('All');
  readonly showCompleted = signal(false);

  // --- Tags ---
  readonly availableTags = ALL_TAGS;
  readonly newTagInput = signal('');

  // --- Undo Delete ---
  private deletedTaskCache = new Map<number, { task: Task; index: number }>();

  // --- Computed Stats ---
  readonly totalTasks = computed(() => this.todos().length);
  readonly completedTasks = computed(() => this.todos().filter((task) => task.completed).length);
  readonly overallAccuracy = computed(() => {
    const completedWithActual = this.todos().filter((task) => task.actualMinutes !== undefined);
    if (!completedWithActual.length) return 100;
    const totalAccuracy = completedWithActual.reduce((sum, task) => sum + this.calculateAccuracy(task), 0);
    return Math.round(totalAccuracy / completedWithActual.length);
  });

  // --- Active (non-completed) filtered list ---
  readonly activeTodos = computed(() => {
    let list = this.todos().filter((t) => !t.completed);
    const q = this.searchQuery().toLowerCase().trim();
    const prio = this.filterPriority();
    const energy = this.filterEnergy();
    const tag = this.filterTag();

    if (this.lowEnergyMode()) list = list.filter((t) => t.energyLevel === 'Quick Wins');
    if (q) list = list.filter((t) => t.title.toLowerCase().includes(q) || t.description.toLowerCase().includes(q));
    if (prio !== 'All') list = list.filter((t) => t.priorityQuadrant === prio);
    if (energy !== 'All') list = list.filter((t) => t.energyLevel === energy);
    if (tag !== 'All') list = list.filter((t) => t.tags?.includes(tag));

    return list;
  });

  // --- Completed filtered list ---
  readonly completedTodos = computed(() => {
    let list = this.todos().filter((t) => t.completed);
    const q = this.searchQuery().toLowerCase().trim();
    if (q) list = list.filter((t) => t.title.toLowerCase().includes(q) || t.description.toLowerCase().includes(q));
    return list;
  });

  // --- Has active filters ---
  readonly hasActiveFilters = computed(() =>
    this.searchQuery().trim() !== '' ||
    this.filterPriority() !== 'All' ||
    this.filterEnergy() !== 'All' ||
    this.filterTag() !== 'All'
  );

  readonly todoForm: FormGroup;
  private timerInterval: any;
  private focusTimerInterval: any;
  private voiceRec: any = null;
  private visibilityHandler: any = null;
  private keyDownHandler: any = null;
  private keyUpHandler: any = null;
  private blurHandler: any = null;
  readonly lowEnergyMode = signal(false);
  readonly listening = signal(false);
  codeSnippetText = signal('');
  readonly focusedTaskId = signal<number | null>(null);
  readonly focusRemaining = signal<number>(0);
  private audioCtx: any = null;
  readonly focusedTask = computed(() => this.todos().find((t) => t.id === this.focusedTaskId()));
  brainDumpText = signal('');
  readonly theme = signal<'light' | 'dark'>('light');

  constructor(private readonly fb: FormBuilder) {
    this.todoForm = this.fb.group({
      title: ['', Validators.required],
      description: ['', Validators.required],
      estimatedMinutes: [30, [Validators.required, Validators.min(1)]],
      actualMinutes: [null],
      dueTime: [''],
      energyLevel: ['Deep Work'],
      tags: [[]],
      recurring: ['none'],
    });

    this.editForm = this.fb.group({
      title: ['', Validators.required],
      description: ['', Validators.required],
      estimatedMinutes: [30, [Validators.required, Validators.min(1)]],
      dueTime: [''],
      energyLevel: ['Deep Work'],
      tags: [[]],
      recurring: ['none'],
    });

    // Auto-persist todos and history whenever they change
    effect(() => {
      const todos = this.todos();
      try { localStorage.setItem(STORAGE_KEY_TODOS, JSON.stringify(todos)); } catch { }
    });

    effect(() => {
      const history = this.history();
      try { localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(history)); } catch { }
    });
  }

  // --- localStorage persistence ---
  private loadTodos(): Task[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_TODOS);
      if (raw) return JSON.parse(raw) as Task[];
    } catch { }
    return [];
  }

  private loadHistory(): HistoryLog[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_HISTORY);
      if (raw) return JSON.parse(raw) as HistoryLog[];
    } catch { }
    return [];
  }

  ngOnInit(): void {
    this.requestNotificationPermission();
    this.timerInterval = setInterval(() => this.checkDueNotifications(), 3000);

    this.visibilityHandler = () => {
      if (document.visibilityState === 'hidden' && this.focusedTaskId() !== null) {
        this.playWarningChime();
      }
    };
    document.addEventListener('visibilitychange', this.visibilityHandler);

    this.blurHandler = () => {
      if (this.focusedTaskId() !== null) this.playWarningChime();
    };
    window.addEventListener('blur', this.blurHandler);

    this.keyDownHandler = (e: KeyboardEvent) => {
      // Don't trigger voice when user is typing in an input/textarea
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.code === 'Space' && !this.listening()) {
        e.preventDefault();
        this.startVoiceCapture();
      }
    };
    this.keyUpHandler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.code === 'Space' && this.listening()) {
        e.preventDefault();
        this.stopVoiceCapture();
      }
    };
    window.addEventListener('keydown', this.keyDownHandler);
    window.addEventListener('keyup', this.keyUpHandler);

    try {
      const stored = localStorage.getItem('cwh_theme');
      if (stored === 'dark' || stored === 'light') this.theme.set(stored as 'dark' | 'light');
    } catch { }
    this.applyThemeClass();
  }

  ngOnDestroy(): void {
    if (this.timerInterval) clearInterval(this.timerInterval);
    if (this.focusTimerInterval) clearInterval(this.focusTimerInterval);
    if (this.visibilityHandler) document.removeEventListener('visibilitychange', this.visibilityHandler);
    if (this.blurHandler) window.removeEventListener('blur', this.blurHandler);
    if (this.keyDownHandler) window.removeEventListener('keydown', this.keyDownHandler);
    if (this.keyUpHandler) window.removeEventListener('keyup', this.keyUpHandler);
    if (this.voiceRec) try { this.voiceRec.stop(); } catch { }
  }

  requestNotificationPermission(): void {
    if ('Notification' in window && Notification.permission !== 'granted') {
      Notification.requestPermission().catch(() => undefined);
    }
  }

  // --- Filter helpers ---
  clearFilters(): void {
    this.searchQuery.set('');
    this.filterPriority.set('All');
    this.filterEnergy.set('All');
    this.filterTag.set('All');
  }

  // --- Edit Task ---
  startEdit(task: Task): void {
    this.editingTaskId.set(task.id);
    this.editForm.patchValue({
      title: task.title,
      description: task.description,
      estimatedMinutes: task.estimatedMinutes,
      dueTime: task.dueTime ? this.toDatetimeLocal(task.dueTime) : '',
      energyLevel: task.energyLevel || 'Deep Work',
      tags: task.tags || [],
      recurring: task.recurring || 'none',
    });
  }

  cancelEdit(): void {
    this.editingTaskId.set(null);
  }

  saveEdit(taskId: number): void {
    if (this.editForm.invalid) {
      this.editForm.markAllAsTouched();
      return;
    }
    const v = this.editForm.value;
    this.todos.update((list) =>
      list.map((t) => {
        if (t.id !== taskId) return t;
        return {
          ...t,
          title: String(v.title).trim(),
          description: String(v.description).trim(),
          estimatedMinutes: Number(v.estimatedMinutes) || 30,
          dueTime: v.dueTime || undefined,
          energyLevel: v.energyLevel || 'Deep Work',
          priorityQuadrant: this.classifyPriority(String(v.description), v.dueTime),
          tags: Array.isArray(v.tags) ? v.tags : [],
          recurring: v.recurring || 'none',
        };
      })
    );
    this.logHistory('Edited', v.title);
    this.editingTaskId.set(null);
  }

  // helper: convert ISO string -> datetime-local input value
  private toDatetimeLocal(iso: string): string {
    try {
      const d = new Date(iso);
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    } catch {
      return '';
    }
  }

  // --- Tags on edit form ---
  toggleTagOnEdit(tag: string): void {
    const current: string[] = this.editForm.get('tags')?.value || [];
    const updated = current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag];
    this.editForm.patchValue({ tags: updated });
  }

  isTagSelectedOnEdit(tag: string): boolean {
    return (this.editForm.get('tags')?.value || []).includes(tag);
  }

  // --- Tags on add form ---
  toggleTagOnAdd(tag: string): void {
    const current: string[] = this.todoForm.get('tags')?.value || [];
    const updated = current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag];
    this.todoForm.patchValue({ tags: updated });
  }

  isTagSelectedOnAdd(tag: string): boolean {
    return (this.todoForm.get('tags')?.value || []).includes(tag);
  }

  // Add a custom tag to the global list and auto-select it
  addCustomTag(formType: 'add' | 'edit'): void {
    const raw = this.newTagInput().trim();
    if (!raw) return;
    const tag = raw.charAt(0).toUpperCase() + raw.slice(1);
    if (!this.availableTags.includes(tag)) {
      this.availableTags.push(tag);
    }
    if (formType === 'add') this.toggleTagOnAdd(tag);
    else this.toggleTagOnEdit(tag);
    this.newTagInput.set('');
  }

  addTodo(): void {
    if (this.todoForm.invalid) {
      this.todoForm.markAllAsTouched();
      return;
    }

    const formValue = this.todoForm.value;
    const estimatedMinutes = Number(formValue.estimatedMinutes ?? 30) || 30;
    const actualMinutes = this.inferActualMinutes(estimatedMinutes, formValue.description ?? '');

    const newTask: Task = {
      id: Date.now(),
      title: String(formValue.title).trim(),
      description: String(formValue.description).trim(),
      estimatedMinutes,
      actualMinutes,
      dueTime: formValue.dueTime || undefined,
      completed: false,
      priorityQuadrant: this.classifyPriority(String(formValue.description), formValue.dueTime),
      subtasks: [],
      notified: false,
      energyLevel: formValue.energyLevel || 'Deep Work',
      createdAt: Date.now(),
      ghosted: false,
      tags: Array.isArray(formValue.tags) ? formValue.tags : [],
      recurring: formValue.recurring || 'none',
    };

    const enrichedTask = this.applyBlueprintAndSubtasks(newTask);
    this.todos.update((tasks) => [enrichedTask, ...tasks]);
    this.logHistory('Created', enrichedTask.title);

    if (enrichedTask.dueTime) {
      try { this.scheduleNotification(enrichedTask.title, enrichedTask.dueTime); } catch { }
    }

    this.todoForm.reset({ estimatedMinutes: 30, actualMinutes: null, dueTime: '', energyLevel: 'Deep Work', tags: [], recurring: 'none' });
  }

  toggleLowEnergyMode(): void {
    this.lowEnergyMode.update((v) => !v);
  }

  toggleTask(id: number): void {
    this.todos.update((tasks) =>
      tasks.map((task) => {
        if (task.id !== id) return task;
        const nextCompleted = !task.completed;
        this.logHistory(nextCompleted ? 'Completed' : 'Reopened', task.title);

        // Handle recurring: if completing a recurring task, clone it for next occurrence
        if (nextCompleted && task.recurring && task.recurring !== 'none') {
          setTimeout(() => this.spawnRecurringTask(task), 100);
        }

        return { ...task, completed: nextCompleted };
      })
    );
  }

  private spawnRecurringTask(task: Task): void {
    const msPerDay = 86400000;
    const offset = task.recurring === 'daily' ? msPerDay : msPerDay * 7;
    const newDue = task.dueTime
      ? new Date(new Date(task.dueTime).getTime() + offset).toISOString()
      : new Date(Date.now() + offset).toISOString();

    const cloned: Task = {
      ...task,
      id: Date.now(),
      completed: false,
      notified: false,
      createdAt: Date.now(),
      ghosted: false,
      dueTime: newDue,
      subtasks: task.subtasks.map((s) => ({ ...s, completed: false })),
    };
    this.todos.update((list) => [cloned, ...list]);
    this.logHistory(`Recurring (${task.recurring})`, cloned.title);
  }

  deleteTask(id: number): void {
    const list = this.todos();
    const index = list.findIndex((t) => t.id === id);
    const target = list[index];
    if (!target) return;

    this.logHistory('Deleted', target.title);
    this.deletedTaskCache.set(id, { task: target, index });

    this.todos.update((tasks) => tasks.filter((task) => task.id !== id));

    // Undo toast
    const toastId = Date.now();
    this.toasts.update((prev) => [
      ...prev,
      { id: toastId, title: '🗑️ Task Deleted', message: `"${target.title}"`, undoTaskId: id },
    ]);

    // Auto-dismiss undo after 5s, then clear cache
    setTimeout(() => {
      this.dismissToast(toastId);
      this.deletedTaskCache.delete(id);
    }, 5000);
  }

  undoDelete(undoTaskId: number): void {
    const cached = this.deletedTaskCache.get(undoTaskId);
    if (!cached) return;
    const { task, index } = cached;
    this.todos.update((list) => {
      const newList = [...list];
      newList.splice(Math.min(index, newList.length), 0, task);
      return newList;
    });
    this.logHistory('Restored', task.title);
    this.deletedTaskCache.delete(undoTaskId);
    // dismiss related undo toasts
    this.toasts.update((prev) => prev.filter((t) => t.undoTaskId !== undoTaskId));
  }

  breakItDown(task: Task): void {
    const t = task.title.toLowerCase();
    const d = task.description.toLowerCase();
    let steps: string[] = [];

    if (task.blueprint?.sections.length) {
      steps = task.blueprint.sections.flatMap((section) =>
        section.details.map((detail) => `${section.name}: ${detail}`)
      );
    } else if (t.includes('app') || t.includes('web') || t.includes('code') || d.includes('dashboard')) {
      steps = [
        `Setup ${task.title} project structure & dependencies`,
        `Design state model & user flows for "${task.title}"`,
        `Build responsive dashboard UI & component layouts`,
        `Integrate local storage, signals & state persistence`,
        `Perform end-to-end testing and launch build`,
      ];
    } else if (t.includes('design') || t.includes('ui') || t.includes('landing')) {
      steps = [
        `Create low-fidelity wireframes and user journeys`,
        `Establish color palette, typography & glass UI tokens`,
        `Build interactive layout mockups`,
        `Gather feedback & refine component variants`,
        `Export asset specs and hand off to dev`,
      ];
    } else {
      steps = [
        `Define core objectives for: ${task.title}`,
        `Gather initial resources and baseline data`,
        `Execute primary phase execution checklist`,
        `Review progress against estimated target time`,
        `Finalize deliverables and log completion status`,
      ];
    }

    const subtasks: SubTask[] = steps.map((s, idx) => ({
      id: `${Date.now()}-${idx}`,
      title: s,
      completed: false,
    }));

    this.todos.update((tasks) =>
      tasks.map((item) => (item.id === task.id ? { ...item, subtasks } : item))
    );
    this.logHistory('AI Sub-divided', task.title);
  }

  // --- Inline subtask management ---
  addSubtask(taskId: number, title: string): void {
    if (!title.trim()) return;
    const newSub: SubTask = { id: `${Date.now()}-manual`, title: title.trim(), completed: false };
    this.todos.update((list) =>
      list.map((t) => (t.id === taskId ? { ...t, subtasks: [...t.subtasks, newSub] } : t))
    );
  }

  deleteSubtask(taskId: number, subtaskId: string): void {
    this.todos.update((list) =>
      list.map((t) =>
        t.id === taskId ? { ...t, subtasks: t.subtasks.filter((s) => s.id !== subtaskId) } : t
      )
    );
  }

  private applyBlueprintAndSubtasks(task: Task): Task {
    const blueprint = this.generateBlueprint(task);
    const subtasks = blueprint.sections.flatMap((section, idx) =>
      section.details.map((detail, detailIdx) => ({
        id: `${task.id}-${idx}-${detailIdx}`,
        title: `${section.name}: ${detail}`,
        completed: false,
      }))
    );

    return {
      ...task,
      blueprint,
      subtasks: subtasks.length ? subtasks : task.subtasks,
    };
  }

  private generateBlueprint(task: Task): TaskBlueprint {
    const combined = `${task.title} ${task.description}`.toLowerCase();
    const isWebsiteTask =
      /(website|web|landing|page|store|shop|checkout|order|phone|product|ecommerce|cart|buy|hero|ui|dashboard|form)/i.test(
        combined
      );

    if (isWebsiteTask) {
      const productName =
        task.title.replace(/^(build|create|make|design)\s+/i, '').trim() || 'your product';
      return {
        title: `UI blueprint for ${productName}`,
        goal: `Turn "${task.title}" into a conversion-focused experience with clear structure and momentum.`,
        sections: [
          {
            name: 'Hero',
            details: [
              `Introduce ${productName} with a strong headline and visual focus`,
              'Add a primary action that drives the next step',
            ],
          },
          {
            name: 'Benefits',
            details: [
              'Show the top reasons to choose this offer',
              'Support the message with compact proof points or media',
            ],
          },
          {
            name: 'Trust',
            details: [
              'Add social proof, guarantees, or delivery reassurance',
              'Make the experience feel safe and credible',
            ],
          },
          {
            name: 'Checkout',
            details: [
              'Create a streamlined order flow for contact and payment',
              'Surface progress, validation, and clear next steps',
            ],
          },
          {
            name: 'Support',
            details: [
              'Add FAQs, contact links, or a final encouragement block',
              'Keep the layout responsive and easy to scan on mobile',
            ],
          },
        ],
        preview: ['Hero', 'Benefits', 'Checkout', 'Support'],
      };
    }

    return {
      title: `Delivery plan for ${task.title}`,
      goal: `Break "${task.title}" into practical milestones and clear implementation steps.`,
      sections: [
        { name: 'Discovery', details: ['Confirm goals, constraints, and success criteria'] },
        { name: 'Build', details: ['Create the core experience and initial polish'] },
        { name: 'Review', details: ['Validate quality, responsiveness, and completion'] },
      ],
      preview: ['Discovery', 'Build', 'Review'],
    };
  }

  private checkDueNotifications(): void {
    const now = Date.now();
    let needsUpdate = false;

    const updated = this.todos().map((task) => {
      let t = { ...task };

      // Mark ghosted if >48h old and not already ghosted
      if (!t.ghosted && t.createdAt && now - t.createdAt > 48 * 3600 * 1000) {
        t = { ...t, ghosted: true };
        needsUpdate = true;
      }

      // Trigger due notification (only once per task)
      if (t.dueTime && !t.notified && !t.completed) {
        const due = new Date(t.dueTime).getTime();
        if (now >= due) {
          this.triggerAlert(t);
          t = { ...t, notified: true };
          needsUpdate = true;
        }
      }

      return t;
    });

    if (needsUpdate) {
      this.todos.set(updated);
    }
  }

  decomposeNow(taskId: number): void {
    const task = this.todos().find((t) => t.id === taskId);
    if (task) {
      this.breakItDown(task);
      this.todos.update((list) => list.map((t) => (t.id === taskId ? { ...t, ghosted: false } : t)));
    }
  }

  dropIt(taskId: number): void {
    const target = this.todos().find((t) => t.id === taskId);
    if (target) this.logHistory('Dropped', target.title);
    this.todos.update((list) => list.filter((t) => t.id !== taskId));
  }

  enterFocusMode(taskId: number, minutes?: number): void {
    const duration = Math.max(1, Math.round(minutes ?? 25));
    this.focusedTaskId.set(taskId);
    this.focusRemaining.set(duration * 60);
    this.startFocusTimer();
    this.startAmbientSound();
  }

  exitFocusMode(): void {
    this.focusedTaskId.set(null);
    this.focusRemaining.set(0);
    if (this.focusTimerInterval) clearInterval(this.focusTimerInterval);
    this.stopAmbientSound();
  }

  private startFocusTimer(): void {
    if (this.focusTimerInterval) clearInterval(this.focusTimerInterval);
    this.focusTimerInterval = setInterval(() => {
      const rem = this.focusRemaining();
      if (rem <= 1) {
        this.exitFocusMode();
        return;
      }
      this.focusRemaining.set(rem - 1);
    }, 1000);
  }

  private startAmbientSound(): void {
    try {
      const AudioContext = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      this.audioCtx = new AudioContext();

      const bufferSize = 2 * this.audioCtx.sampleRate;
      const noiseBuffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) output[i] = (Math.random() * 2 - 1) * 0.25;
      const whiteNoise = this.audioCtx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;
      whiteNoise.loop = true;

      const lp = this.audioCtx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 1200;

      const gain = this.audioCtx.createGain();
      gain.gain.value = 0.06;

      whiteNoise.connect(lp);
      lp.connect(gain);
      gain.connect(this.audioCtx.destination);
      whiteNoise.start();

      (this.audioCtx as any)._whiteNoise = whiteNoise;
      (this.audioCtx as any)._gainNode = gain;
    } catch (e) {
      console.debug('Ambient sound blocked until user interaction');
    }
  }

  private stopAmbientSound(): void {
    try {
      if (this.audioCtx) {
        const wn = (this.audioCtx as any)._whiteNoise;
        if (wn) try { wn.stop(); } catch { }
        this.audioCtx.close().catch(() => { });
        this.audioCtx = null;
      }
    } catch { }
  }

  formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = Math.max(0, seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  extendFocus(addMinutes: number): void {
    const add = Math.max(1, Math.round(addMinutes)) * 60;
    this.focusRemaining.update((r) => r + add);
  }

  private triggerAlert(task: Task): void {
    // Note: notified: true is set by the caller (checkDueNotifications) to avoid double updates
    this.playNotificationSound();

    const toastId = Date.now();
    this.toasts.update((prev) => [
      ...prev,
      { id: toastId, title: '⏰ Task Reminder Due!', message: `Time to execute: "${task.title}"` },
    ]);

    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(`⏰ Due Now: ${task.title}`, {
          body: task.description || 'Your scheduled task time has arrived!',
        });
      } catch { }
    }

    setTimeout(() => this.dismissToast(toastId), 8000);
  }

  playNotificationSound(): void {
    try {
      const AudioContext = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const audioCtx = new AudioContext();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.25);
      gain.gain.setValueAtTime(0.18, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);

      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.5);
    } catch { }
  }

  dismissToast(id: number): void {
    this.toasts.update((prev) => prev.filter((t) => t.id !== id));
  }

  toggleSubtask(taskId: number, subtaskId: string): void {
    this.todos.update((tasks) =>
      tasks.map((task) => {
        if (task.id !== taskId) return task;
        return {
          ...task,
          subtasks: task.subtasks.map((subtask) =>
            subtask.id === subtaskId ? { ...subtask, completed: !subtask.completed } : subtask
          ),
        };
      })
    );
  }

  subtaskProgress(task: Task): number {
    if (!task.subtasks.length) return 0;
    const completed = task.subtasks.filter((s) => s.completed).length;
    return Math.round((completed / task.subtasks.length) * 100);
  }

  private logHistory(action: string, taskTitle: string): void {
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    this.history.update((logs) => [{ id: Date.now(), action, taskTitle, timestamp }, ...logs]);
  }

  private classifyPriority(description: string, dueTime?: string): Task['priorityQuadrant'] {
    const normalized = description.toLowerCase();
    const hasDeadline = Boolean(dueTime);

    if (
      normalized.includes('urgent') ||
      normalized.includes('asap') ||
      normalized.includes('critical') ||
      normalized.includes('launch')
    )
      return 'Do First';
    if (
      normalized.includes('important') ||
      normalized.includes('plan') ||
      normalized.includes('strategy') ||
      hasDeadline
    )
      return 'Schedule';
    if (
      normalized.includes('delegate') ||
      normalized.includes('handoff') ||
      normalized.includes('review')
    )
      return 'Delegate';
    return 'Drop';
  }

  private inferActualMinutes(estimatedMinutes: number, description: string): number {
    const multiplier =
      description.toLowerCase().includes('urgent') || description.toLowerCase().includes('launch')
        ? 1.3
        : 1.1;
    return Math.max(1, Math.round(estimatedMinutes * multiplier));
  }

  private calculateAccuracy(task: Task): number {
    const estimate = Math.max(1, task.estimatedMinutes || 1);
    const actual = Math.max(1, task.actualMinutes ?? estimate);
    return Math.max(0, 100 - (Math.abs(actual - estimate) / estimate) * 100);
  }

  private scheduleNotification(title: string, dueTimeStr: string): void {
    const delay = new Date(dueTimeStr).getTime() - Date.now();
    if (delay > 0) {
      window.setTimeout(() => {
        try {
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('Task Reminder ⏰', { body: `Time to start: "${title}"` });
          }
        } catch { }
      }, Math.max(0, delay));
    }
  }

  // --- Dev Context Generator ---
  generateDevContext(taskId: number): void {
    const task = this.todos().find((t) => t.id === taskId);
    if (!task) return;

    let cmd = 'echo "No suggestions available"';
    let snippet = '// No snippet available for this task';
    const t = (task.title || '').toLowerCase();
    const d = (task.description || '').toLowerCase();

    if (t.includes('supabase') || d.includes('supabase')) {
      cmd = 'npm install @supabase/supabase-js dotenv';
      snippet = `import { createClient } from '@supabase/supabase-js';\nconst supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);\nexport default supabase;`;
    } else if (t.includes('neon') || d.includes('neon') || t.includes('postgres')) {
      cmd = 'npm install @neondatabase/serverless dotenv';
      snippet = `const { Client } = require('@neondatabase/serverless');\nconst client = new Client({ connectionString: process.env.DATABASE_URL });\nawait client.connect();`;
    } else if (t.includes('react') || d.includes('react') || t.includes('hero')) {
      cmd = 'npx create-react-app my-app && cd my-app';
      snippet = `<section class="hero">\n  <h1>Hero for ${task.title}</h1>\n</section>`;
    } else if (t.includes('auth') || d.includes('auth')) {
      cmd = 'npm install @supabase/supabase-js';
      snippet = `const { data, error } = await supabase.auth.signInWithPassword({ email, password });`;
    } else {
      cmd = 'npm init -y';
      snippet = `// Starter snippet for: ${task.title}\nconsole.log('Hello from task starter code');`;
    }

    this.todos.update((list) =>
      list.map((t) =>
        t.id === taskId ? { ...t, devContext: { cmd, snippet, open: true } } : t
      )
    );
  }

  toggleDevContext(taskId: number): void {
    this.todos.update((list) =>
      list.map((t) =>
        t.id === taskId
          ? { ...t, devContext: { ...(t.devContext || { cmd: '', snippet: '' }), open: !t.devContext?.open } }
          : t
      )
    );
  }

  copyToClipboard(text: string): void {
    try { navigator.clipboard.writeText(text); } catch { }
  }

  // --- Voice capture ---
  startVoiceCapture(): void {
    try {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) return;
      this.listening.set(true);
      this.voiceRec = new SpeechRecognition();
      this.voiceRec.lang = 'en-US';
      this.voiceRec.interimResults = false;
      this.voiceRec.maxAlternatives = 1;
      this.voiceRec.onresult = (ev: any) => {
        const text = ev.results[0][0].transcript;
        this.handleSpeechResult(String(text || ''));
      };
      this.voiceRec.onend = () => { this.listening.set(false); };
      this.voiceRec.onerror = () => { this.listening.set(false); };
      this.voiceRec.start();
    } catch (e) {
      this.listening.set(false);
    }
  }

  stopVoiceCapture(): void {
    try { if (this.voiceRec) this.voiceRec.stop(); } catch { }
    this.listening.set(false);
  }

  private handleSpeechResult(text: string): void {
    const minsMatch = text.match(/(\d+)\s*(min|mins|minutes)/i);
    const minutes = minsMatch ? Math.max(1, Number(minsMatch[1])) : 30;

    let energy: Task['energyLevel'] = 'Deep Work';
    if (/quick|now|fast|short/i.test(text)) energy = 'Quick Wins';
    else if (/creative|design|brainstorm/i.test(text)) energy = 'Creative Flow';

    const cleaned = text.replace(/^(hey\s*,?\s*)?remind me to\s*/i, '').trim();
    const title = cleaned.split(/ in \d+\s*(min|mins|minutes)/i)[0].trim();
    const due = new Date(Date.now() + minutes * 60 * 1000).toISOString();

    const newTask: Task = {
      id: Date.now(),
      title: title || text.slice(0, 80),
      description: text,
      estimatedMinutes: minutes,
      dueTime: due,
      completed: false,
      priorityQuadrant: this.classifyPriority(text, due),
      subtasks: [],
      notified: false,
      energyLevel: energy,
      createdAt: Date.now(),
      ghosted: false,
      tags: [],
      recurring: 'none',
    };

    const enrichedTask = this.applyBlueprintAndSubtasks(newTask);
    this.todos.update((list) => [enrichedTask, ...list]);
    this.logHistory('Voice Added', enrichedTask.title);
    setTimeout(() => this.breakItDown(enrichedTask), 300);
    try { this.scheduleNotification(enrichedTask.title, enrichedTask.dueTime!); } catch { }
  }

  // --- Brain Dump ---
  parseBrainDumpAndCreate(): void {
    const raw = String(this.brainDumpText() || '').trim();
    if (!raw) return;

    const minsMatch = raw.match(/(\d+)\s*(min|mins|minutes)/i);
    const minutes = minsMatch ? Math.max(1, Number(minsMatch[1])) : 30;

    let energy: Task['energyLevel'] = 'Deep Work';
    if (/quick|now|fast|tiny|small/i.test(raw)) energy = 'Quick Wins';
    else if (/creative|design|brainstorm/i.test(raw)) energy = 'Creative Flow';

    const titleCandidate = raw.split(/ in \d+\s*(min|mins|minutes)/i)[0];
    const title =
      titleCandidate.split(/[,\-–:]/)[0].split(' ').slice(0, 8).join(' ').trim() ||
      raw.slice(0, 30);

    const newTask: Task = {
      id: Date.now(),
      title: title.charAt(0).toUpperCase() + title.slice(1),
      description: raw,
      estimatedMinutes: minutes,
      dueTime: undefined,
      completed: false,
      priorityQuadrant: this.classifyPriority(raw, undefined),
      subtasks: [],
      notified: false,
      energyLevel: energy,
      createdAt: Date.now(),
      ghosted: false,
      tags: [],
      recurring: 'none',
    };

    const enrichedTask = this.applyBlueprintAndSubtasks(newTask);
    this.todos.update((list) => [enrichedTask, ...list]);
    this.logHistory('BrainDump Added', enrichedTask.title);
    this.brainDumpText.set('');
  }

  // --- Code Scanner ---
  parseCodeSnippetAndCreate(raw: string): void {
    const text = String(raw || this.codeSnippetText()).trim();
    if (!text) return;

    const typeMatch = text.match(/(TypeError|ReferenceError|Error|SyntaxError)/i);
    const mapMatch = text.match(/\.map\(/);
    const fileMatch = text.match(/at\s+([\w\.\/\-\\]+):(\d+):?(\d+)?/i);

    let title = '';
    const subtasks: string[] = [];
    let snippet = '';

    if (mapMatch) {
      title = 'Fix undefined map error in component';
      subtasks.push('Check null/undefined guards before .map() call');
      subtasks.push('Verify API response payload structure');
      snippet = 'const result = userList?.map(item => /* ... */);';
    }

    if (typeMatch && fileMatch) {
      title = `${typeMatch[1]} in ${fileMatch[1].split('/').pop()}`;
      if (!subtasks.length) subtasks.push('Inspect stack trace and source file at indicated line');
      if (!snippet) snippet = '// Consider optional chaining or null guards\nobj?.prop';
    }

    if (!title) title = text.split('\n')[0].slice(0, 80);

    const newTask: Task = {
      id: Date.now(),
      title,
      description: text,
      estimatedMinutes: 30,
      dueTime: undefined,
      completed: false,
      priorityQuadrant: this.classifyPriority(text, undefined),
      subtasks: subtasks.map((s, i) => ({
        id: `${Date.now()}-c-${i}`,
        title: s,
        completed: false,
      })),
      notified: false,
      energyLevel: 'Deep Work',
      createdAt: Date.now(),
      ghosted: false,
      tags: [],
      recurring: 'none',
      devContext: { cmd: '', snippet },
    };

    const enrichedTask = this.applyBlueprintAndSubtasks(newTask);
    this.todos.update((list) => [enrichedTask, ...list]);
    this.logHistory('CodeScan Added', enrichedTask.title);
    this.codeSnippetText.set('');
  }

  // --- Calendar exports ---
  exportToIcs(taskId: number): void {
    const task = this.todos().find((t) => t.id === taskId);
    if (!task) return;
    const start = task.dueTime ? new Date(task.dueTime) : new Date();
    const end = new Date(start.getTime() + 30 * 60000);
    const formatDate = (d: Date) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'BEGIN:VEVENT',
      `UID:${task.id}@smart-todo-app`,
      `DTSTAMP:${formatDate(new Date())}`,
      `DTSTART:${formatDate(start)}`,
      `DTEND:${formatDate(end)}`,
      `SUMMARY:${this.simpleEscape(task.title)}`,
      `DESCRIPTION:${this.simpleEscape(task.description || '')}`,
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\n');

    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(task.title || 'task').replace(/\s+/g, '_')}.ics`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  exportToGoogleCalendar(taskId: number): void {
    const task = this.todos().find((t) => t.id === taskId);
    if (!task) return;
    const start = task.dueTime ? new Date(task.dueTime) : new Date();
    const end = new Date(start.getTime() + 30 * 60000);
    const formatForGoogle = (d: Date) =>
      d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: task.title || 'Task',
      dates: `${formatForGoogle(start)}/${formatForGoogle(end)}`,
      details: task.description || '',
    });
    window.open(`https://calendar.google.com/calendar/render?${params.toString()}`, '_blank');
  }

  private simpleEscape(input: string): string {
    return String(input || '')
      .replace(/\n/g, '\\n')
      .replace(/,/g, '\\,')
      .replace(/;/g, '\\;');
  }

  // --- Warning chime ---
  playWarningChime(): void {
    try {
      const AudioContext = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ac = new AudioContext();
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.type = 'sine';
      o.frequency.value = 880;
      g.gain.value = 0.08;
      o.connect(g);
      g.connect(ac.destination);
      o.start();
      o.stop(ac.currentTime + 0.18);
      setTimeout(() => ac.close().catch(() => { }), 400);
    } catch { }
  }

  // --- Velocity meter ---
  velocityMeter(task: Task | undefined): number {
    if (!task) return 0;
    const subProgress = this.subtaskProgress(task) / 100;
    const now = Date.now();
    const due = task.dueTime
      ? new Date(task.dueTime).getTime()
      : now + task.estimatedMinutes * 60000;
    const totalWindow = Math.max(1, due - (task.createdAt || now));
    const timeLeftRatio = Math.max(0, Math.min(1, (due - now) / totalWindow));
    const score = Math.round((0.6 * subProgress + 0.4 * (1 - timeLeftRatio)) * 100);
    return Math.max(0, Math.min(100, score));
  }

  // --- Theme ---
  toggleTheme(): void {
    const next = this.theme() === 'dark' ? 'light' : 'dark';
    this.theme.set(next);
    try { localStorage.setItem('cwh_theme', next); } catch { }
    this.applyThemeClass();
  }

  private applyThemeClass(): void {
    try {
      const root = document.documentElement;
      if (this.theme() === 'dark') root.classList.add('dark-theme');
      else root.classList.remove('dark-theme');
    } catch { }
  }

  // --- New subtask input state per task ---
  readonly newSubtaskInputs = signal<Record<number, string>>({});

  getNewSubtaskInput(taskId: number): string {
    return this.newSubtaskInputs()[taskId] || '';
  }

  setNewSubtaskInput(taskId: number, value: string): void {
    this.newSubtaskInputs.update((m) => ({ ...m, [taskId]: value }));
  }

  submitNewSubtask(taskId: number): void {
    const val = this.getNewSubtaskInput(taskId);
    this.addSubtask(taskId, val);
    this.setNewSubtaskInput(taskId, '');
  }
}
