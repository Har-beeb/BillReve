import React, { useRef, useEffect, useState, useCallback } from 'react';
import DOMPurify from 'dompurify';
import {
  Bold, Italic, Underline, List, ListOrdered, Link2, Unlink,
  AlignLeft, AlignCenter, AlignRight, Image as ImageIcon,
  Heading2, Quote, RemoveFormatting, Loader2, Baseline, Highlighter,
} from 'lucide-react';

/**
 * Dependency-free rich-text editor for campaign bodies.
 *
 * WHY NO LIBRARY: TipTap/Quill/Lexical are all better editors, but each adds a
 * dependency that must be installed before the project will type check. This is
 * self-contained, so it works immediately and ships nothing extra.
 *
 * WHY execCommand: formally deprecated, but still implemented everywhere and
 * the only way to format a selection without hand-writing a document model.
 * With `styleWithCSS` it emits inline styles, which is what email needs since
 * most mail clients strip <style> blocks.
 *
 * ---------------------------------------------------------------------------
 * THREE THINGS THAT MAKE execCommand ACTUALLY WORK, all learned the hard way:
 *
 * 1. SELECTION MUST SURVIVE THE CLICK. Any toolbar control that takes focus
 *    destroys the selection before the command runs, so the command applies to
 *    nothing. Every control here uses `onMouseDown` + `preventDefault()`, and
 *    the caret is additionally saved and restored as a fallback for when focus
 *    was lost elsewhere (e.g. the user clicked the subject field in between).
 *    This is why the original colour `<select>` elements did nothing: a native
 *    select cannot avoid taking focus, so they are now popovers made of
 *    buttons.
 *
 * 2. THERE MUST BE A BLOCK TO FORMAT. `formatBlock` converts the block
 *    containing the caret. In an empty contentEditable Chrome leaves bare text
 *    nodes with no block parent, so clicking H2 has nothing to act on and
 *    silently no-ops. `defaultParagraphSeparator` is set to `p` and the editor
 *    is seeded with a paragraph so a block always exists.
 *
 * 3. styleWithCSS MUST BE TOGGLED PER COMMAND. With it ON, bold produces
 *    `<span style="font-weight:bold">`, which some mail clients strip — so
 *    semantic commands want it OFF to get <b>/<i>/<u>. But with it OFF,
 *    foreColor emits `<font color>`, and <font> is not in the sanitiser's
 *    allow-list, so colours were being stripped immediately after being
 *    applied. Colour commands therefore need it ON.
 * ---------------------------------------------------------------------------
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
  { name: 'Teal', value: '#0f766e' },
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
  { name: 'Orange', value: '#fed7aa' },
];

/** Commands that need inline styles rather than legacy presentational tags. */
const NEEDS_CSS_STYLING = new Set(['foreColor', 'hiliteColor', 'backColor']);

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  onUploadImage,
  placeholder = 'Write your campaign…',
  disabled = false,
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const savedRange = useRef<Range | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isEmpty, setIsEmpty] = useState(!value);
  const [palette, setPalette] = useState<'text' | 'highlight' | null>(null);

  // Seed the DOM once. Never drive innerHTML from state on every render — that
  // destroys the caret mid-typing, the classic contentEditable-in-React bug.
  useEffect(() => {
    const el = editorRef.current;
    if (!el || el.innerHTML) return;
    // Always start with a real block so formatBlock has something to convert.
    el.innerHTML = value ? sanitize(value) : '<p><br></p>';
    setIsEmpty(!value);
  }, [value]);

  useEffect(() => {
    // Produce <p> on Enter rather than <div> or bare text nodes.
    try {
      document.execCommand('defaultParagraphSeparator', false, 'p');
    } catch {
      /* unsupported — Enter still works, blocks are just less tidy */
    }
  }, []);

  /** Remember the caret so a toolbar click can put it back if focus was lost. */
  const saveSelection = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    if (editorRef.current?.contains(range.commonAncestorContainer)) {
      savedRange.current = range.cloneRange();
    }
  }, []);

  const restoreSelection = useCallback(() => {
    const el = editorRef.current;
    const sel = window.getSelection();
    if (!el || !sel) return;

    // If the caret is already inside the editor, leave it exactly where it is.
    if (sel.rangeCount > 0 && el.contains(sel.getRangeAt(0).commonAncestorContainer)) {
      return;
    }
    if (savedRange.current) {
      sel.removeAllRanges();
      sel.addRange(savedRange.current);
      return;
    }
    // Nothing saved — put the caret at the end so commands have a target.
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
  }, []);

  const emit = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    const raw = el.innerHTML;
    const hasText = Boolean(el.textContent?.trim());
    setIsEmpty(!hasText && !raw.includes('<img'));
    onChange(sanitize(raw));
  }, [onChange]);

  const exec = useCallback((command: string, arg?: string) => {
    if (disabled) return;
    const el = editorRef.current;
    if (!el) return;

    el.focus();
    restoreSelection();

    try {
      // See note 3 in the header: the wrong styleWithCSS value either produces
      // markup mail clients strip, or markup the sanitiser strips.
      document.execCommand('styleWithCSS', false, String(NEEDS_CSS_STYLING.has(command)));
    } catch {
      /* ignore — command below still runs */
    }

    try {
      document.execCommand(command, false, arg);
    } catch (err) {
      console.warn(`Formatting command "${command}" failed:`, err);
    }

    saveSelection();
    emit();
  }, [disabled, emit, restoreSelection, saveSelection]);

  /**
   * Heading toggles rather than one-way sets, so clicking H2 on a heading
   * returns it to a paragraph. `formatBlock` argument style differs between
   * engines, so both forms are attempted.
   */
  const toggleBlock = useCallback((tag: 'h2' | 'blockquote') => {
    const current = (() => {
      try {
        return (document.queryCommandValue('formatBlock') || '').toLowerCase();
      } catch {
        return '';
      }
    })();

    const target = current === tag ? 'p' : tag;

    if (disabled) return;
    const el = editorRef.current;
    if (!el) return;

    el.focus();
    restoreSelection();
    try {
      document.execCommand('styleWithCSS', false, 'false');
      // Chrome historically wanted '<h2>'; the bare form is the spec'd one.
      // Try bare first, fall back to the bracketed legacy form.
      if (!document.execCommand('formatBlock', false, target)) {
        document.execCommand('formatBlock', false, `<${target}>`);
      }
    } catch (err) {
      console.warn('formatBlock failed:', err);
    }
    saveSelection();
    emit();
  }, [disabled, emit, restoreSelection, saveSelection]);

  /**
   * Paste as sanitised HTML, falling back to escaped plain text.
   * Without this, pasting from Word or a web page drags in class names, <style>
   * blocks and nested tables that no mail client renders consistently.
   */
  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const html = e.clipboardData.getData('text/html');
    const text = e.clipboardData.getData('text/plain');

    if (html) {
      document.execCommand('insertHTML', false, sanitize(html));
    } else if (text) {
      const escaped = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br/>');
      document.execCommand('insertHTML', false, escaped);
    }
    saveSelection();
    emit();
  };

  const handleLink = () => {
    restoreSelection();
    const selection = window.getSelection();
    const selected = selection?.toString().trim();
    const url = window.prompt(
      selected ? `Link "${selected}" to which address?` : 'Enter the URL to link to:',
      'https://'
    );
    if (!url || url === 'https://') return;

    if (!/^https?:\/\//i.test(url) && !/^mailto:/i.test(url)) {
      window.alert('Links must start with https:// or mailto:');
      return;
    }

    if (!selected) {
      editorRef.current?.focus();
      restoreSelection();
      document.execCommand(
        'insertHTML',
        false,
        `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`
      );
      saveSelection();
      emit();
      return;
    }
    exec('createLink', url);
  };

  const handleImageSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
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
      restoreSelection();
      document.execCommand(
        'insertHTML',
        false,
        `<img src="${url}" alt="${alt.replace(/"/g, '')}" style="max-width:100%;height:auto;display:block;margin:12px 0;border-radius:8px;" />`
      );
      saveSelection();
      emit();
    } catch (err) {
      console.error('Image upload failed:', err);
      window.alert('That image could not be uploaded. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const ToolbarButton: React.FC<{
    onAction: () => void;
    title: string;
    active?: boolean;
    children: React.ReactNode;
  }> = ({ onAction, title, active, children }) => (
    <button
      type="button"
      // preventDefault on mousedown is what keeps the selection alive. A plain
      // onClick blurs the editor first and the command applies to nothing.
      onMouseDown={(e) => { e.preventDefault(); onAction(); }}
      title={title}
      aria-label={title}
      aria-pressed={active}
      disabled={disabled}
      className={`p-2 rounded-lg transition-colors disabled:opacity-40 ${
        active
          ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300'
          : 'text-slate-600 dark:text-slate-300 hover:bg-purple-50 dark:hover:bg-purple-900/30 hover:text-purple-700 dark:hover:text-purple-300'
      }`}
    >
      {children}
    </button>
  );

  const Divider = () => (
    <span className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1" aria-hidden="true" />
  );

  const Swatches: React.FC<{
    options: { name: string; value: string }[];
    command: 'foreColor' | 'hiliteColor';
  }> = ({ options, command }) => (
    <div className="absolute z-20 top-full left-0 mt-1 p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-lg grid grid-cols-4 gap-1.5 w-max">
      {options.map((c) => (
        <button
          key={c.value}
          type="button"
          title={c.name}
          aria-label={c.name}
          onMouseDown={(e) => {
            e.preventDefault();
            exec(command, c.value);
            setPalette(null);
          }}
          className="w-7 h-7 rounded-md border border-slate-200 dark:border-slate-600 hover:scale-110 transition-transform"
          style={{
            backgroundColor: c.value === 'transparent' ? '#ffffff' : c.value,
            backgroundImage:
              c.value === 'transparent'
                ? 'linear-gradient(45deg, #e2e8f0 25%, transparent 25%, transparent 75%, #e2e8f0 75%)'
                : undefined,
            backgroundSize: c.value === 'transparent' ? '8px 8px' : undefined,
          }}
        />
      ))}
    </div>
  );

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 overflow-visible focus-within:border-purple-500 focus-within:ring-2 focus-within:ring-purple-500/30 transition-all">
      <div
        role="toolbar"
        aria-label="Formatting"
        className="flex items-center flex-wrap gap-0.5 p-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900 rounded-t-xl"
      >
        <ToolbarButton onAction={() => exec('bold')} title="Bold"><Bold size={16} /></ToolbarButton>
        <ToolbarButton onAction={() => exec('italic')} title="Italic"><Italic size={16} /></ToolbarButton>
        <ToolbarButton onAction={() => exec('underline')} title="Underline"><Underline size={16} /></ToolbarButton>
        <ToolbarButton onAction={() => toggleBlock('h2')} title="Heading"><Heading2 size={16} /></ToolbarButton>
        <ToolbarButton onAction={() => toggleBlock('blockquote')} title="Quote"><Quote size={16} /></ToolbarButton>

        <Divider />

        <ToolbarButton onAction={() => exec('insertUnorderedList')} title="Bulleted list"><List size={16} /></ToolbarButton>
        <ToolbarButton onAction={() => exec('insertOrderedList')} title="Numbered list"><ListOrdered size={16} /></ToolbarButton>

        <Divider />

        <ToolbarButton onAction={() => exec('justifyLeft')} title="Align left"><AlignLeft size={16} /></ToolbarButton>
        <ToolbarButton onAction={() => exec('justifyCenter')} title="Align centre"><AlignCenter size={16} /></ToolbarButton>
        <ToolbarButton onAction={() => exec('justifyRight')} title="Align right"><AlignRight size={16} /></ToolbarButton>

        <Divider />

        <ToolbarButton onAction={handleLink} title="Insert link"><Link2 size={16} /></ToolbarButton>
        <ToolbarButton onAction={() => exec('unlink')} title="Remove link"><Unlink size={16} /></ToolbarButton>

        {onUploadImage && (
          <ToolbarButton onAction={() => fileInputRef.current?.click()} title="Insert image">
            {isUploading ? <Loader2 size={16} className="animate-spin" /> : <ImageIcon size={16} />}
          </ToolbarButton>
        )}

        <Divider />

        <span className="relative">
          <ToolbarButton
            onAction={() => setPalette((p) => (p === 'text' ? null : 'text'))}
            title="Text colour"
            active={palette === 'text'}
          >
            <Baseline size={16} />
          </ToolbarButton>
          {palette === 'text' && <Swatches options={TEXT_COLOURS} command="foreColor" />}
        </span>

        <span className="relative">
          <ToolbarButton
            onAction={() => setPalette((p) => (p === 'highlight' ? null : 'highlight'))}
            title="Highlight"
            active={palette === 'highlight'}
          >
            <Highlighter size={16} />
          </ToolbarButton>
          {palette === 'highlight' && <Swatches options={HIGHLIGHTS} command="hiliteColor" />}
        </span>

        <Divider />

        <ToolbarButton onAction={() => exec('removeFormat')} title="Clear formatting">
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
          onInput={() => { saveSelection(); emit(); }}
          onKeyUp={saveSelection}
          onMouseUp={saveSelection}
          onBlur={() => { saveSelection(); emit(); }}
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
