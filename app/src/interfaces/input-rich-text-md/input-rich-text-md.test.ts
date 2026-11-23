import { flushPromises, mount } from '@vue/test-utils';
import type { GlobalMountOptions } from '@vue/test-utils/dist/types';
import { beforeEach, expect, test, vi } from 'vitest';
import { defineComponent, h } from 'vue';
import { createI18n } from 'vue-i18n';
import enUS from '@/lang/translations/en-US.yaml';
import { getPublicURL } from '@/utils/get-root-path';
import { Tooltip } from '@/__utils__/tooltip';
import InputRichTextMd from './input-rich-text-md.vue';
import RichTextEditor from './rich/rich-text-editor.vue';
import { MODE_STORAGE_KEY } from './editor-mode';

const i18n = createI18n({ legacy: false, locale: 'en-US', messages: { 'en-US': enUS } as any });

const passthrough = (tag: string, className?: string) =>
	defineComponent({
		inheritAttrs: true,
		setup:
			(_, { slots }) =>
			() =>
				h(tag, className ? { class: className } : {}, slots.default?.()),
	});

const VMenu = defineComponent({
	setup:
		(_, { slots }) =>
		() =>
			h('div', { class: 'v-menu' }, [
				slots.activator?.({ toggle: () => undefined, active: false }),
				slots.default?.({ deactivate: () => undefined }),
			]),
});

const VIcon = defineComponent({
	props: { name: { type: String, default: '' } },
	setup: (props) => () => h('i', { 'data-icon': props.name }),
});

const stubs = {
	'v-button': passthrough('button'),
	'v-item-group': passthrough('div', 'v-item-group'),
	'v-notice': passthrough('div', 'v-notice'),
	'v-menu': VMenu,
	'v-icon': VIcon,
	'v-input': true,
	'v-list': true,
	'v-list-item': true,
	'v-list-item-content': true,
	'v-list-item-hint': true,
	'v-text-overflow': true,
	'v-dialog': true,
};

const global = (extraStubs: Record<string, any> = {}): GlobalMountOptions => ({
	stubs: { ...stubs, ...extraStubs },
	plugins: [i18n],
	directives: { Tooltip, md: {} },
});

const mountInterface = (props: Record<string, any> = {}, extraStubs: Record<string, any> = {}) =>
	mount(InputRichTextMd, { props: { value: '', ...props }, global: global(extraStubs), attachTo: document.body });

const findButton = (wrapper: ReturnType<typeof mountInterface>, text: string) =>
	wrapper.findAll('button').find((button) => button.text() === text);

const findIconButton = (wrapper: ReturnType<typeof mountInterface>, icon: string) =>
	wrapper.findAll('button').find((button) => button.find(`[data-icon="${icon}"]`).exists());

const codemirrorContainer = (wrapper: ReturnType<typeof mountInterface>) =>
	wrapper.find('.CodeMirror').element.parentElement as HTMLElement;

const richEditorStub = () => {
	const run = vi.fn();
	const insertImage = vi.fn();

	const component = defineComponent({
		name: 'RichTextEditor',
		setup(_, { expose }) {
			expose({ run, insertImage, isActive: () => false, getSelectedLink: () => null, focus: () => undefined });
			return () => h('div', { class: 'rich-text-editor-stub' });
		},
	});

	return { component, run, insertImage };
};

beforeEach(() => {
	localStorage.clear();
	document.body.innerHTML = '';
});

test('defaults to Rich text and shows switch', async () => {
	const wrapper = mountInterface({ value: '**a**' });
	await flushPromises();

	expect(wrapper.findComponent(RichTextEditor).exists()).toBe(true);
	expect(codemirrorContainer(wrapper).style.display).toBe('none');
	expect(findButton(wrapper, 'Rich text')).toBeDefined();
	expect(findButton(wrapper, 'Markdown')).toBeDefined();
	expect(wrapper.emitted('input')).toBeUndefined();
});

test('remembered markdown preference opens Markdown', async () => {
	localStorage.setItem(MODE_STORAGE_KEY, 'markdown');

	const wrapper = mountInterface({ value: '**a**' });
	await flushPromises();

	expect(wrapper.findComponent(RichTextEditor).exists()).toBe(false);
	expect(codemirrorContainer(wrapper).style.display).not.toBe('none');
	expect(findButton(wrapper, 'Edit')).toBeDefined();
	expect(findButton(wrapper, 'Preview')).toBeDefined();
});

test('unrepresentable content falls back with notice', async () => {
	const wrapper = mountInterface({ value: 'hi <span>x</span>' });
	await flushPromises();

	expect(wrapper.findComponent(RichTextEditor).exists()).toBe(false);
	expect(wrapper.find('.v-notice').text()).toContain("can't show");
});

test('switching to Rich text with unrepresentable content is refused', async () => {
	localStorage.setItem(MODE_STORAGE_KEY, 'markdown');

	const wrapper = mountInterface({ value: '<div>x</div>' });
	await flushPromises();
	expect(wrapper.find('.v-notice').exists()).toBe(false);

	await findButton(wrapper, 'Rich text')!.trigger('click');
	await flushPromises();

	expect(wrapper.findComponent(RichTextEditor).exists()).toBe(false);
	expect(codemirrorContainer(wrapper).style.display).not.toBe('none');
	expect(wrapper.find('.v-notice').text()).toContain("can't show");
	expect(localStorage.getItem(MODE_STORAGE_KEY)).toBe('markdown');
	expect(wrapper.emitted('input')).toBeUndefined();
});

test('successful switch stores preference and does not emit', async () => {
	const wrapper = mountInterface({ value: '* a\n* b' });
	await flushPromises();
	expect(wrapper.findComponent(RichTextEditor).exists()).toBe(true);

	await findButton(wrapper, 'Markdown')!.trigger('click');
	await flushPromises();

	expect(wrapper.findComponent(RichTextEditor).exists()).toBe(false);
	expect(codemirrorContainer(wrapper).style.display).not.toBe('none');
	expect(localStorage.getItem(MODE_STORAGE_KEY)).toBe('markdown');
	expect(wrapper.emitted('input')).toBeUndefined();

	await findButton(wrapper, 'Rich text')!.trigger('click');
	await flushPromises();

	expect(wrapper.findComponent(RichTextEditor).exists()).toBe(true);
	expect(localStorage.getItem(MODE_STORAGE_KEY)).toBe('rich');
	expect(wrapper.emitted('input')).toBeUndefined();
});

test('markdown preview is hidden after switching to Rich text', async () => {
	localStorage.setItem(MODE_STORAGE_KEY, 'markdown');

	const wrapper = mountInterface({ value: '**a**' });
	(wrapper.vm as any).view = ['preview'];
	await flushPromises();
	expect((wrapper.find('.preview-box').element as HTMLElement).style.display).toBe('block');

	await findButton(wrapper, 'Rich text')!.trigger('click');
	await flushPromises();

	expect((wrapper.find('.preview-box').element as HTMLElement).style.display).toBe('none');
	expect(wrapper.classes()).not.toContain('preview');
});

test('markdown-only hides switch and rich editor', async () => {
	const wrapper = mountInterface({ value: '**a**', editorMode: 'markdown-only' });
	await flushPromises();

	expect(wrapper.findComponent(RichTextEditor).exists()).toBe(false);
	expect(findButton(wrapper, 'Rich text')).toBeUndefined();
	expect(findButton(wrapper, 'Markdown')).toBeUndefined();
	expect(findButton(wrapper, 'Edit')).toBeDefined();
});

test('rich-only hides switch but still falls back for unrepresentable content', async () => {
	const wrapper = mountInterface({ value: '<div>x</div>', editorMode: 'rich-only' });
	await flushPromises();

	expect(wrapper.findComponent(RichTextEditor).exists()).toBe(false);
	expect(codemirrorContainer(wrapper).style.display).not.toBe('none');
	expect(wrapper.find('.v-notice').text()).toContain("can't show");
	expect(findButton(wrapper, 'Rich text')).toBeUndefined();
	expect(findButton(wrapper, 'Markdown')).toBeUndefined();
});

test('customSyntax buttons only in Markdown mode', async () => {
	const customSyntax = [{ name: 'Callout', icon: 'info', prefix: ':::', suffix: ':::', box: 'block' }];

	const wrapper = mountInterface({ value: 'text', customSyntax });
	await flushPromises();
	expect(findIconButton(wrapper, 'info')).toBeUndefined();

	await findButton(wrapper, 'Markdown')!.trigger('click');
	await flushPromises();
	expect(findIconButton(wrapper, 'info')).toBeDefined();
});

test('toolbar bold routes to rich editor in Rich text mode', async () => {
	const stub = richEditorStub();

	const wrapper = mountInterface({ value: 'text' }, { RichTextEditor: stub.component });
	await flushPromises();

	await findIconButton(wrapper, 'format_bold')!.trigger('click');

	expect(stub.run).toHaveBeenCalledWith('bold', undefined);
	expect(wrapper.emitted('input')).toBeUndefined();
});

test('image upload inserts asset URL with token in Rich text mode', async () => {
	const stub = richEditorStub();

	const wrapper = mountInterface({ value: 'text', imageToken: 'tok' }, { RichTextEditor: stub.component });
	await flushPromises();

	(wrapper.vm as any).onImageUpload({ id: 'abc' });

	expect(stub.insertImage).toHaveBeenCalledWith(getPublicURL() + 'assets/abc?access_token=tok', '');
});
