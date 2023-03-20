import type { ReadTransaction, WriteTransaction } from "@rocicorp/reflect";
import { z } from "zod";
import { nanoid } from "nanoid";
import { randInt } from "src/util/rand";

export const shapePrefix = `shape-`;

export const shapeKey = (id: string) => `${shapePrefix}${id}`;

export const shapeID = (key: string) => {
  if (!key.startsWith(shapePrefix)) {
    throw new Error(`Invalid key: ${key}`);
  }
  return key.substring(shapePrefix.length);
};

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

export type Shape = Readonly<z.TypeOf<typeof shapeSchema>>;

export async function getShapes(tx: ReadTransaction): Promise<Shape[]> {
  const shapes = await tx.scan({ prefix: shapePrefix }).entries().toArray();
  return shapes.map(([_, val]) => {
    shapeSchema.parse(val);
    return val as Shape;
  });
}

export async function getShape(
  tx: ReadTransaction,
  id: string
): Promise<Shape | undefined> {
  const val = await tx.get(shapeKey(id));
  if (val === undefined) {
    console.log(`Specified shape ${id} not found.`);
    return undefined;
  }
  shapeSchema.parse(val);
  return val as Shape;
}

export async function putShape(
  tx: WriteTransaction,
  shape: Shape
): Promise<void> {
  await tx.put(shapeKey(shape.id), shape);
}

export async function deleteShape(
  tx: WriteTransaction,
  id: string
): Promise<void> {
  await tx.del(shapeKey(id));
}

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
  let newX = shape.x + dx;
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

export async function rotateShape(
  tx: WriteTransaction,
  { id, ddeg }: { id: string; ddeg: number }
): Promise<void> {
  const shape = await getShape(tx, id);
  if (shape) {
    await putShape(tx, { ...shape, rotate: shape.rotate + ddeg });
  }
}

export async function initShapes(tx: WriteTransaction, shapes: Shape[]) {
  if (await tx.has("initialized")) {
    return;
  }
  await Promise.all([
    tx.put("initialized", true),
    ...shapes.map((s) => putShape(tx, s)),
  ]);
}

const colors = ["red", "blue", "white", "green", "yellow"];
let nextColor = 0;

export function randomShape(): Shape {
  const s = randInt(100, 400);
  const fill = colors[nextColor++];
  if (nextColor === colors.length) {
    nextColor = 0;
  }
  return {
    id: nanoid(),
    type: "rect",
    x: randInt(0, 400),
    y: randInt(0, 400),
    width: s,
    height: s,
    rotate: randInt(0, 359),
    fill,
  };
}
