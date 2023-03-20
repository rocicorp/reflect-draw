import type { Reflect } from "@rocicorp/reflect";
import { DraggableCore, DraggableEvent, DraggableData } from "react-draggable";
import { Rect } from "./rect";
import type { M } from "../datamodel/mutators";
import React from "react";
import type { Shape } from "src/datamodel/shape";

// TODO: In the future I imagine this becoming ShapeController and
// there also be a Shape that wraps Rect and also knows how to draw Circle, etc.
function RectControllerInternal({
  reflect,
  shape,
}: {
  reflect: Reflect<M>;
  shape: Shape;
}) {
  const { id } = shape;

  const onMouseEnter = async () => await reflect.mutate.overShape(id);
  const onMouseLeave = async () => await reflect.mutate.overShape("");

  const onDragStart = (_e: DraggableEvent, _d: DraggableData) => {
    // Can't mark onDragStart async because it changes return type and onDragStart
    // must return void.
    const blech = async () => await reflect.mutate.selectShape(id);

    blech();
  };
  const onDrag = (_e: DraggableEvent, d: DraggableData) => {
    // This is subtle, and worth drawing attention to:
    // In order to properly resolve conflicts, what we want to capture in
    // mutation arguments is the *intent* of the mutation, not the effect.
    // In this case, the intent is the amount the mouse was moved by, locally.
    // We will apply this movement to whatever the state happens to be when we
    // replay. If somebody else was moving the object at the same moment, we'll
    // then end up with a union of the two vectors, which is what we want!
    reflect.mutate.moveShape({
      id,
      dx: d.deltaX,
      dy: d.deltaY,
    });
  };

  if (!shape) {
    return null;
  }

  return (
    <DraggableCore onStart={onDragStart} onDrag={onDrag}>
      <div>
        <Rect
          {...{
            shape,
            highlight: false,
            onMouseEnter,
            onMouseLeave,
          }}
        />
      </div>
    </DraggableCore>
  );
}

export const RectController = React.memo(RectControllerInternal);
