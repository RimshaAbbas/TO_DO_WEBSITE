import { TestBed } from '@angular/core/testing';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render the dashboard heading', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Your Todos, Reimagined.');
  });

  it('should auto-create a blueprint for website tasks', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;

    app.todoForm.patchValue({
      title: 'Build a storefront',
      description: 'Make a website to order a phone',
      estimatedMinutes: 45,
      energyLevel: 'Creative Flow',
    });

    app.addTodo();

    const task = app.todos()[0];
    expect(task.blueprint?.sections.length).toBeGreaterThan(0);
    expect(task.subtasks.length).toBeGreaterThan(0);
  });
});
