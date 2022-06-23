export type UndoRedoAction = {
  redo: () => void | Promise<void>;
  undo: () => void | Promise<void>;
};

export type AddExecuteUndoOption = {
  execute: () => void | Promise<void>;
  undo: () => void | Promise<void>;
};

export type AddOptionType = AddExecuteUndoOption | UndoRedoAction;

interface UndoManagerOption {
  maxSize?: number;
  onChange?: (() => void) | undefined;
}

export class UndoManager {
  private _undoRedoActionStack: Array<UndoRedoAction> = [];
  private readonly _maxSize: number;
  private _index: number = -1;
  private _canUndo: boolean = false;
  private _canRedo: boolean = false;
  private _onChange: (() => void) | undefined = undefined;

  constructor(options: UndoManagerOption = {}) {
    const { maxSize = 10_000, onChange } = options;
    this._maxSize = maxSize;
    this._onChange = onChange;
  }

  private _updateIndex(idx: number) {
    this._index = idx;
    const cu = this._index >= 0;
    if (cu !== this._canUndo) {
      this._canUndo = cu;
      this._onChange?.();
    }
    const cr = this._index < this._undoRedoActionStack.length - 1;
    if (cr !== this._canRedo) {
      this._canRedo = cr;
      this._onChange?.();
    }
  }

  get canUndo() {
    return this._canUndo;
  }

  get canRedo() {
    return this._canRedo;
  }

  add(option: AddOptionType) {
    this._undoRedoActionStack.splice(this._index + 1);
    const { undo } = option;
    const { execute } = option as Partial<AddExecuteUndoOption>;
    const { redo = execute } = option as Partial<UndoRedoAction>;

    if (redo) {
      this._undoRedoActionStack.push({
        undo,
        redo,
      });
    }
    this._updateIndex(this._index + 1);
    if (this._index >= this._maxSize) {
      this._undoRedoActionStack.shift();
      this._updateIndex(this._index - 1);
    }
    if (execute) {
      execute();
    }
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
