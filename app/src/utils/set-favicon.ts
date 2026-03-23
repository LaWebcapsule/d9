import { cssVar } from '@wbce-d9/utils/browser';

const svg = (color: string, hide: boolean) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
	<style>
		circle {
			fill: ${color};
		}
	</style>

	<circle cx="100" cy="100" r="100"/>

	${
		hide
			? ''
			: '<g transform="translate(10,10) scale(0.249)">' +
			  '<path d="M327 127.671C411.057 127.671 485.425 169.156 530.747 232.769C529.512 264.098 526.597 292.835 521.935 319.321C527.409 337.706 530.349 357.182 530.349 377.345C530.349 435.992 505.477 488.828 465.708 525.887C505.273 488.844 530 436.146 530 377.671C530 265.557 439.114 174.671 327 174.671C214.886 174.671 124 265.557 124 377.671C124 489.785 214.886 580.671 327 580.671C328.852 580.671 330.697 580.645 332.537 580.596C310.132 593.405 285.362 605.696 258 617.6C280.02 623.944 303.287 627.345 327.349 627.345C393.512 627.345 453.671 601.642 498.389 559.678C453.636 601.836 393.335 627.671 327 627.671C188.929 627.671 77 515.742 77 377.671C77 239.6 188.929 127.671 327 127.671ZM364.049 611.172L361.714 612.56C363.275 611.636 364.826 610.709 366.368 609.779C365.597 610.244 364.824 610.709 364.049 611.172ZM465.708 525.887C430.668 558.692 383.991 579.218 332.537 580.596C332.732 580.484 332.928 580.374 333.122 580.263C384.312 578.833 430.762 558.451 465.708 525.887ZM530.778 232C560.094 272.958 577.349 323.136 577.349 377.345C577.349 449.253 546.989 514.07 498.389 559.678C546.786 514.087 577 449.407 577 377.671C577 323.657 559.87 273.645 530.747 232.769C530.757 232.513 530.768 232.256 530.778 232ZM327 227.671C409.843 227.671 477 294.828 477 377.671C477 460.514 409.843 527.671 327 527.671C244.157 527.671 177 460.514 177 377.671C177 294.828 244.157 227.671 327 227.671Z" fill="#FFF"/>' +
			  '<path d="M571.2 125.908C554.448 -163.157 597.585 141.142 597.585 141.142C661.5 570 661.5 570 287.921 677.496C287.921 677.496 12.4233 766.63 261.535 662.262C510.647 557.894 587.951 414.973 571.2 125.908Z" fill="#FFF"/>' +
			  '</g>'
	}
</svg>`;

export function setFavicon(color: string | null | undefined, hide = false): void {
	color = color || cssVar('--primary');

	const icon = svg(color, hide);
	const wrapper = document.createElement('div');
	wrapper.innerHTML = icon.trim();

	if (wrapper.firstChild) {
		const iconSerialized = new XMLSerializer().serializeToString(wrapper.firstChild);

		const string = 'data:image/svg+xml;base64,' + window.btoa(iconSerialized);

		const link: HTMLLinkElement = document.querySelector("link[rel*='icon']") || document.createElement('link');
		link.type = 'image/x-icon';
		link.rel = 'icon';
		link.href = string;
		document.getElementsByTagName('head')[0].appendChild(link);
	}
}
