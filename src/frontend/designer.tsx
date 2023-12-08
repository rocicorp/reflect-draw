import type { Reflect } from "@rocicorp/reflect/client";
import React, { useRef, useState } from "react";
// import { HotKeys } from "react-hotkeys";
import { DraggableCore } from "react-draggable";
import { Rect } from "./rect";
import { Collaborator } from "./collaborator";
import { RectController } from "./rect-controller";
import { touchToMouse } from "./events";
import { Selection } from "./selection";
import {
  useShapeIDs,
  useSelectionState,
  useCollaboratorIDs,
} from "../datamodel/subscriptions";
import type { M } from "../datamodel/mutators";
import type { Mutators as YJSMutators } from "@rocicorp/reflect-yjs";

export function Designer({ r }: { r: Reflect<M & YJSMutators> }) {
  const ids = useShapeIDs(r);
  const { selectedID, overID } = useSelectionState(r);
  const collaboratorIDs = useCollaboratorIDs(r);

  const ref = useRef<HTMLDivElement | null>(null);
  const [dragging, setDragging] = useState(false);

  // const handlers = {
  //   moveLeft: () => r.mutate.moveShape({ id: selectedID, dx: -20, dy: 0 }),
  //   moveRight: () => r.mutate.moveShape({ id: selectedID, dx: 20, dy: 0 }),
  //   moveUp: () => r.mutate.moveShape({ id: selectedID, dx: 0, dy: -20 }),
  //   moveDown: () => r.mutate.moveShape({ id: selectedID, dx: 0, dy: 20 }),
  //   deleteShape: () => {
  //     // Prevent navigating backward on some browsers.
  //     event?.preventDefault();
  //     r.mutate.deleteShape(selectedID);
  //   },
  // };

  const onMouseMove = async ({
    pageX,
    pageY,
  }: {
    pageX: number;
    pageY: number;
  }) => {
    if (ref && ref.current) {
      r.mutate.setCursor({
        x: pageX,
        y: pageY - ref.current.offsetTop,
      });
    }
  };

  return (
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
              r,
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
                r,
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
                r,
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
          [...collaboratorIDs].map((id) => (
            <Collaborator key={`key-${id}`} r={r} clientID={id} />
          ))
        }
      </div>
    </DraggableCore>
  );
}

// const keyMap = {
//   moveLeft: ["left", "shift+left"],
//   moveRight: ["right", "shift+right"],
//   moveUp: ["up", "shift+up"],
//   moveDown: ["down", "shift+down"],
//   deleteShape: ["del", "backspace"],
// };
