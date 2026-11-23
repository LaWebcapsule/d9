# Rich-text mode for the Markdown interface — Design

Date: 2026-11-23
Status: Draft, awaiting approval

## Intent and why

Non-technical editors struggle with d9's Markdown interface (`input-rich-text-md`). Today it is a CodeMirror 5
source editor: toolbar buttons insert markdown syntax (`**`, `#`, `[]()`), and the rendered result is only visible
behind a separate Edit/Preview toggle. Editors have to read and write markdown.

We want a markdown field that is edited visually but still **stores markdown**, with a "Rich text / Markdown"
toggle for people who want the raw source.

Stored content **must stay markdown**: downstream consumers render markdown, and existing content is markdown.
d9's HTML interface (`input-rich-text-html`, TinyMCE) is therefore not an option.

## Goals

- Non-technical editors can write and format text in existing markdown fields without seeing markdown syntax.
- Stored value remains a markdown string in the same `text` field; no data migration, no schema change.
- Existing markdown fields get the new experience without admins reconfiguring them.
- Technical users can still edit raw markdown.

## Non-goals

- Not a new interface; not replacing `input-rich-text-html`.
- No collaborative editing, comments, or track changes.
- No new markdown features beyond what the current toolbar offers (no footnotes, embeds, etc.).
- `customSyntax` blocks are not modelled in rich-text mode (v1).

## Anti-goals (failure even if it "works")

- Silently changing or losing content: merely opening a record must not rewrite its markdown, an edit must never
  change how untouched content *renders*, and content the editor can't represent must never be mangled.
- Spurious revisions/diffs caused merely by viewing an item.
- An editor that looks foreign to d9 (TinyMCE-style chrome).

## Constraints

- Vue 3 app (`app/`), interface registered via `defineInterface` in
  `app/src/interfaces/input-rich-text-md/index.ts`.
- Interface is also used by Flow operations (`app/src/operations/mail/index.ts`,
  `app/src/operations/notification/index.ts`); those get the same behaviour.
- Code identifiers `@directus/`, `directus_*`, `DIRECTUS_*` must not be renamed (project rule).
- Asset URLs inserted for images keep the current format: `getPublicURL() + 'assets/' + id`, with
  `?access_token=<imageToken>` when `imageToken` is set.

## Approaches considered

| | Approach | Trade-off |
|---|---|---|
| **A (chosen)** | Tiptap (ProseMirror) + markdown (de)serialization, added as a mode inside the existing `input-rich-text-md` | Vue 3 native, mature, easy to style like d9; every existing field benefits without reconfiguration. Round-trip fidelity depends on the serializer, so unusual markdown needs a fallback. |
| B | Milkdown in the same place | Remark-based, so better round-trip fidelity; but more opinionated UI, thinner Vue integration, harder to make look native. |
| C | Separate new interface ("Markdown (visual)") | Zero risk to current fields; but every field must be switched by hand and two markdown interfaces must be maintained. |

Dropped early: a CodeMirror "live preview" that hides syntax (Obsidian-style) — it still leaks markdown at the edges,
which is exactly what confuses non-technical editors.

**Picked: A**, because it puts the easy editor on the fields editors already use without admin work, and Tiptap is
the most practical fit for d9's Vue stack.

## Design (decided)

### Modes

- Two modes in the same interface: **Rich text** (Tiptap) and **Markdown** (the existing CodeMirror editor, unchanged,
  including its Edit/Preview toggle).
- A segmented switch `[Rich text | Markdown]` sits at the right of the toolbar, replacing the Edit/Preview switch
  when both modes are allowed. In Markdown mode the Edit/Preview toggle remains available.
- **Default mode is Rich text** for all fields, including existing ones.
- The user's last chosen mode is remembered per browser (localStorage, one global key) and applied to every markdown field where that mode is allowed.

### New interface option: "Editing mode"

- `editorMode` (name/key is builder's call), choices:
  - *Rich text + Markdown* (default) — switch shown.
  - *Rich text only* — switch hidden; raw markdown never exposed.
  - *Markdown only* — today's behaviour exactly.
- Existing fields without the option behave as *Rich text + Markdown*.

### Toolbar

- Same `toolbar` option controls which buttons appear in both modes: heading (H1–H6 menu), bold, italic,
  strikethrough, bullet list, numbered list, blockquote, code, link, table (rows × columns popover), image.
- Buttons show active state in Rich text mode (e.g. bold highlighted when the cursor is in bold text).
- Same keyboard shortcuts as today (`meta+b`, `meta+i`, `meta+k`, `meta+alt+d/q/c`, `meta+alt+1..6`).
- Image button opens the existing `v-upload` dialog (from device / URL / library, honouring `folder`) and inserts an
  image node with the URL format above.
- `customSyntax` buttons appear only in Markdown mode.

### No surprise rewrites

- Loading a value into Rich text mode never emits. Only a real user edit emits `input` with the serialized markdown.
- When the external `value` prop changes (e.g. revision restore), the editor reloads it without emitting.
- Switching modes without editing does not change the value.
- **Decided:** once the user makes a real edit in Rich text, the whole document is re-serialized in the serializer's
  normalized form (list markers, emphasis markers, list numbering, table padding may change in untouched parts). This
  is a one-time normalization; rendered output must be unchanged. Content opens in Rich text if its round trip
  differs only by such normalization.

### Content Rich text can't represent

- On load, if the markdown contains constructs the Rich-text editor can't represent faithfully (at minimum: raw HTML
  blocks/inline HTML, and markdown whose parse → serialize round trip changes it beyond whitespace/marker
  normalisation), the field opens in **Markdown mode** with a short inline note explaining why
  (e.g. "This content uses formatting the visual editor can't show. Editing in Markdown.").
- In *Rich text only* fields with such content, the field still falls back to Markdown mode for that item
  (safety over the admin's preference), with the same note.

- Representability is checked on load **and** every time the user switches to Rich text (my call). If the current
  content can't be represented, the switch is refused: the user stays in Markdown mode and sees the note. No lossy
  conversion is ever offered. Once the offending construct is removed, switching to Rich text works again. A
  *Rich text only* field that fell back does not switch back on its own while the user is editing.

### Supported markdown in Rich text (my call)

- Target flavour: GFM as rendered by `marked` (`app/src/utils/md.ts`, `api/src/utils/md.ts`).
- Beyond the toolbar items, the rich schema also represents common constructs so typical existing content opens in
  Rich text: horizontal rules, link/image titles, fenced code language, table column alignment, ordered-list start
  number, bare autolinks, hard line breaks. They are shown and preserved, but get no new toolbar buttons.
- Reference-style links/images, indented code blocks and raw HTML → fall back to Markdown mode.
- `demo.md` uses reference-style links, so it is expected to fall back. Tests assert that, plus round trips over a
  separate fixture of supported constructs.

### Flow operations (my call)

- `operations/mail` and `operations/notification` pass `editorMode: markdown-only`. Their bodies contain `{{ … }}`
  template placeholders that a markdown serializer would escape (`some_field` → `some\_field`), which would break flows.

### `customSyntax` with *Rich text only* (my call)

- The option form shows a note that custom syntax buttons are only available in Markdown mode. No validation block.

### Other existing options

- `placeholder`: shown in both modes.
- `softLength`: remaining-character counter works in both modes, counting rendered text as today.
- `editorFont`: applies to the Rich text editor and the Markdown source. `previewFont`: applies to Markdown preview;
  builder may also apply it to Rich text if it reads better (builder's call).
- `disabled`: Rich text editor is read-only, toolbar disabled.

## Left to the builder

- Exact markdown package (e.g. Tiptap's official `@tiptap/markdown` vs `tiptap-markdown`) and Tiptap version.
- How "can't represent faithfully" is detected (round-trip comparison, AST scan, or both), within the rules above.
- Option key name, translation keys and English strings (other locales fall back).
- Component structure (e.g. splitting Rich text and Markdown editors into child components).
- Styling of the rich editor to match d9 (tokens/variables already used by the interface).
- Test approach; at minimum round-trip tests over the supported-constructs fixture, the
  `demo.md` fallback, and representative content.
