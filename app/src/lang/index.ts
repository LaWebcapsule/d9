import { RequestError } from '@/api';
import { compile } from '@intlify/core-base';
import { createI18n, I18nOptions, MessageCompiler } from 'vue-i18n';
import availableLanguages from './available-languages.yaml';
import datetimeFormats from './date-formats.yaml';
import numberFormats from './number-formats.yaml';
import enUSBase from './translations/en-US.yaml';

// Renders a message that doesn't compile (such as an email address, read as a linked message, in a
// translation string set by an admin) as is, instead of throwing
const messageCompiler: MessageCompiler = (message, context) => {
	let failed = false;
	const render = compile(message, { ...context, onError: () => (failed = true) });

	return failed && typeof message === 'string' ? () => message : render;
};

export const i18n = createI18n({
	messageCompiler,
	legacy: false,
	locale: 'en-US',
	fallbackLocale: 'en-US',
	messages: {
		'en-US': enUSBase,
	} as I18nOptions['messages'],
	silentTranslationWarn: true,
	datetimeFormats,
	numberFormats,
});

export type Language = keyof typeof availableLanguages;

export const loadedLanguages: Language[] = ['en-US'];

export function translateAPIError(error: RequestError | string): string {
	const defaultMsg = i18n.global.t('unexpected_error');

	let code = error;

	if (typeof error === 'object') {
		code = error?.response?.data?.errors?.[0]?.extensions?.code;
	}

	if (!error) return defaultMsg;
	if (code === undefined) return defaultMsg;
	const key = `errors.${code}`;

	const exists = i18n.global.te(key);
	if (exists === false) return defaultMsg;
	return i18n.global.t(key);
}
