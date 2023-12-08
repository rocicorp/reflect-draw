import type { Reflect } from "@rocicorp/reflect/client";
import React, { MouseEventHandler, TouchEventHandler } from "react";
import type { M } from "../datamodel/mutators";
import type { Mutators as YJSMutators } from "@rocicorp/reflect-yjs";
import { useShapeByID } from "../datamodel/subscriptions";
import { Editor } from "./editor";

export type Shape = {
  id: string;
  type: "rect";
  fill: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotate: number;
};

export function Rect({
  r,
  id,
  highlight = false,
  highlightColor = "rgb(74,158,255)",
  onMouseDown,
  onTouchStart,
  onMouseEnter,
  onMouseLeave,
}: 
{
  r: Reflect<M & YJSMutators>;
  id: string;
  highlight?: boolean;
  highlightColor?: string;
  onMouseDown?: MouseEventHandler;
  onTouchStart?: TouchEventHandler;
  onMouseEnter?: MouseEventHandler;
  onMouseLeave?: MouseEventHandler;
}) {
  const shape = useShapeByID(r, id);
  if (!shape) {
    return null;
  }

  const { x, y, width, height, fill } = shape;
  const enableEvents =
    onMouseDown || onTouchStart || onMouseEnter || onMouseLeave;

  return (
    <div
      {...{
        style: {
          position: "absolute",
          left: -1,
          top: -1,
          transform: `translate3d(${x}px, ${y}px, 0)`,
          pointerEvents: enableEvents ? "all" : "none",
          backgroundColor: "#ffeb3b",
          border: "1px solid #ffd54f",
          boxShadow: "3px 3px 7px rgba(0,0,0,0.2)",
          fontFamily: "sans-serif",
          fontSize: "2px",
          width: width + 2,
          height: height + 2,
        },
        onMouseDown,
        onTouchStart,
        onMouseEnter,
        onMouseLeave,
      }}
    >
      <div
        className="container"
        {...{
          style: {
            width,
            height,
          },
        }}
      >
        <Editor r={r} shape={shape} />
      </div>
    </div>
  );
}
