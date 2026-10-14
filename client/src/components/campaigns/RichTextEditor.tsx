import React, { useRef, useEffect, useState, useCallback } from 'react';
import DOMPurify from 'dompurify';
import {
  Bold, Italic, Underline, List, ListOrdered, Link2, Unlink,
  AlignLeft, AlignCenter, AlignRight, Image as ImageIcon,
  Heading2, Quote, RemoveFormatting, Loader2,
} from 'lucide-react';

/**
 * Dependency-free rich-text editor for campaign bodies.
 *
 * WHY NO LIBRARY: TipTap/Quill/Lexical would all be better editors, but each
 * adds a dependency that has to be installed before the project will even type
 * check. This is self-contained, so it works immediately and ships nothing
 * extra to the bundle.
 *
 * WHY execCommand: it is formally deprecated, but it remains implemented in
 * every browser and is the only way to apply formatting to a selection without
 * hand-writing Range manipulation. The modern alternative is a full document
 * model (which is what the libraries above are). For a toolbar this size the
 * trade is worth it — and critically, with `styleWithCSS` enabled it emits
 * INLINE styles, which is exactly what email requires since <style> blocks are
 * stripped by most mail clients.
 *
 * SANITISATION: the HTML is passed through DOMPurify with an email-safe
 * allow-list on every change. Users paste from Word, Google Docs and websites,
 * which drags in <script>, <style>, class attributes and layout that no mail
 * client will honour.
 */

/** Tags and attributes that render reliably across mail clients. */
const EMAIL_SAFE_CONFIG = {
  ALLOWED_TAGS: [
    'p', 'br', 'div', 'span',
    'strong', 'b', 'em', 'i', 'u', 's',
    'h1', 'h2', 'h3',
    'ul', 'ol', 'li',
    'a', 'img', 'blockquote', 'hr',
  ],
  ALLOWED_ATTR: ['href', 'target', 'rel', 'src', 'alt', 'width', 'height', 'style'],
  // Block anything that is not a real web link or image source.
  ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|tel:|cid:|data:image\/(?:png|jpeg|gif|webp);base64,)/i,
};

const sanitize = (html: string): string =>
  DOMPurify.sanitize(html, EMAIL_SAFE_CONFIG) as unknown as string;

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  onUploadImage?: (file: File) => Promise<string>;
  placeholder?: string;
  disabled?: boolean;
}

const TEXT_COLOURS = [
  { name: 'Default', value: '#1e293b' },
  { name: 'Purple', value: '#7c3aed' },
  { name: 'Blue', value: '#1d4ed8' },
  { name: 'Green', value: '#15803d' },
  { name: 'Amber', value: '#b45309' },
  { name: 'Red', value: '#b91c1c' },
  { name: 'Grey', value: '#64748b' },
];

const HIGHLIGHTS = [
  { name: 'None', value: 'transparent' },
  { name: 'Yellow', value: '#fef08a' },
  { name: 'Green', value: '#bbf7d0' },
  { name: 'Blue', value: '#bfdbfe' },
  { name: 'Pink', value: '#fbcfe8' },
];

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  onUploadImage,
  placeholder = 'Write your campaign…',
  disabled = false,
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isEmpty, setIsEmpty] = useState(!value);

  // Seed the DOM once. Never drive innerHTML from state on every render — that
  // destroys the caret position mid-typing, which is the classic bug with
  // contentEditable in React.
  useEffect(() => {
    if (editorRef.current && !editorRef.current.innerHTML && value) {
      editorRef.current.innerHTML = sanitize(value);
      setIsEmpty(false);
    }
  }, [value]);

  // Produce inline styles rather than <font> tags, so the output survives email.
  useEffect(() => {
    try {
      document.execCommand('styleWithCSS', false, 'true');
    } catch {
      /* not supported — formatting still works, just less cleanly */
    }
  }, []);

  const emit = useCallback(() => {
    if (!editorRef.current) return;
    const raw = editorRef.current.innerHTML;
    setIsEmpty(!editorRef.current.textContent?.trim() && !raw.includes('<img'));
    onChange(sanitize(raw));
  }, [onChange]);

  const exec = (command: string, arg?: string) => {
    if (disabled) return;
    editorRef.current?.focus();
    try {
      document.execCommand(command, false, arg);
    } catch (err) {
      console.warn(`Formatting command "${command}" failed:`, err);
    }
    emit();
  };

  /**
   * Paste as sanitised HTML, falling back to plain text.
   *
   * Without this, pasting from Word or a web page injects class names, <style>
   * blocks and nested tables that no mail client renders consistently.
   */
  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const html = e.clipboardData.getData('text/html');
    const text = e.clipboardData.getData('text/plain');

    if (html) {
      document.execCommand('insertHTML', false, sanitize(html));
    } else if (text) {
      // Escape, then convert newlines, so pasted text can never become markup.
      const escaped = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br/>');
      document.execCommand('insertHTML', false, escaped);
    }
    emit();
  };

  const handleLink = () => {
    const selection = window.getSelection();
    const selected = selection?.toString().trim();
    const url = window.prompt(
      selected
        ? `Link "${selected}" to which address?`
        : 'Enter the URL to link to:',
      'https://'
    );
    if (!url) return;

    if (!/^https?:\/\//i.test(url) && !/^mailto:/i.test(url)) {
      window.alert('Links must start with https:// or mailto:');
      return;
    }

    if (!selected) {
      // No selection — insert the URL as its own link rather than silently
      // doing nothing, which is what execCommand('createLink') would do.
      document.execCommand('insertHTML', false,
        `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`);
      emit();
      return;
    }
    exec('createLink', url);
  };

  const handleImageSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-picking the same file
    if (!file || !onUploadImage) return;

    if (file.size > 2 * 1024 * 1024) {
      window.alert('Images must be under 2MB. Large images get emails clipped by Gmail and slow them down for recipients.');
      return;
    }

    setIsUploading(true);
    try {
      const url = await onUploadImage(file);
      const alt = (file.name || 'image').replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ');
      editorRef.current?.focus();
      // width:100% with max-width keeps it responsive in the inbox; alt text is
      // what recipients see when images are blocked, which is common.
      document.execCommand(
        'insertHTML',
        false,
        `<img src="${url}" alt="${alt.replace(/"/g, '')}" style="max-width:100%;height:auto;display:block;margin:12px 0;border-radius:8px;" />`
      );
      emit();
    } catch (err) {
      console.error('Image upload failed:', err);
      window.alert('That image could not be uploaded. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const ToolbarButton: React.FC<{
    onClick: () => void;
    title: string;
    children: React.ReactNode;
  }> = ({ onClick, title, children }) => (
    <button
      type="button"
      // onMouseDown + preventDefault keeps the selection alive; a plain onClick
      // would blur the editor first and the command would apply to nothing.
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      title={title}
      aria-label={title}
      disabled={disabled}
      className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-purple-50 dark:hover:bg-purple-900/30 hover:text-purple-700 dark:hover:text-purple-300 disabled:opacity-40 transition-colors"
    >
      {children}
    </button>
  );

  const Divider = () => <span className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1" aria-hidden="true" />;

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 overflow-hidden focus-within:border-purple-500 focus-within:ring-2 focus-within:ring-purple-500/30 transition-all">
      <div
        role="toolbar"
        aria-label="Formatting"
        className="flex items-center flex-wrap gap-0.5 p-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900"
      >
        <ToolbarButton onClick={() => exec('bold')} title="Bold"><Bold size={16} /></ToolbarButton>
        <ToolbarButton onClick={() => exec('italic')} title="Italic"><Italic size={16} /></ToolbarButton>
        <ToolbarButton onClick={() => exec('underline')} title="Underline"><Underline size={16} /></ToolbarButton>
        <ToolbarButton onClick={() => exec('formatBlock', '<h2>')} title="Heading"><Heading2 size={16} /></ToolbarButton>
        <ToolbarButton onClick={() => exec('formatBlock', '<blockquote>')} title="Quote"><Quote size={16} /></ToolbarButton>

        <Divider />

        <ToolbarButton onClick={() => exec('insertUnorderedList')} title="Bulleted list"><List size={16} /></ToolbarButton>
        <ToolbarButton onClick={() => exec('insertOrderedList')} title="Numbered list"><ListOrdered size={16} /></ToolbarButton>

        <Divider />

        <ToolbarButton onClick={() => exec('justifyLeft')} title="Align left"><AlignLeft size={16} /></ToolbarButton>
        <ToolbarButton onClick={() => exec('justifyCenter')} title="Align centre"><AlignCenter size={16} /></ToolbarButton>
        <ToolbarButton onClick={() => exec('justifyRight')} title="Align right"><AlignRight size={16} /></ToolbarButton>

        <Divider />

        <ToolbarButton onClick={handleLink} title="Insert link"><Link2 size={16} /></ToolbarButton>
        <ToolbarButton onClick={() => exec('unlink')} title="Remove link"><Unlink size={16} /></ToolbarButton>

        {onUploadImage && (
          <ToolbarButton
            onClick={() => fileInputRef.current?.click()}
            title="Insert image"
          >
            {isUploading ? <Loader2 size={16} className="animate-spin" /> : <ImageIcon size={16} />}
          </ToolbarButton>
        )}

        <Divider />

        {/* Text colour */}
        <label className="flex items-center gap-1 pl-1" title="Text colour">
          <span className="sr-only">Text colour</span>
          <select
            aria-label="Text colour"
            disabled={disabled}
            onMouseDown={(e) => e.stopPropagation()}
            onChange={(e) => { exec('foreColor', e.target.value); e.currentTarget.selectedIndex = 0; }}
            className="text-xs bg-transparent border border-slate-200 dark:border-slate-700 rounded-md px-1.5 py-1 text-slate-600 dark:text-slate-300 cursor-pointer"
            defaultValue=""
          >
            <option value="" disabled>Colour</option>
            {TEXT_COLOURS.map((c) => (
              <option key={c.value} value={c.value}>{c.name}</option>
            ))}
          </select>
        </label>

        {/* Highlight */}
        <label className="flex items-center gap-1" title="Highlight">
          <span className="sr-only">Highlight colour</span>
          <select
            aria-label="Highlight colour"
            disabled={disabled}
            onChange={(e) => { exec('hiliteColor', e.target.value); e.currentTarget.selectedIndex = 0; }}
            className="text-xs bg-transparent border border-slate-200 dark:border-slate-700 rounded-md px-1.5 py-1 text-slate-600 dark:text-slate-300 cursor-pointer"
            defaultValue=""
          >
            <option value="" disabled>Highlight</option>
            {HIGHLIGHTS.map((c) => (
              <option key={c.value} value={c.value}>{c.name}</option>
            ))}
          </select>
        </label>

        <Divider />

        <ToolbarButton onClick={() => exec('removeFormat')} title="Clear formatting">
          <RemoveFormatting size={16} />
        </ToolbarButton>
      </div>

      <div className="relative">
        {isEmpty && (
          <span className="absolute top-4 left-4 text-slate-400 dark:text-slate-500 pointer-events-none select-none">
            {placeholder}
          </span>
        )}
        <div
          ref={editorRef}
          contentEditable={!disabled}
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          aria-label="Campaign content"
          onInput={emit}
          onBlur={emit}
          onPaste={handlePaste}
          className="min-h-[260px] max-h-[520px] overflow-y-auto p-4 outline-none text-slate-800 dark:text-slate-100 leading-relaxed [&_h2]:text-xl [&_h2]:font-bold [&_h2]:mt-4 [&_h2]:mb-2 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_blockquote]:border-l-4 [&_blockquote]:border-slate-300 [&_blockquote]:pl-4 [&_blockquote]:italic [&_a]:text-purple-600 [&_a]:underline [&_p]:mb-3"
        />
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        className="hidden"
        onChange={handleImageSelected}
      />
    </div>
  );
};

export default RichTextEditor;
