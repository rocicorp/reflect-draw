import type { WriteTransaction } from "@rocicorp/reflect";
import {
  initClientState,
  overShape,
  selectShape,
  setCursor,
} from "./client-state";
import {
  setShape,
  deleteShape,
  initShapes,
  moveShape,
  resizeShape,
  rotateShape,
  scanShape,
} from "./shape";

export type M = typeof serverMutators;

export const serverMutators = {
  createShape: setShape,
  deleteShape,
  moveShape,
  scanShape,
  resizeShape,
  rotateShape,
  initClientState,
  setCursor,
  overShape,
  selectShape,
  initShapes,
  nop: async (_: WriteTransaction) => {},
};

export const clientMutators: M = {
  ...serverMutators,
  initShapes: async () => {},
};
