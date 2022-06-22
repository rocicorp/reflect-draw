export type UndoRedoAction = {
  redo: Function;
  undo: Function;
};

type AddExecuteUndoOption = {
  execute: Function;
  undo: Function;
};

type AddOptionType = AddExecuteUndoOption | UndoRedoAction;

interface UndoManagerOption {
  maxSize?: number;
  onCanUndoChange?: ((canUndo: boolean) => void) | undefined;
  onCanRedoChange?: ((canRedo: boolean) => void) | undefined;
}

export class UndoManager {
  private _undoRedoActionStack: Array<UndoRedoAction> = [];
  private readonly _maxSize: number;
  private _index: number = -1;
  private _canUndo: boolean = false;
  private _canRedo: boolean = false;
  private _onCanUndoChange: ((canUndo: boolean) => void) | undefined =
    undefined;
  private _onCanRedoChange: ((canRedo: boolean) => void) | undefined =
    undefined;

  constructor(options?: UndoManagerOption) {
    this._maxSize = 10000;
    if (options) {
      this._maxSize = options.maxSize || 10000;
      this._onCanUndoChange = options.onCanUndoChange;
      this._onCanRedoChange = options.onCanRedoChange;
    }
  }

  private _updateIndex(idx: number) {
    this._index = idx;
    const cu = this._index >= 0;
    if (cu != this._canUndo) {
      this._canUndo = cu;
      this._onCanUndoChange?.(this._canUndo);
    }
    const cr = this._index < this._undoRedoActionStack.length - 1;
    if (cr != this._canRedo) {
      this._canRedo = cr;
      this._onCanRedoChange?.(this._canRedo);
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
    let redo = undefined;
    if ("execute" in option) {
      redo = option.execute;
    }
    if ("redo" in option) {
      redo = option.redo;
    }
    if (!redo) {
      throw new Error("redo function is required");
    }
    this._undoRedoActionStack.push({
      undo: option.undo,
      redo: redo,
    });
    this._updateIndex(this._index + 1);
    if (this._index >= this._maxSize) {
      this._undoRedoActionStack.shift();
      this._updateIndex(this._index - 1);
    }
    if ("execute" in option) {
      option.execute();
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
