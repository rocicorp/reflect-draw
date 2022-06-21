export type UndoRedoAction = {
  redo: Function;
  undo: Function;
};

export class UndoManager {
  private _undoRedoActionStack: Array<UndoRedoAction> = [];
  private readonly _maxSize: number;
  private _index: number = -1;
  private _canUndo: boolean = false;
  private _canRedo: boolean = false;

  constructor(maxSize?: number) {
    this._maxSize = maxSize || 10000;
  }

  private _updateIndex(idx: number) {
    this._index = idx;
    this._canUndo = this._index >= 0;
    this._canRedo = this._index < this._undoRedoActionStack.length - 1;
  }

  get canUndo() {
    return this._canUndo;
  }

  get canRedo() {
    return this._canRedo;
  }

  private _add(action: UndoRedoAction) {
    this._undoRedoActionStack.splice(this._index + 1);
    this._undoRedoActionStack.push(action);
    this._updateIndex(this._index + 1);
    if (this._index >= this._maxSize) {
      this._undoRedoActionStack.shift();
      this._updateIndex(this._index - 1);
    }
  }

  addAndExecute(action: UndoRedoAction) {
    this._add(action);
    action.redo();
  }

  add(action: UndoRedoAction) {
    this._add(action);
  }

  undo() {
    if (!this._canUndo) {
      return;
    }
    const action = this._undoRedoActionStack[this._index];
    this._updateIndex(this._index - 1);
    return action.undo();
  }

  redo() {
    if (!this._canRedo) {
      return;
    }
    const action = this._undoRedoActionStack[this._index + 1];
    this._updateIndex(this._index + 1);
    return action.redo();
  }
}
