import type { WriteTransaction } from "@rocicorp/reflect";
import { nanoid } from "nanoid";
import { z } from "zod";
import { randInt } from "../util/rand";
import { generate } from "@rocicorp/rails";
import { getParse } from "./zod";

export const shapeSchema = z.object({
  id: z.string(),
  type: z.literal("rect"),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  rotate: z.number(),
  fill: z.string(),
});

export type Shape = z.infer<typeof shapeSchema>;

export const {
  get: getShape,
  list: listShapes,
  listIDs: listShapeIDs,
  put: putShape,
  delete: deleteShape,
} = generate("shape", getParse(shapeSchema));

export async function moveShape(
  tx: WriteTransaction,
  { id, dx, dy }: { id: string; dx: number; dy: number }
): Promise<void> {
  const shape = await getShape(tx, id);
  if (shape) {
    await putShape(tx, {
      ...shape,
      x: shape.x + dx,
      y: shape.y + dy,
    });
  }
}

export async function scanShape(
  tx: WriteTransaction,
  { id, dx, maxX }: { id: string; dx: number; maxX: number }
): Promise<void> {
  const shape = await getShape(tx, id);
  if (!shape) {
    return;
  }
  let newX = (shape.x += dx);
  if (newX > maxX) {
    newX = 0;
  }
  putShape(tx, {
    ...shape,
    x: newX,
  });
}

export async function resizeShape(
  tx: WriteTransaction,
  { id, ds }: { id: string; ds: number }
): Promise<void> {
  const shape = await getShape(tx, id);
  if (shape) {
    const minSize = 10;
    const dw = Math.max(minSize - shape.width, ds);
    const dh = Math.max(minSize - shape.height, ds);
    await putShape(tx, {
      ...shape,
      width: shape.width + dw,
      height: shape.height + dh,
      x: shape.x - dw / 2,
      y: shape.y - dh / 2,
    });
  }
}


export async function initShapes(tx: WriteTransaction) {
  if (await tx.has("initialized")) {
    return;
  }
  const shapes = Array.from({ length: 1 }, () => randomShape());
  await Promise.all([
    tx.put("initialized", true),
    ...shapes.map((s) => putShape(tx, s)),
  ]);
}


export function randomShape() {

  return {
    id: nanoid(),
    type: "rect",
    x: randInt(0, 400),
    y: randInt(0, 400),
    width: 300,
    height: 300,
    rotate: 90,
    fill: "yellow",
  } as Shape;
}
