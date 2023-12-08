import type { Reflect } from "@rocicorp/reflect/client";
import { Rect } from "./rect";
import type { M } from "../datamodel/mutators";
import { useShapeByID } from "../datamodel/subscriptions";
import type { Mutators as YJSMutators } from "@rocicorp/reflect-yjs";

export function Selection({
  r,
  id,
}: {
  r: Reflect<M & YJSMutators>;
  id: string;
  containerOffsetTop: number | null;
}) {
  const shape = useShapeByID(r, id);

  if (!shape) {
    return null;
  }

  const { x, y, width, height, rotate } = shape;

  return (
    <div>
      <Rect
        {...{
          r,
          id,
          highlight: true,
        }}
      />
      <div
        style={{
          position: "absolute",
          transform: `translate3d(${x}px, ${y}px, 0) rotate(${rotate}deg)`,
          width,
          height,
          pointerEvents: "none",
        }}
      ></div>
    </div>
  );
}
