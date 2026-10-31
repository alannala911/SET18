import { useEffect, useRef } from "react";

export function RichTextEditor({ htmlContent, onHtmlContentChange }) {
  const editorRef = useRef(null);

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== htmlContent) {
      editorRef.current.innerHTML = htmlContent;
    }
  }, [htmlContent]);

  function runFormattingCommand(command, commandValue) {
    editorRef.current?.focus();
    document.execCommand(command, false, commandValue);
    onHtmlContentChange(editorRef.current?.innerHTML || "");
  }

  return (
    <section className="activity-rich-editor">
      <div className="activity-editor-toolbar" role="toolbar" aria-label="Tekstformatering">
        <button
          type="button"
          aria-label="Fet tekst"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => runFormattingCommand("bold")}
        >
          <strong>B</strong>
        </button>
        <button
          type="button"
          aria-label="Kursiv tekst"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => runFormattingCommand("italic")}
        >
          <em>I</em>
        </button>
        <button
          type="button"
          aria-label="Understreket tekst"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => runFormattingCommand("underline")}
        >
          <u>U</u>
        </button>
        <label>
          <span className="visually-hidden">Tekststørrelse</span>
          <select
            aria-label="Tekststørrelse"
            defaultValue=""
            onChange={(event) => {
              if (event.target.value) runFormattingCommand("fontSize", event.target.value);
              event.target.value = "";
            }}
          >
            <option value="">Størrelse</option>
            <option value="2">Liten</option>
            <option value="3">Normal</option>
            <option value="4">Stor</option>
            <option value="5">Ekstra stor</option>
            <option value="6">Overskrift</option>
          </select>
        </label>
        <button
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => runFormattingCommand("insertUnorderedList")}
        >
          Punktliste
        </button>
        <button
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => runFormattingCommand("insertOrderedList")}
        >
          Nummerert liste
        </button>
      </div>
      <div
        ref={editorRef}
        className="activity-description-editor"
        contentEditable
        role="textbox"
        aria-label="Beskrivelse"
        aria-multiline="true"
        suppressContentEditableWarning
        onInput={(event) => onHtmlContentChange(event.currentTarget.innerHTML)}
      />
      <p className="activity-editor-help">Velg tekst og bruk knappene for å formatere den.</p>
    </section>
  );
}

