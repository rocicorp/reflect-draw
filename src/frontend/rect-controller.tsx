import type { Reflect } from "@rocicorp/reflect";
import { DraggableCore, DraggableEvent, DraggableData } from "react-draggable";
import { Rect } from "./rect";
import { useShapeByID } from "../datamodel/subscriptions";
import type { M } from "../datamodel/mutators";
import { useRef } from "react";
import type { Shape } from "../datamodel/shape";
import type { UndoManager } from "@rocicorp/undo";
import React from "react";

// TODO: In the future I imagine this becoming ShapeController and
// there also be a Shape that wraps Rect and also knows how to draw Circle, etc.
export function RectController({
  reflect,
  id,
  undoManager,
}: {
  reflect: Reflect<M>;
  id: string;
  undoManager: UndoManager;
}) {
  const shape = useShapeByID(reflect, id);
  const startShape = useRef<Shape | null>();

  const onMouseEnter = async () =>
    reflect.mutate.overShape({
      clientID: await reflect.clientID,
      shapeID: id,
    });
  const onMouseLeave = async () =>
    reflect.mutate.overShape({
      clientID: await reflect.clientID,
      shapeID: "",
    });

  const onDragStart = (_e: DraggableEvent, _d: DraggableData) => {
    // Can't mark onDragStart async because it changes return type and onDragStart
    // must return void.
    startShape.current = shape;
    const blech = async () => {
      reflect.mutate.selectShape({
        clientID: await reflect.clientID,
        shapeID: id,
      });
    };
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

  const onDragStop = (_e: DraggableEvent, _d: DraggableData) => {
    if (shape && startShape.current) {
      if (
        shape.x - startShape.current.x !== 0 &&
        shape.y - startShape.current.y !== 0
      ) {
        undoManager.add({
          undo: () => {
            if (!startShape.current) {
              return;
            }
            return reflect.mutate.moveShape({
              id,
              dx: startShape.current.x - shape.x,
              dy: startShape.current.y - shape.y,
            });
          },
          redo: () => {
            if (!startShape.current) {
              return;
            }
            return reflect.mutate.moveShape({
              id,
              dx: shape.x - startShape.current.x,
              dy: shape.y - startShape.current.y,
            });
          },
        });
      }
    }
  };

  return (
    <DraggableCore onStart={onDragStart} onDrag={onDrag} onStop={onDragStop}>
      <div>
        <Rect
          {...{
            reflect,
            id,
            highlight: false,
            onMouseEnter,
            onMouseLeave,
          }}
        />
      </div>
    </DraggableCore>
  );
}
