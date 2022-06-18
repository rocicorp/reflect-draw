export declare type fEmptyVoid = () => void;
export declare type fEmptyReturn = () => unknown;
export declare type fArgVoid = (...args: unknown[]) => void;
export declare type fArgReturn = (...args: unknown[]) => unknown;
export declare type fFunction =
  | fEmptyVoid
  | fEmptyReturn
  | fArgVoid
  | fArgReturn;

export interface UndoManagerOptions {
  name: string;
  maxSize?: number;
}

export type UndoRedoAction = {
  execute: fFunction;
  undo: fFunction;
  merge?: (action: UndoRedoAction) => number;
  canMerge?: boolean;
};

export class UndoManager {
  undoRedoActionStack: Array<UndoRedoAction>;
  maxSize: number;
  private _indexPosition: number;

  set index(idx: number) {
    this._indexPosition = idx;
    this._canUndo = this._indexPosition >= 0;
    this._canRedo = this._indexPosition < this.undoRedoActionStack.length - 1;
  }

  get index(): number {
    return this._indexPosition;
  }

  private _canUndo: boolean;
  private _canRedo: boolean;

  constructor(options: UndoManagerOptions) {
    const { maxSize = 10000 } = options;
    this.undoRedoActionStack = [];
    this.maxSize = maxSize;
    this._indexPosition = -1;
    this._canUndo = false;
    this._canRedo = false;
  }

  add(action: UndoRedoAction) {
    this.undoRedoActionStack.splice(this._indexPosition + 1);
    this.undoRedoActionStack.push(action);
    this.index++;
    if (this.index >= this.maxSize) {
      this.undoRedoActionStack.shift();
      this.index--;
    }
    action.execute();
  }

  undo() {
    if (!this._canUndo) return;
    const action = this.undoRedoActionStack[this.index];
    this.index--;
    return action.undo();
  }

  redo() {
    if (!this._canRedo) return;
    const action = this.undoRedoActionStack[this._indexPosition + 1];
    this.index++;
    return action.execute();
  }

  printStack() {
    console.log(this.undoRedoActionStack);
  }
}
