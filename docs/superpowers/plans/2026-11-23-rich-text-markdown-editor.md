# Rich-text mode for the Markdown interface — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Tiptap-based "Rich text" mode to `input-rich-text-md` that edits visually but still stores markdown, as the default, with the existing CodeMirror editor kept as "Markdown" mode.

**Architecture:** A pure converter module (Tiptap extensions + `@tiptap/markdown`) owns markdown ⇄ document conversion and the "can Rich text represent this?" check. A small mode-resolution module decides which mode a field opens in. A `rich-text-editor.vue` child wraps Tiptap and exposes the same edit actions the toolbar already uses. The existing `input-rich-text-md.vue` keeps its toolbar and CodeMirror, adds the mode switch, and routes toolbar actions to the active editor.

**Tech Stack:** Vue 3.5, Tiptap v3 (`@tiptap/core`, `@tiptap/vue-3`, `@tiptap/pm`, `@tiptap/starter-kit`, `@tiptap/extension-table`, `@tiptap/extension-image`, `@tiptap/extensions`, `@tiptap/markdown`), `marked` (already a dependency, used for the rendered-equality check), Vitest + happy-dom + `@vue/test-utils`.

**Spec:** `docs/superpowers/specs/2026-11-23-rich-text-markdown-editor-design.md`

## Global Constraints

- Stored value stays a markdown string in the same `text` field. No migration, no schema change.
- Never rename `@directus/`, `directus_*`, `DIRECTUS_*` identifiers.
- Merely loading a value, receiving a new `value` prop, or switching modes must never emit `input`. Only real user edits emit.
- After a real Rich-text edit, whole-document normalized re-serialization is accepted; the **rendered output** of untouched content must not change.
- Image URL format unchanged: `getPublicURL() + 'assets/' + id`, plus `?access_token=<imageToken>` when `imageToken` is set.
- Option key `editorMode`, values exactly `'rich-and-markdown'` (default) | `'rich-only'` | `'markdown-only'`.
- Remembered mode: localStorage key `d9.markdown-editor-mode`, values `'rich'` | `'markdown'`; all access wrapped in try/catch.
- Markdown flavour: GFM as rendered by `marked` (`app/src/utils/md.ts`).
- Flow operations `mail` and `notification` pin `editorMode: 'markdown-only'`.
- All new dependencies are added to `app/package.json` with exact versions (latest Tiptap 3.x at implementation time, all `@tiptap/*` on the same version).
- Run app tests with: `pnpm --filter @wbce-d9/app exec vitest run <path>`.

## Review Focus

1. **Empty and null values** — `value: null` or `''` opens Rich text with the placeholder and emits nothing; deleting all text emits `''` (same as CodeMirror today).
2. **External value change while in Rich text** (revision restore, save from elsewhere) — editor shows the new content and emits nothing.
3. **Pasting formatted HTML** (Word, Google Docs, web pages) into Rich text — result serializes to markdown with no raw HTML tags.
4. **Typing markdown-special characters as plain text** in Rich text (`*`, `_`, `#` at line start, `[x]`, `{{ a_b }}`) — serialized markdown renders exactly the typed text.
5. **localStorage unavailable** (private window, blocked storage) — field still opens in the default mode, no exception.

---

## File Structure

| File | Responsibility |
|---|---|
| `app/src/interfaces/input-rich-text-md/rich/extensions.ts` (create) | Tiptap extension list used everywhere (editor + headless conversion) |
| `app/src/interfaces/input-rich-text-md/rich/markdown.ts` (create) | `markdownToRich`/`richToMarkdown` helpers and `isRepresentable()` |
| `app/src/interfaces/input-rich-text-md/rich/markdown.test.ts` (create) | Converter + representability tests |
| `app/src/interfaces/input-rich-text-md/editor-mode.ts` (create) | Mode types, `resolveInitialMode()`, `canSwitchTo()`, stored-preference read/write |
| `app/src/interfaces/input-rich-text-md/editor-mode.test.ts` (create) | Mode resolution tests |
| `app/src/interfaces/input-rich-text-md/rich/rich-text-editor.vue` (create) | Tiptap Vue wrapper; exposes edit actions |
| `app/src/interfaces/input-rich-text-md/rich/rich-text-editor.test.ts` (create) | Wrapper behaviour tests |
| `app/src/interfaces/input-rich-text-md/input-rich-text-md.vue` (modify) | Mode switch, fallback notice, routing toolbar/shortcuts/images to active editor |
| `app/src/interfaces/input-rich-text-md/input-rich-text-md.test.ts` (create) | Integration tests |
| `app/src/interfaces/input-rich-text-md/index.ts` (modify) | `editorMode` option, customSyntax note |
| `app/src/operations/mail/index.ts`, `app/src/operations/notification/index.ts` (modify) | Pin `markdown-only` |
| `app/src/lang/translations/en-US.yaml` (modify) | New strings |

---

### Task 1: Markdown converter and representability check

**Files:**
- Modify: `app/package.json` (dependencies)
- Create: `app/src/interfaces/input-rich-text-md/rich/extensions.ts`
- Create: `app/src/interfaces/input-rich-text-md/rich/markdown.ts`
- Test: `app/src/interfaces/input-rich-text-md/rich/markdown.test.ts`

**Interfaces:**
- Produces:
  - `createRichExtensions(options?: { placeholder?: string }): Extensions` — StarterKit (with Link: `openOnClick: false`, `autolink: true`), `TableKit` (resizable: false), `Image` (inline: false), `Placeholder`, `Markdown` (from `@tiptap/markdown`). Link and Image keep a `title` attribute; CodeBlock keeps `language`; OrderedList keeps `start`; table cells/headers carry an `align: 'left'|'center'|'right'|null` attribute that round-trips through GFM alignment rows.
  - `markdownToRich(markdown: string): JSONContent` and `richToMarkdown(doc: JSONContent): string` — implemented with a headless `new Editor({ extensions: createRichExtensions(), content, contentType: 'markdown' })` and `editor.getMarkdown()`; destroy the editor afterwards.
  - `isRepresentable(markdown: string): boolean`

- [ ] **Step 1: Add dependencies**

Run: `pnpm --filter @wbce-d9/app add -E @tiptap/core @tiptap/vue-3 @tiptap/pm @tiptap/starter-kit @tiptap/extension-table @tiptap/extension-image @tiptap/extensions @tiptap/markdown`
Expected: all `@tiptap/*` entries in `app/package.json` share one exact 3.x version.

- [ ] **Step 2: Write the failing tests** in `markdown.test.ts`

```ts
import { marked } from 'marked';
import { describe, expect, test } from 'vitest';
import { isRepresentable, markdownToRich, richToMarkdown } from './markdown';
import demo from '../demo.md?raw';

const render = (md: string) => marked(md).replace(/\s+/g, ' ').trim();
const roundTrip = (md: string) => richToMarkdown(markdownToRich(md));

describe('supported constructs open in Rich text and render identically', () => {
	test.each([
		['headings', '# One\n\n###### Six'],
		['emphasis', '**bold** *italic* ~~strike~~ `code`'],
		['lists', '- a\n- b\n\n1. one\n2. two'],
		['ordered start', '57. foo\n58. bar'],
		['blockquote', '> quoted'],
		['fenced code with language', '```js\nconst a = 1;\n```'],
		['link with title', '[d9](https://example.com "Title")'],
		['image with title', '![alt](https://example.com/a.png "T")'],
		['autolink', 'see https://example.com'],
		['hard break', 'line one  \nline two'],
		['hr', 'a\n\n---\n\nb'],
		['aligned table', '| a | b | c |\n|:--|:-:|--:|\n| 1 | 2 | 3 |'],
	])('%s', (_name, md) => {
		expect(isRepresentable(md)).toBe(true);
		expect(render(roundTrip(md))).toBe(render(md));
	});
});

describe('unsupported constructs fall back', () => {
	test.each([
		['inline html', 'hello <span class="x">there</span>'],
		['html block', '<div>\nblock\n</div>'],
		['reference link', '[foo][1]\n\n[1]: https://example.com'],
		['indented code', 'para\n\n    code line'],
	])('%s', (_name, md) => {
		expect(isRepresentable(md)).toBe(false);
	});

	test('demo.md falls back (uses reference-style links)', () => {
		expect(isRepresentable(demo)).toBe(false);
	});
});

test('empty input is representable and round-trips to empty string', () => {
	expect(isRepresentable('')).toBe(true);
	expect(roundTrip('')).toBe('');
});

test('plain text with markdown-special characters renders literally', () => {
	const doc = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: '# not a heading *x* a_b [y] {{ a_b }}' }] }] };
	const md = richToMarkdown(doc);
	expect(marked(md)).toContain('# not a heading *x* a_b [y] {{ a_b }}');
});
```

- [ ] **Step 3: Run to verify failure**

Run: `pnpm --filter @wbce-d9/app exec vitest run src/interfaces/input-rich-text-md/rich/markdown.test.ts`
Expected: FAIL — cannot resolve `./markdown`.

- [ ] **Step 4: Implement `extensions.ts` and `markdown.ts`**

`isRepresentable(markdown)` returns `false` if any of the following holds, otherwise `true`:
1. `marked.lexer(markdown)` (walked recursively, including inline `tokens`) contains a token of type `html`, a `code` token with `codeBlockStyle === 'indented'`, or the lexer's `links` map is non-empty (reference definitions).
2. Rendered-equality check fails: `render(richToMarkdown(markdownToRich(md))) !== render(md)` using the whitespace-normalized `marked` render shown in the test. This is the safety net that catches anything the rule list misses, and it is what allows marker normalization (`*` → `-`) while rejecting real changes.

Catch any converter exception and return `false`.

For plain-text escaping (last test): if `@tiptap/markdown` does not escape markdown-special characters in text nodes, add escaping in the text serializer so the rendered result is literal.

- [ ] **Step 5: Run to verify pass**

Run: same command as Step 3. Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/package.json pnpm-lock.yaml app/src/interfaces/input-rich-text-md/rich/
git commit -m "feat(app): markdown <-> rich-text converter for markdown interface"
```

---

### Task 2: Mode resolution

**Files:**
- Create: `app/src/interfaces/input-rich-text-md/editor-mode.ts`
- Test: `app/src/interfaces/input-rich-text-md/editor-mode.test.ts`

**Interfaces:**
- Produces:
  - `type EditorModeOption = 'rich-and-markdown' | 'rich-only' | 'markdown-only'`
  - `type EditorMode = 'rich' | 'markdown'`
  - `const MODE_STORAGE_KEY = 'd9.markdown-editor-mode'`
  - `readStoredMode(): EditorMode | null` / `writeStoredMode(mode: EditorMode): void` — try/catch, invalid values read as `null`
  - `resolveInitialMode(args: { option: EditorModeOption; stored: EditorMode | null; representable: boolean }): { mode: EditorMode; fellBack: boolean }`
  - `canSwitchTo(target: EditorMode, args: { option: EditorModeOption; representable: boolean }): boolean`
  - `showModeSwitch(option: EditorModeOption): boolean` — true only for `'rich-and-markdown'`

- [ ] **Step 1: Write the failing tests**

```ts
import { afterEach, describe, expect, test, vi } from 'vitest';
import { canSwitchTo, MODE_STORAGE_KEY, readStoredMode, resolveInitialMode, showModeSwitch, writeStoredMode } from './editor-mode';

describe('resolveInitialMode', () => {
	test.each([
		// option, stored, representable, expected mode, fellBack
		['rich-and-markdown', null, true, 'rich', false],
		['rich-and-markdown', 'markdown', true, 'markdown', false],
		['rich-and-markdown', 'rich', false, 'markdown', true],
		['rich-and-markdown', null, false, 'markdown', true],
		['rich-only', 'markdown', true, 'rich', false],
		['rich-only', null, false, 'markdown', true],
		['markdown-only', 'rich', true, 'markdown', false],
		['markdown-only', null, false, 'markdown', false],
	] as const)('%s / stored=%s / representable=%s → %s', (option, stored, representable, mode, fellBack) => {
		expect(resolveInitialMode({ option, stored, representable })).toEqual({ mode, fellBack });
	});
});

describe('canSwitchTo', () => {
	test('rich refused when content not representable', () => {
		expect(canSwitchTo('rich', { option: 'rich-and-markdown', representable: false })).toBe(false);
	});
	test('rich allowed when representable', () => {
		expect(canSwitchTo('rich', { option: 'rich-and-markdown', representable: true })).toBe(true);
	});
	test('markdown always allowed except rich-only', () => {
		expect(canSwitchTo('markdown', { option: 'rich-and-markdown', representable: true })).toBe(true);
		expect(canSwitchTo('markdown', { option: 'rich-only', representable: true })).toBe(false);
	});
	test('nothing allowed for markdown-only except markdown', () => {
		expect(canSwitchTo('rich', { option: 'markdown-only', representable: true })).toBe(false);
	});
});

test('showModeSwitch', () => {
	expect(showModeSwitch('rich-and-markdown')).toBe(true);
	expect(showModeSwitch('rich-only')).toBe(false);
	expect(showModeSwitch('markdown-only')).toBe(false);
});

describe('stored mode', () => {
	afterEach(() => { vi.restoreAllMocks(); localStorage.clear(); });

	test('round-trips', () => {
		writeStoredMode('markdown');
		expect(localStorage.getItem(MODE_STORAGE_KEY)).toBe('markdown');
		expect(readStoredMode()).toBe('markdown');
	});
	test('invalid value reads as null', () => {
		localStorage.setItem(MODE_STORAGE_KEY, 'bogus');
		expect(readStoredMode()).toBeNull();
	});
	test('storage throwing is swallowed', () => {
		vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
		vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
		expect(readStoredMode()).toBeNull();
		expect(() => writeStoredMode('rich')).not.toThrow();
	});
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @wbce-d9/app exec vitest run src/interfaces/input-rich-text-md/editor-mode.test.ts`
Expected: FAIL — cannot resolve `./editor-mode`.

- [ ] **Step 3: Implement `editor-mode.ts`** to satisfy the table above.

- [ ] **Step 4: Run to verify pass** — same command. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/interfaces/input-rich-text-md/editor-mode*
git commit -m "feat(app): editor mode resolution for markdown interface"
```

---

### Task 3: Rich-text editor component

**Files:**
- Create: `app/src/interfaces/input-rich-text-md/rich/rich-text-editor.vue`
- Test: `app/src/interfaces/input-rich-text-md/rich/rich-text-editor.test.ts`

**Interfaces:**
- Consumes: `createRichExtensions`, `markdownToRich`-compatible content loading from Task 1 (load with `contentType: 'markdown'`, read with `editor.getMarkdown()`).
- Produces: component `RichTextEditor`
  - Props: `value: string | null`, `disabled: boolean`, `placeholder?: string`, `font: 'sans-serif' | 'serif' | 'monospace'`
  - Emits: `input(markdown: string)` — only from user-originated transactions
  - Exposed (via `defineExpose`):
    - `run(type: Alteration, options?: Record<string, any>): void` — `Alteration` from `../edits`. Mapping: `bold`→toggleBold, `italic`→toggleItalic, `strikethrough`→toggleStrike, `listBulleted`→toggleBulletList, `listNumbered`→toggleOrderedList, `heading`→toggleHeading({ level: options.level }), `blockquote`→toggleBlockquote, `code`→toggleCodeBlock, `table`→insertTable({ rows: options.rows, cols: options.columns, withHeaderRow: true }), `link`→`setLink({ href: options.href })` or `unsetLink()` when `options.href` is empty, `custom`→no-op.
    - `isActive(type: Alteration, options?: Record<string, any>): boolean`
    - `insertImage(src: string, alt: string): void`
    - `getSelectedLink(): string | null` — current link href at selection, for prefilling the link popover
    - `focus(): void`
    - `clear(): void`, `pasteHTML(html: string): void` (see Step 1)

Behaviour:
- `value` prop changes: if `newValue !== editor.getMarkdown()`, call `editor.commands.setContent(newValue ?? '', { emitUpdate: false, contentType: 'markdown' })`.
- `onUpdate` emits `getMarkdown()`; skip if it equals the last emitted/loaded value.
- `disabled` → `editor.setEditable(!disabled)`.
- Pasted HTML is reduced to the schema (Tiptap default); nothing extra needed beyond the test.
- Styling: content uses `var(--family-<font>)`, matches the existing `.preview-box` typography in `input-rich-text-md.vue` (reuse those rules; table/blockquote/code styles included). No borders of its own — the parent provides the frame.

- [ ] **Step 1: Write the failing tests**

```ts
import { mount, flushPromises } from '@vue/test-utils';
import { expect, test } from 'vitest';
import RichTextEditor from './rich-text-editor.vue';

const mountEditor = (props: Record<string, any> = {}) =>
	mount(RichTextEditor, { props: { value: '', disabled: false, font: 'sans-serif', ...props }, attachTo: document.body });

test('loading a value does not emit', async () => {
	const w = mountEditor({ value: '# Hi\n\n**there**' });
	await flushPromises();
	expect(w.find('h1').text()).toBe('Hi');
	expect(w.emitted('input')).toBeUndefined();
});

test('changing value prop does not emit', async () => {
	const w = mountEditor({ value: 'one' });
	await w.setProps({ value: 'two' });
	await flushPromises();
	expect(w.text()).toContain('two');
	expect(w.emitted('input')).toBeUndefined();
});

test('a user edit emits markdown', async () => {
	const w = mountEditor({ value: 'hello' });
	(w.vm as any).focus();
	(w.vm as any).run('heading', { level: 2 });
	await flushPromises();
	expect(w.emitted('input')!.at(-1)![0]).toBe('## hello');
});

test('deleting everything emits empty string', async () => {
	const w = mountEditor({ value: 'x' });
	(w.vm as any).clear();
	await flushPromises();
	expect(w.emitted('input')!.at(-1)![0]).toBe('');
});

test('insertImage emits image markdown', async () => {
	const w = mountEditor({ value: '' });
	(w.vm as any).insertImage('https://cms/assets/abc', 'alt');
	await flushPromises();
	expect(w.emitted('input')!.at(-1)![0]).toBe('![alt](https://cms/assets/abc)');
});

test('isActive reflects marks', async () => {
	const w = mountEditor({ value: '# Title' });
	(w.vm as any).focus();
	expect((w.vm as any).isActive('heading', { level: 1 })).toBe(true);
});

test('pasted HTML serializes without raw HTML tags', async () => {
	const w = mountEditor({ value: '' });
	(w.vm as any).pasteHTML('<p><span style="color:red">Red</span> <b>bold</b></p><div class="x">div</div>');
	await flushPromises();
	const md = w.emitted('input')!.at(-1)![0] as string;
	expect(md).not.toMatch(/<[a-z]/i);
	expect(md).toContain('**bold**');
});

test('disabled makes it read-only', async () => {
	const w = mountEditor({ value: 'x', disabled: true });
	expect(w.find('[contenteditable="false"]').exists()).toBe(true);
});
```

Two more exposed methods, used by these tests: `clear(): void` → `editor.commands.clearContent(true)` (user-originated, so it emits); `pasteHTML(html: string): void` → `editor.view.pasteHTML(html)` (ProseMirror API, runs the real paste pipeline).

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @wbce-d9/app exec vitest run src/interfaces/input-rich-text-md/rich/rich-text-editor.test.ts`
Expected: FAIL — cannot resolve `./rich-text-editor.vue`.

- [ ] **Step 3: Implement `rich-text-editor.vue`** (`<script setup lang="ts">`, `useEditor` + `EditorContent` from `@tiptap/vue-3`, destroy on unmount).

- [ ] **Step 4: Run to verify pass** — same command. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/interfaces/input-rich-text-md/rich/rich-text-editor*
git commit -m "feat(app): tiptap rich-text editor component for markdown interface"
```

---

### Task 4: Integrate modes into `input-rich-text-md.vue`

**Files:**
- Modify: `app/src/interfaces/input-rich-text-md/input-rich-text-md.vue`
- Modify: `app/src/lang/translations/en-US.yaml` (under `interfaces.input-rich-text-md`)
- Test: `app/src/interfaces/input-rich-text-md/input-rich-text-md.test.ts`

**Interfaces:**
- Consumes: `isRepresentable` (Task 1); everything from `editor-mode.ts` (Task 2); `RichTextEditor` with `run`, `isActive`, `insertImage`, `getSelectedLink`, `focus` (Task 3).
- Produces: new prop `editorMode: EditorModeOption` (default `'rich-and-markdown'`), consumed by Task 5's option definition.

Behaviour:
- On mount: `representable = isRepresentable(value ?? '')`; `{ mode, fellBack } = resolveInitialMode({ option: editorMode, stored: readStoredMode(), representable })`.
- Toolbar right side: when `showModeSwitch(editorMode)`, a `v-item-group` with `[Rich text | Markdown]` (same styling as today's Edit/Preview group). Clicking Rich text re-runs `isRepresentable(current value)`; if `canSwitchTo` is false, stay in Markdown and show the notice. Successful user switches call `writeStoredMode`.
- In Markdown mode the existing Edit/Preview group is shown next to it, unchanged. In Rich text mode it is hidden.
- Fallback notice: `v-notice` type `info` under the toolbar, text `interfaces.input-rich-text-md.rich_text_unavailable`, shown when `fellBack` or a switch was refused; hidden after a successful switch to Rich text.
- Toolbar buttons call `edit(type, options)`; `edit` routes to `richEditor.run` in Rich text mode and to `applyEdit(codemirror, …)` in Markdown mode. In Rich text mode buttons get the `active` class when `richEditor.isActive(...)`.
- `link` in Rich text mode opens a `v-menu` popover with a `v-input` (prefilled from `getSelectedLink()`), confirm calls `run('link', { href })`.
- `customSyntax` buttons render only in Markdown mode.
- `onImageUpload` builds the URL exactly as today and calls `richEditor.insertImage(url, '')` in Rich text mode, the existing CodeMirror path otherwise.
- Keyboard shortcuts unchanged; they route through `edit`.
- CodeMirror stays mounted but hidden (`v-show`) in Rich text mode; call `codemirror.refresh()` when switching to Markdown.
- `softLength` counter keeps working unchanged (it counts the hidden preview box rendered from `value`).
- New en-US strings: `rich_text: Rich text`, `markdown_mode: Markdown`, `rich_text_unavailable: This content uses formatting the visual editor can't show. Editing in Markdown.`, `link_url: Link URL`.

- [ ] **Step 1: Write the failing tests** (stub `v-*` globals like other app tests; mount with `i18n` the way existing interface/component tests do; spy `localStorage`)

```ts
test('defaults to Rich text and shows switch', ...)
	// mount with value '**a**' → RichTextEditor present, codemirror container hidden, switch shown, no 'input' emitted
test('remembered markdown preference opens Markdown', ...)
	// localStorage d9.markdown-editor-mode = 'markdown' → Markdown mode, Edit/Preview group visible
test('unrepresentable content falls back with notice', ...)
	// value 'hi <span>x</span>' → Markdown mode, notice text contains "can't show"
test('switching to Rich text with unrepresentable content is refused', ...)
	// start Markdown with '<div>x</div>', click Rich text → still Markdown, notice visible, localStorage unchanged
test('successful switch stores preference and does not emit', ...)
	// start Rich text, click Markdown → localStorage 'markdown', emitted('input') undefined
test('markdown-only hides switch and rich editor', ...)
	// editorMode 'markdown-only' → no switch, no RichTextEditor
test('rich-only hides switch but still falls back for unrepresentable content', ...)
	// editorMode 'rich-only', value '<div>x</div>' → Markdown mode, notice, no switch
test('customSyntax buttons only in Markdown mode', ...)
	// customSyntax [{ name: 'Callout', icon: 'info', prefix: ':::', suffix: ':::', box: 'block' }]
test('toolbar bold routes to rich editor in Rich text mode', ...)
	// stub RichTextEditor exposing run spy; click bold → run called with 'bold'
test('image upload inserts asset URL with token in Rich text mode', ...)
	// imageToken 'tok', onImageUpload({ id: 'abc' }) → insertImage called with getPublicURL() + 'assets/abc?access_token=tok'
```

Each test's assertions are given in its comment; write them as real `expect`s.

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @wbce-d9/app exec vitest run src/interfaces/input-rich-text-md/input-rich-text-md.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement the behaviour above** in `input-rich-text-md.vue` and add the en-US strings.

- [ ] **Step 4: Run to verify pass** — same command. Expected: PASS.

- [ ] **Step 5: Manual check in the running app** — open an item with a markdown field: opens in Rich text; bold/heading/list/table/link/image work; switching to Markdown shows normalized markdown; reload remembers mode; a value with `<span>` opens in Markdown with the notice; viewing an item without editing creates no revision.

- [ ] **Step 6: Commit**

```bash
git add app/src/interfaces/input-rich-text-md/ app/src/lang/translations/en-US.yaml
git commit -m "feat(app): rich text mode in markdown interface"
```

---

### Task 5: `editorMode` option and Flow operations

**Files:**
- Modify: `app/src/interfaces/input-rich-text-md/index.ts`
- Modify: `app/src/operations/mail/index.ts:96` (the `body` field's `meta`)
- Modify: `app/src/operations/notification/index.ts:80` (the `message` field's `meta`)
- Modify: `app/src/lang/translations/en-US.yaml`
- Test: `app/src/interfaces/input-rich-text-md/index.test.ts`

**Interfaces:**
- Consumes: `editorMode` prop and `EditorModeOption` values (Task 4/Task 2).

Changes:
- `index.ts` standard options, after `placeholder`: field `editorMode`, name `$t:interfaces.input-rich-text-md.editor_mode`, type `string`, `schema.default_value: 'rich-and-markdown'`, `meta.width: 'half'`, `meta.interface: 'select-dropdown'`, choices `rich-and-markdown` → `$t:interfaces.input-rich-text-md.editor_mode_both`, `rich-only` → `…editor_mode_rich`, `markdown-only` → `…editor_mode_markdown`.
- `customSyntax` option: `meta.note` becomes `$t:interfaces.input-rich-text-md.customSyntax_markdown_only_note`.
- Mail operation: `meta.options: { editorMode: 'markdown-only' }` when the interface is `input-rich-text-md` (leave the wysiwyg branch untouched). Notification: same on its markdown field.
- en-US strings: `editor_mode: Editing mode`, `editor_mode_both: Rich text + Markdown`, `editor_mode_rich: Rich text only`, `editor_mode_markdown: Markdown only`, `customSyntax_markdown_only_note: Add custom syntax types. Custom syntax buttons are only available in Markdown mode.`

- [ ] **Step 1: Write the failing test**

```ts
import { expect, test } from 'vitest';
import iface from './index';
import mail from '../../operations/mail/index';
import notification from '../../operations/notification/index';

test('editorMode option with three choices, default rich-and-markdown', () => {
	const opt = (iface.options as any).standard.find((o: any) => o.field === 'editorMode');
	expect(opt.schema.default_value).toBe('rich-and-markdown');
	expect(opt.meta.options.choices.map((c: any) => c.value)).toEqual(['rich-and-markdown', 'rich-only', 'markdown-only']);
});

test('flow operations pin markdown-only', () => {
	const mailBody = (mail.options as any)({ type: 'markdown' }).find((f: any) => f.meta?.interface === 'input-rich-text-md');
	expect(mailBody.meta.options.editorMode).toBe('markdown-only');
	const notif = (notification.options as any[]).find((f: any) => f.meta?.interface === 'input-rich-text-md');
	expect(notif.meta.options.editorMode).toBe('markdown-only');
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @wbce-d9/app exec vitest run src/interfaces/input-rich-text-md/index.test.ts`
Expected: FAIL — no `editorMode` option.

- [ ] **Step 3: Implement the changes above.**

- [ ] **Step 4: Run to verify pass** — same command. Expected: PASS. Then run the whole interface folder: `pnpm --filter @wbce-d9/app exec vitest run src/interfaces/input-rich-text-md` — all PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/interfaces/input-rich-text-md/index* app/src/operations/mail/index.ts app/src/operations/notification/index.ts app/src/lang/translations/en-US.yaml
git commit -m "feat(app): editorMode option; pin flow operations to markdown-only"
```

---

### Task 6: Changeset

**Files:**
- Create: `.changeset/<generated-name>.md`

- [ ] **Step 1:** Run `pnpm changeset` (or write the file by hand) — `@wbce-d9/app: minor`, summary: "Markdown interface: new Rich text editing mode (default) that still stores markdown; new Editing mode option."
- [ ] **Step 2:** Run `pnpm --filter @wbce-d9/app test` and `pnpm --filter @wbce-d9/app build` — both pass.
- [ ] **Step 3: Commit**

```bash
git add .changeset/
git commit -m "chore: changeset for markdown rich text mode"
```
