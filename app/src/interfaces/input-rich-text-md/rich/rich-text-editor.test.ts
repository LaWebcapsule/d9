import { mount, flushPromises } from '@vue/test-utils';
import { EditorContent, type Editor } from '@tiptap/vue-3';
import { describe, expect, test } from 'vitest';
import RichTextEditor from './rich-text-editor.vue';

const mountEditor = (props: Record<string, any> = {}) =>
	mount(RichTextEditor, {
		props: { value: '', disabled: false, font: 'sans-serif', ...props },
		attachTo: document.body,
	});

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
	await flushPromises();
	expect(w.find('[contenteditable="false"]').exists()).toBe(true);
});

test('toggling disabled does not emit for normalizable markdown', async () => {
	const w = mountEditor({ value: '* a' });
	await flushPromises();
	await w.setProps({ disabled: true });
	await flushPromises();
	expect(w.emitted('input')).toBeUndefined();
});

test('value prop change to normalizable markdown does not emit', async () => {
	const w = mountEditor({ value: 'one' });
	await w.setProps({ value: '* b' });
	await flushPromises();
	expect(w.emitted('input')).toBeUndefined();
});

describe('link', () => {
	const mountAt = async (value: string, selection: number | { from: number; to: number }) => {
		const w = mountEditor({ value });
		await flushPromises();
		const editor = w.findComponent(EditorContent).props('editor') as Editor;
		editor.commands.setTextSelection(selection);
		return w;
	};

	test('without a selection inserts the URL as linked text', async () => {
		const w = await mountAt('go', 1);
		(w.vm as any).run('link', { href: 'https://x.com' });
		await flushPromises();
		expect(w.emitted('input')!.at(-1)![0]).toBe('[https://x.com](https://x.com)go');
	});

	test('on a selection links the selected text', async () => {
		const w = await mountAt('hello world', { from: 7, to: 12 });
		(w.vm as any).run('link', { href: 'https://x.com' });
		await flushPromises();
		expect(w.emitted('input')!.at(-1)![0]).toBe('hello [world](https://x.com)');
	});

	test('with the cursor inside a link changes its URL', async () => {
		const w = await mountAt('[a link](https://old.com) after', 3);
		(w.vm as any).run('link', { href: 'https://new.com' });
		await flushPromises();
		expect(w.emitted('input')!.at(-1)![0]).toBe('[a link](https://new.com) after');
	});

	test('without a URL removes the link around the cursor', async () => {
		const w = await mountAt('[a link](https://old.com) after', 3);
		(w.vm as any).run('link', {});
		await flushPromises();
		expect(w.emitted('input')!.at(-1)![0]).toBe('a link after');
	});

	test('a disallowed URL inserts nothing', async () => {
		const w = await mountAt('go', 1);
		(w.vm as any).run('link', { href: 'javascript:alert(1)' });
		await flushPromises();
		expect(w.emitted('input')).toBeUndefined();
	});

	test('getSelectedLink returns the URL of the link around the cursor', async () => {
		const w = await mountAt('[a link](https://old.com) after', 3);
		expect((w.vm as any).getSelectedLink()).toBe('https://old.com');
		expect((w.vm as any).isActive('link')).toBe(true);
	});
});
