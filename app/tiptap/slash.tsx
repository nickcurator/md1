"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
} from "react";
import { Extension } from "@tiptap/core";
import Suggestion, { type SuggestionOptions } from "@tiptap/suggestion";
import { ReactRenderer } from "@tiptap/react";
import DriveSlashMenu from "../DriveSlashMenu";
import { filterSlashCommands, type SlashCommand } from "../drive-slash-commands";
import { runTipTapAction } from "./commands";

type PopupHandle = { onKeyDown: (event: KeyboardEvent) => boolean };
type PopupProps = {
  items: SlashCommand[];
  command: (item: SlashCommand) => void;
};

// Reuses the Notion-style DriveSlashMenu UI inside a caret-anchored popup.
const SlashPopup = forwardRef<PopupHandle, PopupProps>(function SlashPopup(
  { items, command },
  ref,
) {
  const [index, setIndex] = useState(0);
  useEffect(() => setIndex(0), [items]);

  useImperativeHandle(
    ref,
    () => ({
      onKeyDown: (event) => {
        if (items.length === 0) return false;
        if (event.key === "ArrowDown") {
          setIndex((i) => (i + 1) % items.length);
          return true;
        }
        if (event.key === "ArrowUp") {
          setIndex((i) => (i - 1 + items.length) % items.length);
          return true;
        }
        if (event.key === "Enter" || event.key === "Tab") {
          command(items[index] ?? items[0]);
          return true;
        }
        return false;
      },
    }),
    [items, index, command],
  );

  if (items.length === 0) return null;
  return (
    <DriveSlashMenu
      commands={items}
      activeIndex={index}
      position={{ top: 0, left: 0 }}
      onSelect={command}
      onHover={setIndex}
    />
  );
});

// `onImage` is read at call-time so the (once-created) extension uses the
// current picker callback.
export function createSlashExtension(onImage: () => void) {
  return Extension.create({
    name: "slashCommands",
    addProseMirrorPlugins() {
      const suggestion: Omit<SuggestionOptions<SlashCommand>, "editor"> = {
        char: "/",
        allowSpaces: false,
        startOfLine: false,
        items: ({ query }) => filterSlashCommands(query),
        command: ({ editor, range, props }) => {
          editor.chain().focus().deleteRange(range).run();
          if (props.kind === "image") onImage();
          else runTipTapAction(editor, props.action);
        },
        render: () => {
          let renderer: ReactRenderer<PopupHandle, PopupProps> | null = null;
          let el: HTMLDivElement | null = null;
          const place = (clientRect?: (() => DOMRect | null) | null) => {
            const rect = clientRect?.();
            if (!rect || !el) return;
            el.style.left = `${rect.left}px`;
            el.style.top = `${rect.bottom + 4}px`;
          };
          return {
            onStart: (props) => {
              renderer = new ReactRenderer(SlashPopup, {
                props: { items: props.items, command: props.command },
                editor: props.editor,
              });
              el = document.createElement("div");
              el.style.position = "fixed";
              el.style.zIndex = "50";
              document.body.appendChild(el);
              el.appendChild(renderer.element);
              place(props.clientRect);
            },
            onUpdate: (props) => {
              renderer?.updateProps({
                items: props.items,
                command: props.command,
              });
              place(props.clientRect);
            },
            onKeyDown: (props) => {
              if (props.event.key === "Escape") return false;
              return renderer?.ref?.onKeyDown(props.event) ?? false;
            },
            onExit: () => {
              renderer?.destroy();
              el?.remove();
              renderer = null;
              el = null;
            },
          };
        },
      };
      return [Suggestion({ editor: this.editor, ...suggestion })];
    },
  });
}
