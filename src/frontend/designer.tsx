import type { Reflect } from "@rocicorp/reflect";
import type { OptionalLogger } from "@rocicorp/logger";
import React, { useRef, useState } from "react";
import { HotKeys } from "react-hotkeys";
import { DraggableCore } from "react-draggable";
import { Rect } from "./rect";
import { Collaborator } from "./collaborator";
import { RectController } from "./rect-controller";
import { touchToMouse } from "./events";
import { Selection } from "./selection";
import {
  useShapes,
  useCollaboratorIDs,
  useOverShape,
  useSelectedShape,
} from "../datamodel/subscriptions";
import type { M } from "../datamodel/mutators";

export function Designer({
  reflect,
  logger,
}: {
  reflect: Reflect<M>;
  logger: OptionalLogger;
}) {
  const shapes = useShapes(reflect);
  const shapeMap = new Map(shapes.map((s) => [s.id, s]));
  const overShape = useOverShape(reflect);
  const selectedShape = useSelectedShape(reflect);
  const collaboratorIDs = useCollaboratorIDs(reflect);

  const ref = useRef<HTMLDivElement | null>(null);
  const [dragging, setDragging] = useState(false);

  const move = async (dx = 0, dy = 0) => {
    if (selectedShape) {
      await reflect.mutate.moveShape({ id: selectedShape.id, dx, dy });
    }
  };

  const handlers = {
    moveLeft: () => move(-20, 0),
    moveRight: () => move(20, 0),
    moveUp: () => move(0, -20),
    moveDown: () => move(0, 20),
    deleteShape: () => {
      // Prevent navigating backward on some browsers.
      event?.preventDefault();
      if (selectedShape) {
        reflect.mutate.deleteShape(selectedShape.id);
      }
    },
  };

  const onMouseMove = async ({
    pageX,
    pageY,
  }: {
    pageX: number;
    pageY: number;
  }) => {
    if (ref && ref.current) {
      reflect.mutate.setCursor({
        x: pageX,
        y: pageY - ref.current.offsetTop,
      });
    }
  };

  return (
    <HotKeys
      {...{
        style: { outline: "none", display: "flex", flex: 1 },
        keyMap,
        handlers,
      }}
    >
      <DraggableCore
        onStart={() => setDragging(true)}
        onStop={() => setDragging(false)}
      >
        <div
          {...{
            ref,
            style: {
              position: "relative",
              display: "flex",
              flex: 1,
              overflow: "hidden",
            },
            onMouseMove,
            onTouchMove: (e) => touchToMouse(e, onMouseMove),
          }}
        >
          {shapes.map((shape) => (
            // draggable rects
            <RectController
              {...{
                key: `shape-${shape.id}`,
                reflect,
                shape,
              }}
            />
          ))}

          {
            // self-highlight
            !dragging && overShape && (
              <Rect
                {...{
                  key: `highlight-${overShape.id}`,
                  shape: overShape,
                  highlight: true,
                }}
              />
            )
          }

          {
            // self-selection
            selectedShape && (
              <Selection
                {...{
                  key: `selection-${selectedShape?.id}`,
                  reflect,
                  shape: selectedShape,
                  highlight: true,
                  containerOffsetTop: ref.current && ref.current.offsetTop,
                }}
              />
            )
          }

          {
            // collaborators
            // foreignObject seems super buggy in Safari, so instead we do the
            // text labels in an HTML context, then do collaborator selection
            // rectangles as their own independent svg content. Le. Sigh.
            collaboratorIDs.map((id) => (
              <Collaborator
                key={`key-${id}`}
                reflect={reflect}
                clientID={id}
                shapeMap={shapeMap}
                logger={logger}
              />
            ))
          }
        </div>
      </DraggableCore>
    </HotKeys>
  );
}

const keyMap = {
  moveLeft: ["left", "shift+left"],
  moveRight: ["right", "shift+right"],
  moveUp: ["up", "shift+up"],
  moveDown: ["down", "shift+down"],
  deleteShape: ["del", "backspace"],
};
