<template>
	<div ref="markdownInterface" class="interface-input-rich-text-md" :class="[viewClass, { disabled }]">
		<div class="toolbar">
			<template v-if="viewClass !== 'preview'">
				<v-menu
					v-if="toolbar?.includes('heading')"
					show-arrow
					placement="bottom-start"
					:class="[{ active: viewClass !== 'preview' }]"
				>
					<template #activator="{ toggle }">
						<v-button
							v-tooltip="t('wysiwyg_options.heading')"
							:class="{ active: isActive('heading') }"
							:disabled="disabled"
							small
							icon
							@click="toggle"
						>
							<v-icon name="format_size" />
						</v-button>
					</template>
					<v-list>
						<v-list-item v-for="n in 6" :key="n" clickable @click="edit('heading', { level: n })">
							<v-list-item-content><v-text-overflow :text="t(`wysiwyg_options.h${n}`)" /></v-list-item-content>
							<v-list-item-hint>{{ translateShortcut(['meta', 'alt']) }} {{ n }}</v-list-item-hint>
						</v-list-item>
					</v-list>
				</v-menu>

				<v-button
					v-if="toolbar?.includes('bold')"
					v-tooltip="t('wysiwyg_options.bold') + ' - ' + translateShortcut(['meta', 'b'])"
					:class="{ active: isActive('bold') }"
					:disabled="disabled"
					small
					icon
					@click="edit('bold')"
				>
					<v-icon name="format_bold" />
				</v-button>
				<v-button
					v-if="toolbar?.includes('italic')"
					v-tooltip="t('wysiwyg_options.italic') + ' - ' + translateShortcut(['meta', 'i'])"
					:class="{ active: isActive('italic') }"
					:disabled="disabled"
					small
					icon
					@click="edit('italic')"
				>
					<v-icon name="format_italic" />
				</v-button>
				<v-button
					v-if="toolbar?.includes('strikethrough')"
					v-tooltip="t('wysiwyg_options.strikethrough') + ' - ' + translateShortcut(['meta', 'alt', 'd'])"
					:class="{ active: isActive('strikethrough') }"
					:disabled="disabled"
					small
					icon
					@click="edit('strikethrough')"
				>
					<v-icon name="format_strikethrough" />
				</v-button>
				<v-button
					v-if="toolbar?.includes('bullist')"
					v-tooltip="t('wysiwyg_options.bullist')"
					:class="{ active: isActive('listBulleted') }"
					:disabled="disabled"
					small
					icon
					@click="edit('listBulleted')"
				>
					<v-icon name="format_list_bulleted" />
				</v-button>
				<v-button
					v-if="toolbar?.includes('numlist')"
					v-tooltip="t('wysiwyg_options.numlist')"
					:class="{ active: isActive('listNumbered') }"
					:disabled="disabled"
					small
					icon
					@click="edit('listNumbered')"
				>
					<v-icon name="format_list_numbered" />
				</v-button>
				<v-button
					v-if="toolbar?.includes('blockquote')"
					v-tooltip="t('wysiwyg_options.blockquote') + ' - ' + translateShortcut(['meta', 'alt', 'q'])"
					:class="{ active: isActive('blockquote') }"
					:disabled="disabled"
					small
					icon
					@click="edit('blockquote')"
				>
					<v-icon name="format_quote" />
				</v-button>
				<v-button
					v-if="toolbar?.includes('code')"
					v-tooltip="t('wysiwyg_options.codeblock') + ' - ' + translateShortcut(['meta', 'alt', 'c'])"
					:class="{ active: isActive('code') }"
					:disabled="disabled"
					small
					icon
					@click="edit('code')"
				>
					<v-icon name="code" />
				</v-button>
				<v-menu
					v-if="toolbar?.includes('link') && mode === 'rich'"
					v-model="linkMenuOpen"
					show-arrow
					:close-on-content-click="false"
				>
					<template #activator>
						<v-button
							v-tooltip="t('wysiwyg_options.link') + ' - ' + translateShortcut(['meta', 'k'])"
							:class="{ active: isActive('link') }"
							:disabled="disabled"
							small
							icon
							@click="edit('link')"
						>
							<v-icon name="insert_link" />
						</v-button>
					</template>

					<div class="link-options">
						<div class="field full">
							<p class="type-label">{{ t('interfaces.input-rich-text-md.link_url') }}</p>
							<v-input v-model="linkHref" autofocus placeholder="https://" @keydown.enter.prevent="confirmLink" />
						</div>
						<div v-if="linkExisting" class="field half">
							<v-button full-width secondary @click="removeLink">{{ t('wysiwyg_options.unlink') }}</v-button>
						</div>
						<div class="field" :class="linkExisting ? 'half' : 'full'">
							<v-button full-width @click="confirmLink">{{ t('done') }}</v-button>
						</div>
					</div>
				</v-menu>
				<v-button
					v-else-if="toolbar?.includes('link')"
					v-tooltip="t('wysiwyg_options.link') + ' - ' + translateShortcut(['meta', 'k'])"
					:disabled="disabled"
					small
					icon
					@click="edit('link')"
				>
					<v-icon name="insert_link" />
				</v-button>

				<v-menu v-if="toolbar?.includes('table')" show-arrow :close-on-content-click="false">
					<template #activator="{ toggle }">
						<v-button
							v-tooltip="t('wysiwyg_options.table')"
							:class="{ active: isActive('table') }"
							:disabled="disabled"
							small
							icon
							@click="toggle"
						>
							<v-icon name="table_chart" />
						</v-button>
					</template>

					<template #default="{ deactivate }">
						<div class="table-options">
							<div class="field half">
								<p class="type-label">{{ t('rows') }}</p>
								<v-input v-model="table.rows" :min="1" type="number" />
							</div>
							<div class="field half">
								<p class="type-label">{{ t('columns') }}</p>
								<v-input v-model="table.columns" :min="1" type="number" />
							</div>
							<div class="field full">
								<v-button
									full-width
									@click="
										() => {
											edit('table', table);
											deactivate();
										}
									"
								>
									Create
								</v-button>
							</div>
						</div>
					</template>
				</v-menu>

				<v-button
					v-if="toolbar?.includes('image')"
					v-tooltip="t('wysiwyg_options.image')"
					:disabled="disabled"
					small
					icon
					@click="imageDialogOpen = true"
				>
					<v-icon name="insert_photo" />
				</v-button>

				<template v-if="mode === 'markdown'">
					<v-button
						v-for="custom in customSyntax"
						:key="custom.name"
						v-tooltip="custom.name"
						:disabled="disabled"
						small
						icon
						@click="edit('custom', custom)"
					>
						<v-icon :name="custom.icon" />
					</v-button>
				</template>
			</template>

			<div class="spacer"></div>

			<v-item-group v-if="mode === 'markdown'" v-model="view" class="view" mandatory rounded>
				<v-button x-small value="editor" :class="[{ active: view[0] !== 'preview' }]">
					{{ t('interfaces.input-rich-text-md.edit') }}
				</v-button>
				<v-button x-small value="preview" :class="[{ active: view[0] === 'preview' }]">
					{{ t('interfaces.input-rich-text-md.preview') }}
				</v-button>
			</v-item-group>

			<v-item-group v-if="modeSwitchShown" :model-value="[mode]" class="view mode" mandatory rounded>
				<v-button x-small value="rich" :class="[{ active: mode === 'rich' }]" @click="switchMode('rich')">
					{{ t('interfaces.input-rich-text-md.rich_text') }}
				</v-button>
				<v-button x-small value="markdown" :class="[{ active: mode === 'markdown' }]" @click="switchMode('markdown')">
					{{ t('interfaces.input-rich-text-md.markdown_mode') }}
				</v-button>
			</v-item-group>
		</div>

		<v-notice v-if="richTextUnavailable" type="info" class="rich-text-unavailable">
			{{ t('interfaces.input-rich-text-md.rich_text_unavailable') }}
		</v-notice>

		<rich-text-editor
			v-if="mode === 'rich'"
			ref="richEditor"
			:value="value"
			:disabled="disabled"
			:placeholder="placeholder"
			:font="editorFont"
			@input="onRichInput"
		/>

		<div v-show="mode === 'markdown'" ref="codemirrorEl"></div>
		<template v-if="softLength">
			<span
				class="remaining"
				:class="{
					warning: percRemaining < 10,
					danger: percRemaining < 5,
				}"
			>
				{{ softLength - count }}
			</span>
		</template>
		<div
			v-md="markdownString"
			class="preview-box"
			:style="viewClass === 'preview' ? 'display:block' : 'display:none'"
		></div>

		<v-dialog
			:model-value="imageDialogOpen"
			@esc="imageDialogOpen = false"
			@update:model-value="imageDialogOpen = false"
		>
			<v-card>
				<v-card-title>{{ t('upload_from_device') }}</v-card-title>
				<v-card-text>
					<v-upload from-url from-library :folder="folder" @input="onImageUpload" />
				</v-card-text>
				<v-card-actions>
					<v-button secondary @click="imageDialogOpen = false">{{ t('cancel') }}</v-button>
				</v-card-actions>
			</v-card>
		</v-dialog>
	</div>
</template>

<script lang="ts">
import { useI18n } from 'vue-i18n';
import { defineComponent, computed, ref, onMounted, watch, reactive, nextTick, PropType } from 'vue';

import CodeMirror from 'codemirror';
import 'codemirror/mode/markdown/markdown';
import 'codemirror/addon/display/placeholder.js';

import { applyEdit, CustomSyntax, Alteration } from './edits';
import {
	EditorMode,
	EditorModeOption,
	canSwitchTo,
	readStoredMode,
	resolveInitialMode,
	showModeSwitch,
	writeStoredMode,
} from './editor-mode';
import { isRepresentable } from './rich/markdown';
import RichTextEditor from './rich/rich-text-editor.vue';
import { getPublicURL } from '@/utils/get-root-path';
import { useShortcut } from '@/composables/use-shortcut';
import { translateShortcut } from '@/utils/translate-shortcut';
import { percentage } from '@/utils/percentage';
import { useWindowSize } from '@/composables/use-window-size';

/**
 * Alterations whose shortcut Tiptap's own keymap already applies while the Rich text editor has focus;
 * running them again from the interface shortcut would toggle them straight back.
 */
const RICH_KEYMAP_ALTERATIONS: Alteration[] = ['bold', 'italic', 'code', 'heading'];

export default defineComponent({
	components: { RichTextEditor },
	props: {
		value: {
			type: String,
			default: null,
		},
		disabled: {
			type: Boolean,
			default: false,
		},
		placeholder: {
			type: String,
			default: null,
		},
		editorFont: {
			type: String as PropType<'sans-serif' | 'serif' | 'monospace'>,
			default: 'sans-serif',
		},
		previewFont: {
			type: String as PropType<'sans-serif' | 'serif' | 'monospace'>,
			default: 'sans-serif',
		},
		toolbar: {
			type: Array as PropType<string[] | null>,
			default: () => [
				'heading',
				'bold',
				'italic',
				'strikethrough',
				'bullist',
				'numlist',
				'blockquote',
				'code',
				'link',
				'table',
				'image',
				'link',
				'empty',
			],
		},
		customSyntax: {
			type: Array as PropType<CustomSyntax[]>,
			default: () => [],
		},
		imageToken: {
			type: String,
			default: undefined,
		},
		softLength: {
			type: Number,
			default: undefined,
		},
		folder: {
			type: String,
			default: undefined,
		},
		editorMode: {
			type: String as PropType<EditorModeOption>,
			default: 'rich-and-markdown',
		},
	},
	emits: ['input'],
	setup(props, { emit }) {
		const { t } = useI18n();

		const { width } = useWindowSize();

		const markdownInterface = ref<HTMLElement>();
		const codemirrorEl = ref<HTMLTextAreaElement>();
		let codemirror: CodeMirror.Editor | null = null;
		let previousContent: string | null = null;

		const view = ref(['editor']);

		const richEditor = ref<InstanceType<typeof RichTextEditor>>();

		const initialMode = resolveInitialMode({
			option: props.editorMode,
			stored: readStoredMode(),
			representable: isRepresentable(props.value ?? ''),
		});

		const mode = ref<EditorMode>(initialMode.mode);
		const richTextUnavailable = ref(initialMode.fellBack);
		const modeSwitchShown = computed(() => showModeSwitch(props.editorMode));

		const viewClass = computed(() => (mode.value === 'markdown' && view.value[0] === 'preview' ? 'preview' : 'editor'));

		const linkMenuOpen = ref(false);
		const linkHref = ref('');
		// Whether the link popover edits a link that already exists at the cursor
		const linkExisting = ref(false);

		// Markdown the Rich text editor emitted last, known to be representable
		let lastRichEmit: string | null = null;

		// Sync, so an unrepresentable external value (revision restore, discarded edits) switches to Markdown
		// before the Rich text editor ever receives it and holds a lossy document.
		watch(
			() => props.value,
			(newValue) => {
				if (mode.value !== 'rich' || newValue === lastRichEmit) return;
				if (isRepresentable(newValue ?? '')) return;

				mode.value = 'markdown';
				richTextUnavailable.value = true;
				nextTick(() => codemirror?.refresh());
			},
			{ flush: 'sync' }
		);

		const imageDialogOpen = ref(false);

		let count = ref(0);

		const readOnly = computed(() => {
			if (width.value < 600) {
				// mobile requires 'nocursor' to avoid bringing up the keyboard
				return props.disabled ? 'nocursor' : false;
			} else {
				// desktop cannot use 'nocursor' as it prevents copy/paste
				return props.disabled;
			}
		});

		onMounted(async () => {
			if (codemirrorEl.value) {
				codemirror = CodeMirror(codemirrorEl.value, {
					mode: 'markdown',
					configureMouse: () => ({ addNew: false }),
					lineWrapping: true,
					readOnly: readOnly.value,
					cursorBlinkRate: props.disabled ? -1 : 530,
					placeholder: props.placeholder,
					value: props.value || '',
					spellcheck: true,
					inputStyle: 'contenteditable',
				});

				codemirror.on('change', (cm, { origin }) => {
					const content = cm.getValue();

					// prevent duplicate emits with same content
					if (content === previousContent) return;
					previousContent = content;

					if (origin === 'setValue') return;

					emit('input', content);
				});
			}

			if (markdownInterface.value) {
				const previewBox = markdownInterface.value.getElementsByClassName('preview-box')[0];

				const observer = new MutationObserver(() => {
					count.value = previewBox.textContent?.replace('\n', '')?.length ?? 0;
				});

				const config = { characterData: true, childList: true, subtree: true };

				observer.observe(previewBox, config);
			}
		});

		watch(
			() => props.value,
			(newValue) => {
				if (!codemirror) return;

				const existingValue = codemirror.getValue();

				if (existingValue !== newValue) {
					codemirror.setValue('');
					codemirror.clearHistory();
					codemirror.setValue(newValue ?? '');
					codemirror.refresh();
				}
			}
		);

		watch(
			() => props.disabled,
			(disabled) => {
				codemirror?.setOption('readOnly', readOnly.value);
				codemirror?.setOption('cursorBlinkRate', disabled ? -1 : 530);
			},
			{ immediate: true }
		);

		const editFamily = computed(() => {
			return `var(--family-${props.editorFont})`;
		});

		const previewFamily = computed(() => {
			return `var(--family-${props.previewFont})`;
		});

		const markdownString = computed(() => {
			return props.value || '';
		});

		const table = reactive({
			rows: 4,
			columns: 4,
		});

		const percRemaining = computed(() => percentage(count.value, props.softLength) ?? 100);
		useShortcut('meta+b', () => shortcut('bold'), markdownInterface);
		useShortcut('meta+i', () => shortcut('italic'), markdownInterface);
		useShortcut('meta+k', () => shortcut('link'), markdownInterface);
		useShortcut('meta+alt+d', () => shortcut('strikethrough'), markdownInterface);
		useShortcut('meta+alt+q', () => shortcut('blockquote'), markdownInterface);
		useShortcut('meta+alt+c', () => shortcut('code'), markdownInterface);
		useShortcut('meta+alt+1', () => shortcut('heading', { level: 1 }), markdownInterface);
		useShortcut('meta+alt+2', () => shortcut('heading', { level: 2 }), markdownInterface);
		useShortcut('meta+alt+3', () => shortcut('heading', { level: 3 }), markdownInterface);
		useShortcut('meta+alt+4', () => shortcut('heading', { level: 4 }), markdownInterface);
		useShortcut('meta+alt+5', () => shortcut('heading', { level: 5 }), markdownInterface);
		useShortcut('meta+alt+6', () => shortcut('heading', { level: 6 }), markdownInterface);

		return {
			t,
			percRemaining,
			count,
			codemirrorEl,
			edit,
			view,
			markdownString,
			table,
			onImageUpload,
			imageDialogOpen,
			useShortcut,
			translateShortcut,
			markdownInterface,
			editFamily,
			previewFamily,
			richEditor,
			mode,
			modeSwitchShown,
			richTextUnavailable,
			viewClass,
			switchMode,
			isActive,
			linkMenuOpen,
			linkHref,
			linkExisting,
			confirmLink,
			removeLink,
			onRichInput,
		};

		function onRichInput(markdown: string) {
			lastRichEmit = markdown;
			emit('input', markdown);
		}

		function onImageUpload(image: any) {
			let url = getPublicURL() + `assets/` + image.id;

			if (props.imageToken) {
				url += '?access_token=' + props.imageToken;
			}

			if (mode.value === 'rich') {
				richEditor.value?.insertImage(url, '');
			} else if (codemirror) {
				codemirror.replaceSelection(`![${codemirror.getSelection()}](${url})`);
			}

			imageDialogOpen.value = false;
		}

		function edit(type: Alteration, options?: Record<string, any>) {
			if (mode.value === 'rich') {
				if (props.disabled) return;
				if (type === 'link') toggleLinkMenu();
				else richEditor.value?.run(type, options);
				return;
			}

			if (codemirror) {
				applyEdit(codemirror, type, options);
			}
		}

		function shortcut(type: Alteration, options?: Record<string, any>) {
			if (
				mode.value === 'rich' &&
				RICH_KEYMAP_ALTERATIONS.includes(type) &&
				richEditor.value?.$el.contains(document.activeElement)
			) {
				return;
			}

			edit(type, options);
		}

		function isActive(type: Alteration, options?: Record<string, any>): boolean {
			return mode.value === 'rich' && !!richEditor.value?.isActive(type, options);
		}

		function toggleLinkMenu() {
			if (linkMenuOpen.value) {
				linkMenuOpen.value = false;
				return;
			}

			linkHref.value = richEditor.value?.getSelectedLink() ?? '';
			linkExisting.value = !!richEditor.value?.isActive('link');
			linkMenuOpen.value = true;
		}

		function confirmLink() {
			richEditor.value?.run('link', { href: linkHref.value.trim() });
			linkMenuOpen.value = false;
		}

		function removeLink() {
			richEditor.value?.run('link', {});
			linkMenuOpen.value = false;
		}

		function switchMode(target: EditorMode) {
			if (target === mode.value) return;

			const representable = target === 'rich' ? isRepresentable(props.value ?? '') : true;

			if (!canSwitchTo(target, { option: props.editorMode, representable })) {
				if (target === 'rich') richTextUnavailable.value = true;
				return;
			}

			mode.value = target;
			writeStoredMode(target);

			if (target === 'rich') {
				richTextUnavailable.value = false;
			} else {
				nextTick(() => codemirror?.refresh());
			}
		}
	},
});
</script>

<style lang="scss" scoped>
@import '@/styles/mixins/form-grid';

.interface-input-rich-text-md {
	--v-button-background-color: transparent;
	--v-button-color: var(--foreground-normal);
	--v-button-background-color-hover: var(--border-normal);
	--v-button-color-hover: var(--foreground-normal);

	min-height: 300px;
	overflow: hidden;
	font-family: var(--family-sans-serif);
	border: 2px solid var(--border-normal);
	border-radius: var(--border-radius);
}

.interface-input-rich-text-md.disabled {
	background-color: var(--background-subdued);
}

.interface-input-rich-text-md:not(.disabled):focus-within {
	border-color: var(--primary);
	box-shadow: 0 0 16px -8px var(--primary);
}

textarea {
	display: none;
}

.preview-box {
	display: none;
	padding: 20px;
}

.preview-box :deep(h1) {
	margin-top: 1em;
	margin-bottom: 0;
	color: var(--foreground-normal-alt);
	font-weight: 700;
	font-size: 36px;
	font-family: v-bind(previewFamily), serif;
	line-height: 46px;
}

.preview-box :deep(h2) {
	margin-top: 1.25em;
	margin-bottom: 0;
	color: var(--foreground-normal-alt);
	font-weight: 700;
	font-size: 24px;
	font-family: v-bind(previewFamily), serif;
	line-height: 34px;
}

.preview-box :deep(h3) {
	margin-top: 1.25em;
	margin-bottom: 0;
	color: var(--foreground-normal-alt);
	font-weight: 700;
	font-size: 19px;
	font-family: v-bind(previewFamily), serif;
	line-height: 29px;
}

.preview-box :deep(h4) {
	margin-top: 1.5em;
	margin-bottom: 0;
	color: var(--foreground-normal-alt);
	font-weight: 700;
	font-size: 16px;
	font-family: v-bind(previewFamily), serif;
	line-height: 26px;
}

.preview-box :deep(h5) {
	margin-top: 2em;
	margin-bottom: 0;
	color: var(--foreground-normal-alt);
	font-weight: 700;
	font-size: 14px;
	font-family: v-bind(previewFamily), serif;
	line-height: 24px;
}

.preview-box :deep(h6) {
	margin-top: 2em;
	margin-bottom: 0;
	color: var(--foreground-normal-alt);
	font-weight: 700;
	font-size: 12px;
	font-family: v-bind(previewFamily), serif;
	line-height: 22px;
}

.preview-box :deep(p) {
	margin: 1.5em 0;
	font-weight: 500;
	font-size: 15px;
	font-family: v-bind(previewFamily), serif;
	line-height: 24px;
}

.preview-box :deep(a) {
	color: var(--primary-125);
	text-decoration: none;
}

.preview-box :deep(ul),
.preview-box :deep(ol) {
	margin: 1.5em 0;
	font-weight: 500;
	font-size: 15px;
	font-family: v-bind(previewFamily), serif;
	line-height: 24px;
}

.remaining {
	position: absolute;
	right: 10px;
	bottom: 5px;
	color: var(--foreground-subdued);
	font-weight: 600;
	text-align: right;
	vertical-align: middle;
	font-feature-settings: 'tnum';
}

.warning {
	color: var(--warning);
}

.danger {
	color: var(--danger);
}

.preview-box :deep(ul ul),
.preview-box :deep(ol ol),
.preview-box :deep(ul ol),
.preview-box :deep(ol ul) {
	margin: 0;
}

.preview-box :deep(b),
.preview-box :deep(strong) {
	font-weight: 700;
}

.preview-box :deep(code) {
	padding: 2px 4px;
	font-weight: 500;
	font-size: 15px;
	font-family: var(--family-monospace), monospace;
	line-height: 24px;
	overflow-wrap: break-word;
	background-color: var(--background-normal);
	border-radius: var(--border-radius);
}

.preview-box :deep(pre) {
	padding: 1em;
	overflow: auto;
	font-weight: 500;
	font-size: 15px;
	font-family: var(--family-monospace), monospace;
	line-height: 24px;
	background-color: var(--background-normal);
	border-radius: var(--border-radius);
}

.preview-box :deep(blockquote) {
	margin-left: 0px;
	padding-left: 1em;
	font-weight: 500;
	font-size: 15px;
	font-family: v-bind(previewFamily), serif;
	line-height: 24px;
	border-left: 2px solid var(--border-normal);
}

.preview-box :deep(blockquote blockquote) {
	margin-left: 10px;
}

.preview-box :deep(video),
.preview-box :deep(iframe),
.preview-box :deep(img) {
	max-width: 100%;
	height: auto;
	border-radius: var(--border-radius);
}

.preview-box :deep(hr) {
	height: 1px;
	margin-top: 2em;
	margin-bottom: 2em;
	background-color: var(--border-normal);
	border: none;
}

.preview-box :deep(table) {
	font-weight: 500;
	font-size: 15px;
	line-height: 24px;
	border-collapse: collapse;
}

.preview-box :deep(table th),
.preview-box :deep(table td) {
	padding: 0.4rem;
	border: 1px solid var(--border-normal);
}

.preview-box :deep(figure) {
	display: table;
	margin: 1rem auto;
}

.preview-box :deep(figure figcaption) {
	display: block;
	margin-top: 0.25rem;
	color: #999;
	text-align: center;
}

.interface-input-rich-text-md.disabled .preview-box {
	color: var(--foreground-subdued);
}

.interface-input-rich-text-md :deep(.CodeMirror) {
	font-family: v-bind(editFamily), sans-serif;
	border: none;
	border-radius: 0;
	box-shadow: none;
}

.interface-input-rich-text-md :deep(.CodeMirror .CodeMirror-lines) {
	padding: 0 20px;
}

.interface-input-rich-text-md :deep(.CodeMirror .CodeMirror-lines:first-of-type) {
	margin-top: 20px;
}

.interface-input-rich-text-md :deep(.CodeMirror .CodeMirror-lines:last-of-type) {
	margin-bottom: 20px;
}

.interface-input-rich-text-md :deep(.CodeMirror .CodeMirror-scroll) {
	min-height: 260px;
}

.interface-input-rich-text-md.preview :deep(.CodeMirror) {
	display: none;
}

.toolbar {
	--v-button-background-color-active: var(--border-normal);
	--v-button-color-active: var(--foreground-normal);

	display: flex;
	flex-wrap: wrap;
	align-items: center;
	min-height: 40px;
	padding: 0 4px;
	background-color: var(--background-subdued);
	border-bottom: 2px solid var(--border-normal);

	.v-button + .v-button {
		margin-left: 2px;
	}

	.spacer {
		flex-grow: 1;
	}

	.view {
		--v-button-background-color: var(--border-subdued);
		--v-button-color: var(--foreground-subdued);
		--v-button-background-color-hover: var(--border-normal);
		--v-button-color-hover: var(--foreground-normal);
		--v-button-background-color-active: var(--border-normal);
		--v-button-color-active: var(--foreground-normal);
	}
}

.rich-text-unavailable {
	margin: 12px 20px 0;
}

.link-options,
.table-options {
	@include form-grid;

	--form-vertical-gap: 12px;
	--form-horizontal-gap: 12px;

	padding: 12px;

	.v-input {
		min-width: 100px;
	}
}

.link-options .v-input {
	min-width: 240px;
}
</style>
