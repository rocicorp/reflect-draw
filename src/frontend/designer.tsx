import type { ReflectClient } from "reflect-client";
import React, { useRef, useState } from "react";
import { HotKeys } from "react-hotkeys";
import { DraggableCore } from "react-draggable";
import { Rect } from "./rect";
import { Collaborator } from "./collaborator";
import { RectController } from "./rect-controller";
import { touchToMouse } from "./events";
import { Selection } from "./selection";
import {
  useShapeIDs,
  useOverShapeID,
  useSelectedShapeID,
  useCollaboratorIDs,
} from "../datamodel/subscriptions";
import type { M } from "../datamodel/mutators";

export function Designer({
  reflectClient,
}: {
  reflectClient: ReflectClient<M>;
}) {
  const ids = useShapeIDs(reflectClient);
  const overID = useOverShapeID(reflectClient);
  const selectedID = useSelectedShapeID(reflectClient);
  const collaboratorIDs = useCollaboratorIDs(reflectClient);

  const ref = useRef<HTMLDivElement | null>(null);
  const [dragging, setDragging] = useState(false);

  const handlers = {
    moveLeft: () =>
      reflectClient.mutate.moveShape({ id: selectedID, dx: -20, dy: 0 }),
    moveRight: () =>
      reflectClient.mutate.moveShape({ id: selectedID, dx: 20, dy: 0 }),
    moveUp: () =>
      reflectClient.mutate.moveShape({ id: selectedID, dx: 0, dy: -20 }),
    moveDown: () =>
      reflectClient.mutate.moveShape({ id: selectedID, dx: 0, dy: 20 }),
    deleteShape: () => {
      // Prevent navigating backward on some browsers.
      event?.preventDefault();
      reflectClient.mutate.deleteShape(selectedID);
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
      reflectClient.mutate.setCursor({
        id: await reflectClient.clientID,
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
          {ids.map((id) => (
            // draggable rects
            <RectController
              {...{
                key: `shape-${id}`,
                reflectClient,
                id,
              }}
            />
          ))}

          {
            // self-highlight
            !dragging && overID && (
              <Rect
                {...{
                  key: `highlight-${overID}`,
                  reflectClient,
                  id: overID,
                  highlight: true,
                }}
              />
            )
          }

          {
            // self-selection
            selectedID && (
              <Selection
                {...{
                  key: `selection-${selectedID}`,
                  reflectClient,
                  id: selectedID,
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
                {...{
                  key: `key-${id}`,
                  reflectClient,
                  clientID: id,
                }}
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
