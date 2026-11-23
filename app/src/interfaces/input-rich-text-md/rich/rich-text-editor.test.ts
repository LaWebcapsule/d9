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
	await flushPromises();
	expect(w.find('[contenteditable="false"]').exists()).toBe(true);
});
