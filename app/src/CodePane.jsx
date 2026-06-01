import CodeMirror from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { Decoration, EditorView, ViewPlugin } from "@codemirror/view";
import { tags } from "@lezer/highlight";
import { Code2 } from "lucide-react";
import { useMemo } from "react";

const editorThemeSpec = {
  "&": {
    height: "100%",
    backgroundColor: "var(--editor-bg)",
    color: "var(--editor-fg)",
    fontSize: "12.5px"
  },
  ".cm-scroller": {
    fontFamily: "\"JetBrains Mono\", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    lineHeight: "1.58"
  },
  ".cm-content": {
    padding: "12px 0 36px"
  },
  ".cm-line": {
    padding: "0 16px"
  },
  ".cm-gutters": {
    borderRight: "1px solid var(--editor-gutter-border)",
    backgroundColor: "var(--editor-gutter-bg)",
    color: "var(--editor-gutter-fg)"
  },
  ".cm-activeLine": {
    backgroundColor: "var(--editor-active-line)"
  },
  ".cm-activeLineGutter": {
    backgroundColor: "var(--editor-active-gutter)",
    color: "var(--editor-accent)"
  },
  ".cm-selectionBackground": {
    backgroundColor: "var(--editor-selection) !important"
  },
  ".cm-cursor": {
    borderLeftColor: "var(--editor-accent)"
  },
  ".cm-tooltip": {
    border: "1px solid var(--editor-gutter-border)",
    backgroundColor: "var(--editor-gutter-bg)"
  }
};

const darkEditorTheme = EditorView.theme(editorThemeSpec, { dark: true });
const lightEditorTheme = EditorView.theme(editorThemeSpec, { dark: false });

const syntaxTheme = HighlightStyle.define([
  { tag: tags.keyword, color: "var(--editor-keyword)" },
  { tag: [tags.atom, tags.bool, tags.number], color: "var(--editor-number)" },
  { tag: [tags.string, tags.special(tags.string)], color: "var(--editor-string)" },
  { tag: [tags.comment, tags.lineComment, tags.blockComment], color: "var(--editor-comment)", fontStyle: "italic" },
  { tag: [tags.function(tags.variableName), tags.function(tags.propertyName)], color: "var(--editor-function)" },
  { tag: [tags.variableName, tags.propertyName], color: "var(--editor-variable)" },
  { tag: [tags.definition(tags.variableName), tags.className], color: "var(--editor-definition)" },
  { tag: [tags.operator, tags.punctuation], color: "var(--editor-operator)" },
  { tag: tags.invalid, color: "var(--editor-invalid)" }
]);

const GLSL_KEYWORDS = /\b(?:bool|break|const|continue|discard|else|false|float|for|if|in|inout|int|mat2|mat3|mat4|out|return|struct|true|uniform|vec2|vec3|vec4|void|while)\b/gu;
const GLSL_FUNCTIONS = /\b[a-zA-Z_]\w*(?=\s*\()/gu;
const GLSL_NUMBERS = /\b(?:\d+\.\d*|\.\d+|\d+)(?:[eE][+-]?\d+)?\b/gu;
const GLSL_COMMENTS = /\/\/[^\n]*|\/\*[\s\S]*?\*\//gu;

const basicSetup = {
  autocompletion: true,
  bracketMatching: true,
  closeBrackets: true,
  defaultKeymap: true,
  foldGutter: true,
  highlightActiveLine: true,
  highlightActiveLineGutter: true,
  highlightSelectionMatches: true,
  lineNumbers: true,
  searchKeymap: true
};

function hasOddBackslashRun(source, index) {
  let count = 0;
  for (let cursor = index - 1; cursor >= 0 && source[cursor] === "\\"; cursor -= 1) {
    count += 1;
  }
  return count % 2 === 1;
}

function glslTemplateRanges(source) {
  const ranges = [];
  const pattern = /(?:const\s+GLSL\s*=\s*|glsl\s*:\s*)`/gu;
  let match = pattern.exec(source);
  while (match) {
    const start = match.index + match[0].length;
    let end = -1;
    for (let index = start; index < source.length; index += 1) {
      if (source[index] === "`" && !hasOddBackslashRun(source, index)) {
        end = index;
        break;
      }
    }
    if (end > start) {
      ranges.push([start, end]);
      pattern.lastIndex = end + 1;
    }
    match = pattern.exec(source);
  }
  return ranges;
}

function addRegexDecorations(ranges, source, offset, regex, decoration) {
  regex.lastIndex = 0;
  let match = regex.exec(source);
  while (match) {
    ranges.push(decoration.range(offset + match.index, offset + match.index + match[0].length));
    match = regex.exec(source);
  }
}

const glslRegionDecoration = Decoration.mark({ class: "cm-glsl-region" });
const glslKeywordDecoration = Decoration.mark({ class: "cm-glsl-keyword" });
const glslFunctionDecoration = Decoration.mark({ class: "cm-glsl-function" });
const glslNumberDecoration = Decoration.mark({ class: "cm-glsl-number" });
const glslCommentDecoration = Decoration.mark({ class: "cm-glsl-comment" });

function buildGlslDecorations(view) {
  const source = view.state.doc.toString();
  const ranges = [];
  for (const [start, end] of glslTemplateRanges(source)) {
    const glsl = source.slice(start, end);
    ranges.push(glslRegionDecoration.range(start, end));
    addRegexDecorations(ranges, glsl, start, GLSL_COMMENTS, glslCommentDecoration);
    addRegexDecorations(ranges, glsl, start, GLSL_KEYWORDS, glslKeywordDecoration);
    addRegexDecorations(ranges, glsl, start, GLSL_FUNCTIONS, glslFunctionDecoration);
    addRegexDecorations(ranges, glsl, start, GLSL_NUMBERS, glslNumberDecoration);
  }
  return Decoration.set(ranges, true);
}

const glslTemplateHighlighting = ViewPlugin.fromClass(class {
  constructor(view) {
    this.decorations = buildGlslDecorations(view);
  }

  update(update) {
    if (update.docChanged || update.viewportChanged) {
      this.decorations = buildGlslDecorations(update.view);
    }
  }
}, {
  decorations: (plugin) => plugin.decorations
});

export function CodePane({
  active = false,
  className = "",
  themeMode = "dark",
  value,
  onChange
}) {
  const extensions = useMemo(() => [
    javascript({ jsx: false, typescript: false }),
    syntaxHighlighting(syntaxTheme),
    glslTemplateHighlighting,
    EditorView.lineWrapping
  ], []);

  return (
    <section className={`code-pane mobile-panel ${active ? "is-active" : ""} ${className}`}>
      <div className="section-bar">
        <div className="section-title-row">
          <Code2 size={14} />
          <span>Code</span>
        </div>
      </div>
      <div className="code-pane-body">
        <CodeMirror
          basicSetup={basicSetup}
          extensions={extensions}
          height="100%"
          theme={themeMode === "dark" ? darkEditorTheme : lightEditorTheme}
          value={value}
          onChange={onChange}
        />
      </div>
    </section>
  );
}
