export type Task = () => Promise<void>;

/**
 * A simple async event loop. Very much like the browser event loop, except
 * that the tasks are asynchronous. Tasks run by this loop will be serialized
 * with respect to each other. Thus they can safely read and write shared
 * state.
 */
export class AsyncLoop {
  private _pending: Task[] = [];
  private _running = false;

  addTask(task: Task) {
    this._pending.push(task);
    if (!this._running) {
      this._running = true;
      this._next();
    }
  }

  private async _next(): Promise<void> {
    const task = this._pending.shift();
    if (!task) {
      this._running = false;
      return;
    }
    try {
      await task();
    } catch (e) {
      console.error(`Error executing task: ${task}: ${e}`);
    }
    this._next();
  }
}
