<template>
	<editor-content :editor="editor" class="rich-text-editor" :class="{ disabled }" />
</template>

<script setup lang="ts">
import { computed, watch } from 'vue';
import { EditorContent, useEditor } from '@tiptap/vue-3';
import type { Alteration } from '../edits';
import { createRichExtensions } from './extensions';

const props = withDefaults(
	defineProps<{
		value: string | null;
		disabled?: boolean;
		placeholder?: string | null;
		font?: 'sans-serif' | 'serif' | 'monospace';
	}>(),
	{ disabled: false, placeholder: null, font: 'sans-serif' }
);

const emit = defineEmits<{ (e: 'input', value: string): void }>();

const family = computed(() => `var(--family-${props.font})`);

// Tiptap's trailing-node extension appends an empty paragraph, which serializes as trailing newlines
const serialize = (instance: { getMarkdown(): string }) => instance.getMarkdown().trimEnd();

let lastValue = (props.value ?? '').trimEnd();

const editor = useEditor({
	extensions: createRichExtensions({ placeholder: props.placeholder ?? '' }),
	content: props.value ?? '',
	contentType: 'markdown',
	editable: !props.disabled,
	onCreate({ editor }) {
		lastValue = serialize(editor);
	},
	onUpdate({ editor, transaction }) {
		if (!transaction.docChanged) return;
		const markdown = serialize(editor);
		if (markdown === lastValue) return;
		lastValue = markdown;
		emit('input', markdown);
	},
});

watch(
	() => props.value,
	(newValue) => {
		const instance = editor.value;
		if (!instance) return;
		const next = newValue ?? '';
		if (next.trimEnd() === serialize(instance)) return;
		instance.commands.setContent(next, { emitUpdate: false, contentType: 'markdown' });
		lastValue = serialize(instance);
	}
);

watch(
	() => props.disabled,
	(disabled) => editor.value?.setEditable(!disabled, false)
);

function run(type: Alteration, options: Record<string, any> = {}): void {
	const chain = editor.value?.chain().focus();
	if (!chain) return;

	switch (type) {
		case 'bold':
			chain.toggleBold().run();
			break;
		case 'italic':
			chain.toggleItalic().run();
			break;
		case 'strikethrough':
			chain.toggleStrike().run();
			break;
		case 'listBulleted':
			chain.toggleBulletList().run();
			break;
		case 'listNumbered':
			chain.toggleOrderedList().run();
			break;
		case 'heading':
			chain.toggleHeading({ level: options.level }).run();
			break;
		case 'blockquote':
			chain.toggleBlockquote().run();
			break;
		case 'code':
			chain.toggleCodeBlock().run();
			break;
		case 'table':
			chain.insertTable({ rows: options.rows, cols: options.columns, withHeaderRow: true }).run();
			break;
		case 'link':
			if (options.href) chain.setLink({ href: options.href }).run();
			else chain.unsetLink().run();
			break;
		case 'custom':
			break;
	}
}

function isActive(type: Alteration, options: Record<string, any> = {}): boolean {
	const instance = editor.value;
	if (!instance) return false;

	switch (type) {
		case 'bold':
			return instance.isActive('bold');
		case 'italic':
			return instance.isActive('italic');
		case 'strikethrough':
			return instance.isActive('strike');
		case 'listBulleted':
			return instance.isActive('bulletList');
		case 'listNumbered':
			return instance.isActive('orderedList');
		case 'heading':
			return instance.isActive('heading', options.level ? { level: options.level } : undefined);
		case 'blockquote':
			return instance.isActive('blockquote');
		case 'code':
			return instance.isActive('codeBlock');
		case 'table':
			return instance.isActive('table');
		case 'link':
			return instance.isActive('link');
		default:
			return false;
	}
}

function insertImage(src: string, alt: string): void {
	editor.value?.chain().focus().setImage({ src, alt }).run();
}

function getSelectedLink(): string | null {
	return editor.value?.getAttributes('link').href ?? null;
}

function focus(): void {
	editor.value?.commands.focus();
}

function clear(): void {
	editor.value?.commands.clearContent(true);
}

function pasteHTML(html: string): void {
	editor.value?.view.pasteHTML(html);
}

defineExpose({ run, isActive, insertImage, getSelectedLink, focus, clear, pasteHTML });
</script>

<style lang="scss" scoped>
.rich-text-editor {
	padding: 20px;
}

.rich-text-editor :deep(.ProseMirror) {
	min-height: 220px;
	outline: none;
}

.rich-text-editor :deep(.ProseMirror > :first-child) {
	margin-top: 0;
}

.rich-text-editor :deep(.ProseMirror p.is-editor-empty:first-child::before) {
	float: left;
	height: 0;
	color: var(--foreground-subdued);
	pointer-events: none;
	content: attr(data-placeholder);
}

.rich-text-editor.disabled {
	color: var(--foreground-subdued);
}

.rich-text-editor :deep(.ProseMirror h1) {
	margin-top: 1em;
	margin-bottom: 0;
	color: var(--foreground-normal-alt);
	font-weight: 700;
	font-size: 36px;
	font-family: v-bind(family), serif;
	line-height: 46px;
}

.rich-text-editor :deep(.ProseMirror h2) {
	margin-top: 1.25em;
	margin-bottom: 0;
	color: var(--foreground-normal-alt);
	font-weight: 700;
	font-size: 24px;
	font-family: v-bind(family), serif;
	line-height: 34px;
}

.rich-text-editor :deep(.ProseMirror h3) {
	margin-top: 1.25em;
	margin-bottom: 0;
	color: var(--foreground-normal-alt);
	font-weight: 700;
	font-size: 19px;
	font-family: v-bind(family), serif;
	line-height: 29px;
}

.rich-text-editor :deep(.ProseMirror h4) {
	margin-top: 1.5em;
	margin-bottom: 0;
	color: var(--foreground-normal-alt);
	font-weight: 700;
	font-size: 16px;
	font-family: v-bind(family), serif;
	line-height: 26px;
}

.rich-text-editor :deep(.ProseMirror h5) {
	margin-top: 2em;
	margin-bottom: 0;
	color: var(--foreground-normal-alt);
	font-weight: 700;
	font-size: 14px;
	font-family: v-bind(family), serif;
	line-height: 24px;
}

.rich-text-editor :deep(.ProseMirror h6) {
	margin-top: 2em;
	margin-bottom: 0;
	color: var(--foreground-normal-alt);
	font-weight: 700;
	font-size: 12px;
	font-family: v-bind(family), serif;
	line-height: 22px;
}

.rich-text-editor :deep(.ProseMirror p) {
	margin: 1.5em 0;
	font-weight: 500;
	font-size: 15px;
	font-family: v-bind(family), serif;
	line-height: 24px;
}

.rich-text-editor :deep(.ProseMirror li > p),
.rich-text-editor :deep(.ProseMirror th > p),
.rich-text-editor :deep(.ProseMirror td > p) {
	margin: 0;
}

.rich-text-editor :deep(.ProseMirror a) {
	color: var(--primary-125);
	text-decoration: none;
}

.rich-text-editor :deep(.ProseMirror ul),
.rich-text-editor :deep(.ProseMirror ol) {
	margin: 1.5em 0;
	font-weight: 500;
	font-size: 15px;
	font-family: v-bind(family), serif;
	line-height: 24px;
}

.rich-text-editor :deep(.ProseMirror ul ul),
.rich-text-editor :deep(.ProseMirror ol ol),
.rich-text-editor :deep(.ProseMirror ul ol),
.rich-text-editor :deep(.ProseMirror ol ul) {
	margin: 0;
}

.rich-text-editor :deep(.ProseMirror b),
.rich-text-editor :deep(.ProseMirror strong) {
	font-weight: 700;
}

.rich-text-editor :deep(.ProseMirror code) {
	padding: 2px 4px;
	font-weight: 500;
	font-size: 15px;
	font-family: var(--family-monospace), monospace;
	line-height: 24px;
	overflow-wrap: break-word;
	background-color: var(--background-normal);
	border-radius: var(--border-radius);
}

.rich-text-editor :deep(.ProseMirror pre) {
	padding: 1em;
	overflow: auto;
	font-weight: 500;
	font-size: 15px;
	font-family: var(--family-monospace), monospace;
	line-height: 24px;
	background-color: var(--background-normal);
	border-radius: var(--border-radius);
}

.rich-text-editor :deep(.ProseMirror blockquote) {
	margin-left: 0px;
	padding-left: 1em;
	font-weight: 500;
	font-size: 15px;
	font-family: v-bind(family), serif;
	line-height: 24px;
	border-left: 2px solid var(--border-normal);
}

.rich-text-editor :deep(.ProseMirror blockquote blockquote) {
	margin-left: 10px;
}

.rich-text-editor :deep(.ProseMirror video),
.rich-text-editor :deep(.ProseMirror iframe),
.rich-text-editor :deep(.ProseMirror img) {
	max-width: 100%;
	height: auto;
	border-radius: var(--border-radius);
}

.rich-text-editor :deep(.ProseMirror hr) {
	height: 1px;
	margin-top: 2em;
	margin-bottom: 2em;
	background-color: var(--border-normal);
	border: none;
}

.rich-text-editor :deep(.ProseMirror table) {
	font-weight: 500;
	font-size: 15px;
	line-height: 24px;
	border-collapse: collapse;
}

.rich-text-editor :deep(.ProseMirror table th),
.rich-text-editor :deep(.ProseMirror table td) {
	padding: 0.4rem;
	border: 1px solid var(--border-normal);
}

.rich-text-editor :deep(.ProseMirror figure) {
	display: table;
	margin: 1rem auto;
}

.rich-text-editor :deep(.ProseMirror figure figcaption) {
	display: block;
	margin-top: 0.25rem;
	color: #999;
	text-align: center;
}
</style>
