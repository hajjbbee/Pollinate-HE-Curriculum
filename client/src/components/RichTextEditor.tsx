import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Button } from "@/components/ui/button";
import { Bold, Italic, List, ListOrdered, Undo, Redo } from "lucide-react";

interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  className?: string;
}

export function RichTextEditor({
  content,
  onChange,
  placeholder = "Write something...",
  className = "",
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [StarterKit],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none focus:outline-none min-h-[200px] p-4",
      },
    },
  });

  if (!editor) {
    return null;
  }

  return (
    <div className={`border border-input rounded-lg overflow-hidden ${className}`}>
      <div className="flex flex-wrap items-center gap-1 p-2 border-b border-border bg-muted/50">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`h-8 w-8 ${editor.isActive("bold") ? "bg-accent" : ""}`}
          data-testid="button-bold"
        >
          <Bold className="w-4 h-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`h-8 w-8 ${editor.isActive("italic") ? "bg-accent" : ""}`}
          data-testid="button-italic"
        >
          <Italic className="w-4 h-4" />
        </Button>
        <div className="w-px h-6 bg-border mx-1" />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`h-8 w-8 ${editor.isActive("bulletList") ? "bg-accent" : ""}`}
          data-testid="button-bullet-list"
        >
          <List className="w-4 h-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`h-8 w-8 ${editor.isActive("orderedList") ? "bg-accent" : ""}`}
          data-testid="button-ordered-list"
        >
          <ListOrdered className="w-4 h-4" />
        </Button>
        <div className="w-px h-6 bg-border mx-1" />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          className="h-8 w-8"
          data-testid="button-undo"
        >
          <Undo className="w-4 h-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          className="h-8 w-8"
          data-testid="button-redo"
        >
          <Redo className="w-4 h-4" />
        </Button>
      </div>
      <EditorContent editor={editor} className="bg-background" />
      {editor.isEmpty && (
        <div className="absolute top-14 left-4 text-muted-foreground pointer-events-none">
          {placeholder}
        </div>
      )}
    </div>
  );
}
