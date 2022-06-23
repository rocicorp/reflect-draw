import type { Reflect } from "@rocicorp/reflect";
import { DraggableCore, DraggableEvent, DraggableData } from "react-draggable";
import { Rect } from "./rect";
import { useShapeByID } from "../datamodel/subscriptions";
import type { M } from "../datamodel/mutators";
import type { UndoManager } from "./undo-manager";
import { useState } from "react";
import type { Shape } from "../datamodel/shape";

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
  const [startShape, setStartShape] = useState<Shape | null>();
  const shape = useShapeByID(reflect, id);

  const onMouseEnter = async () => {
    return reflect.mutate.overShape({
      clientID: await reflect.clientID,
      shapeID: id,
    });
  };
  const onMouseLeave = async () => {
    return reflect.mutate.overShape({
      clientID: await reflect.clientID,
      shapeID: "",
    });
  };

  const onDragStart = (_e: DraggableEvent, _d: DraggableData) => {
    // Can't mark onDragStart async because it changes return type and onDragStart
    // must return void.
    setStartShape(shape);
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
    if (startShape && shape) {
      undoManager.add({
        redo: async () => {
          return await reflect.mutate.moveShape({
            id,
            dx: shape.x - startShape.x,
            dy: shape.y - startShape.y,
          });
        },
        undo: async () => {
          return await reflect.mutate.moveShape({
            id,
            dx: startShape.x - shape.x,
            dy: startShape.y - shape.y,
          });
        },
      });
    }
  };
  if (!shape) {
    return null;
  }

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
