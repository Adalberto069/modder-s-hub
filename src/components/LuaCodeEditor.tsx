import { useRef, useEffect } from "react";
import { EditorView, keymap, placeholder as cmPlaceholder } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { StreamLanguage } from "@codemirror/language";
import { lua } from "@codemirror/legacy-modes/mode/lua";
import { oneDark } from "@codemirror/theme-one-dark";
import { defaultKeymap } from "@codemirror/commands";
import { basicSetup } from "codemirror";

interface LuaCodeEditorProps {
  value: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  placeholder?: string;
  minHeight?: string;
}

export default function LuaCodeEditor({
  value,
  onChange,
  readOnly = false,
  placeholder = "-- Cole ou escreva seu código Lua aqui",
  minHeight = "300px",
}: LuaCodeEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!containerRef.current) return;

    const theme = EditorView.theme({
      "&": {
        backgroundColor: "transparent",
        minHeight,
        fontSize: "13px",
      },
      ".cm-content": {
        fontFamily: "'JetBrains Mono', monospace",
        caretColor: "hsl(142, 71%, 45%)",
      },
      ".cm-cursor": {
        borderLeftColor: "hsl(142, 71%, 45%)",
      },
      ".cm-gutters": {
        backgroundColor: "transparent",
        borderRight: "1px solid hsl(240, 5%, 18%)",
        color: "hsl(240, 5%, 35%)",
      },
      ".cm-activeLineGutter": {
        backgroundColor: "transparent",
        color: "hsl(142, 71%, 45%)",
      },
      ".cm-activeLine": {
        backgroundColor: "hsla(142, 71%, 45%, 0.04)",
      },
      ".cm-selectionBackground": {
        backgroundColor: "hsla(142, 71%, 45%, 0.15) !important",
      },
      "&.cm-focused .cm-selectionBackground": {
        backgroundColor: "hsla(142, 71%, 45%, 0.2) !important",
      },
      ".cm-scroller": {
        overflow: "auto",
      },
    });

    const state = EditorState.create({
      doc: value,
      extensions: [
        basicSetup,
        StreamLanguage.define(lua),
        oneDark,
        theme,
        keymap.of(defaultKeymap),
        EditorState.readOnly.of(readOnly),
        cmPlaceholder(placeholder),
        ...(onChange
          ? [
              EditorView.updateListener.of((update) => {
                if (update.docChanged) {
                  onChangeRef.current?.(update.state.doc.toString());
                }
              }),
            ]
          : []),
      ],
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // Only create once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync external value changes
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current !== value) {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: value },
      });
    }
  }, [value]);

  return <div ref={containerRef} className="w-full" />;
}
