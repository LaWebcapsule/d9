import { mount } from '@vue/test-utils';
import { GlobalMountOptions } from '@vue/test-utils/dist/types';
import { beforeEach, expect, test, vi } from 'vitest';

import { directive } from '@/directives/click-outside';
import TransitionBounce from './transition/bounce.vue';
import VMenu from './v-menu.vue';

beforeEach(() => {
	// create teleport target
	const el = document.createElement('div');
	el.id = 'menu-outlet';
	document.body.appendChild(el);

	// mocking this as it seems like there's observer undefined error in happy-dom
	// but it is not crucial for the current test cases at the moment
	vi.spyOn(MutationObserver.prototype, 'disconnect').mockResolvedValue();
});

const global: GlobalMountOptions = {
	directives: {
		'click-outside': directive as any,
	},
	components: {
		TransitionBounce,
	},
};

// Vue keeps the listeners it attached to an element under a private `_vei` symbol
function getListeners(element: Element): Record<string, unknown> | undefined {
	const key = Object.getOwnPropertySymbols(element).find((symbol) => symbol.description === '_vei');
	return key && Reflect.get(element, key);
}

test('Mount component', () => {
	expect(VMenu).toBeTruthy();

	const wrapper = mount(VMenu, {
		slots: {
			default: 'Slot Content',
		},
		global,
	});

	expect(wrapper.html()).toMatchSnapshot();
});

test('should not have click event listener when trigger is not "click"', () => {
	const wrapper = mount(VMenu, {
		global,
	});

	const vMenuListeners = getListeners(wrapper.find('.v-menu').element);
	expect(vMenuListeners).toBeUndefined();
});

test('should have click event listener when trigger is "click"', () => {
	const wrapper = mount(VMenu, {
		props: {
			trigger: 'click',
		},
		global,
	});

	const vMenuListeners = getListeners(wrapper.find('.v-menu').element);
	expect(vMenuListeners).toHaveProperty('onClick');
});

test('should not have click event listener when closeOnContentClick prop is false', () => {
	const wrapper = mount(VMenu, {
		props: {
			modelValue: true, // make it open in the beginning to ensure '.v-menu-content' is in the dom
			closeOnContentClick: false,
		},
		global,
	});

	const vMenuContentListeners = getListeners(wrapper.getComponent(TransitionBounce).find('.v-menu-content').element);
	expect(vMenuContentListeners).toBeUndefined();
});

test('should have click event listener when closeOnContentClick prop is true', () => {
	const wrapper = mount(VMenu, {
		props: {
			modelValue: true, // make it open in the beginning to ensure '.v-menu-content' is in the dom
			closeOnContentClick: true,
		},
		global,
	});

	const vMenuContentListeners = getListeners(wrapper.getComponent(TransitionBounce).find('.v-menu-content').element);
	expect(vMenuContentListeners).toHaveProperty('onClick');
});

test('should not have pointerenter and pointerleave event listener when trigger is not "hover"', () => {
	const wrapper = mount(VMenu, {
		props: {
			modelValue: true, // make it open in the beginning to ensure '.v-menu-content' is in the dom
		},
		global,
	});

	const activatorListeners = getListeners(wrapper.find({ ref: 'activator' }).element);
	expect(activatorListeners).toBeUndefined();
	expect(activatorListeners).toBeUndefined();

	// we need to use getComponent because it's teleported
	const vMenuContentListeners = getListeners(wrapper.getComponent(TransitionBounce).find('.v-menu-content').element);
	expect(vMenuContentListeners).not.toHaveProperty('onPointerenter');
	expect(vMenuContentListeners).not.toHaveProperty('onPointerleave');
});

test('should have pointerenter and pointerleave event listener when trigger is "hover"', () => {
	const wrapper = mount(VMenu, {
		props: {
			modelValue: true, // make it open in the beginning to ensure '.v-menu-content' is in the dom
			trigger: 'hover',
		},
		global,
	});

	const activatorListeners = getListeners(wrapper.find({ ref: 'activator' }).element);
	expect(activatorListeners).toHaveProperty('onPointerenter');
	expect(activatorListeners).toHaveProperty('onPointerleave');

	// we need to use getComponent because it's teleported
	const vMenuContentListeners = getListeners(wrapper.getComponent(TransitionBounce).find('.v-menu-content').element);
	expect(vMenuContentListeners).toHaveProperty('onPointerenter');
	expect(vMenuContentListeners).toHaveProperty('onPointerleave');
});
