import { expect, test } from 'vitest';
import iface from './index';
import mail from '../../operations/mail/index';
import notification from '../../operations/notification/index';

test('editorMode option with three choices, default rich-and-markdown', () => {
	const opt = (iface.options as any).standard.find((o: any) => o.field === 'editorMode');
	expect(opt.schema.default_value).toBe('rich-and-markdown');

	expect(opt.meta.options.choices.map((c: any) => c.value)).toEqual([
		'rich-and-markdown',
		'rich-only',
		'markdown-only',
	]);
});

test('flow operations pin markdown-only', () => {
	const mailBody = (mail.options as any)({ type: 'markdown' }).find(
		(f: any) => f.meta?.interface === 'input-rich-text-md'
	);

	expect(mailBody.meta.options.editorMode).toBe('markdown-only');
	const notif = (notification.options as any[]).find((f: any) => f.meta?.interface === 'input-rich-text-md');
	expect(notif.meta.options.editorMode).toBe('markdown-only');
});

test('component loads asynchronously, keeping the editor out of the entry chunk', () => {
	expect(iface.component).toHaveProperty('__asyncLoader');
});
