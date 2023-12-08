"use client";
import type { Reflect } from "@rocicorp/reflect/client";
import { useEffect, useState } from "react";
import { Provider } from "@rocicorp/reflect-yjs";
import { Collaboration } from "@tiptap/extension-collaboration";
import { CollaborationCursor } from "@tiptap/extension-collaboration-cursor";
import { Editor as NovelEditor } from "novel";
import * as Y from "yjs";
import type { M } from "../datamodel/mutators";
import type { Mutators as YJSMutators } from "@rocicorp/reflect-yjs";
import { useMyUserInfo } from "../datamodel/subscriptions";
import type { Shape } from "./rect";

export function Editor({
  r,
  shape,
}: {
  r: Reflect<M & YJSMutators>;
  shape: Shape;
}) {
  const [doc, setDoc] = useState<Y.Doc>();

  const [provider, setProvider] = useState<Provider>();

  const userInfo = useMyUserInfo(r);

  useEffect(() => {
    if (userInfo && provider) {
      provider.awareness.setLocalStateField("user", {
        ...userInfo,
        picture: userInfo?.avatar,
      });
    }
  }, [userInfo, provider, shape]);

  useEffect(() => {
    const yDoc = new Y.Doc();
    const yProvider = new Provider(r, shape.id, yDoc);

    setDoc(yDoc);
    setProvider(yProvider);
    return () => {
      yDoc?.destroy();
      yProvider?.destroy();
    };
  }, []);

  if (!doc || !provider) {
    return null;
  }

  return (
    userInfo && (
      <NovelEditor
        extensions={[
          Collaboration.configure({
            document: doc,
          }),
          CollaborationCursor.configure({
            provider,
            user: { ...userInfo, picture: userInfo?.avatar },
          }),
        ]}
        defaultValue=""
        className="editor"
        disableLocalStorage={true}
      />
    )
  );
}
