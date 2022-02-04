import type { WriteTransaction } from "replicache";
import {
  initClientState,
  setCursor,
  overShape,
  selectShape,
} from "./client-state.js";
import {
  putShape,
  deleteShape,
  moveShape,
  resizeShape,
  rotateShape,
  initShapes,
} from "./shape.js";

export type M = typeof mutators;

export const mutators = {
  createShape: putShape,
  deleteShape,
  moveShape,
  resizeShape,
  rotateShape,
  initClientState,
  setCursor,
  overShape,
  selectShape,
  initShapes,
  nop: async (_: WriteTransaction) => {},
};
