import { computed, ref, Ref } from 'vue';
import { useEventListener } from './use-event-listener';
import { useLocalStorage } from './use-local-storage';

export type PanelResizeOptions = {
	/** Edge of the panel that holds the handle: 'right' for a panel on the left of the screen, 'left' for one on the right */
	edge: 'left' | 'right';
	defaultWidth: number;
	/** The panel stops shrinking at this width */
	minWidth: number;
	/** Recomputed by the caller from the window and the other panels; wins over minWidth only when larger */
	maxWidth: Ref<number>;
	/** Local storage key for the chosen width (removed when it equals the default) */
	storageKey: string;
	/** Widths this many px or less from the default snap to it */
	snap?: number;
	/**
	 * Collapse the panel when it is dragged smaller than its minimum and the pointer comes within `threshold` px of the panel's
	 * outer edge. The width from before the drag is kept for the next time the panel opens.
	 */
	collapse?: { threshold: number; onCollapse: () => void };
};

export type UsablePanelResize = {
	/** Current width, within the min/max limits */
	width: Ref<number>;
	dragging: Ref<boolean>;
	onPointerDown: (event: PointerEvent) => void;
	reset: () => void;
};

export function usePanelResize(options: PanelResizeOptions): UsablePanelResize {
	const { edge, defaultWidth, minWidth, maxWidth, storageKey, snap = 0, collapse } = options;

	const { data: storedWidth } = useLocalStorage(storageKey);

	// Width the user chose; shown smaller while the window does not leave room for it
	const chosenWidth = ref<number>(
		typeof storedWidth.value === 'number' && !Number.isNaN(storedWidth.value) ? storedWidth.value : defaultWidth
	);

	const width = computed(() => Math.max(minWidth, Math.min(chosenWidth.value, maxWidth.value)));

	const dragging = ref(false);
	let dragStartX = 0;
	let dragStartWidth = 0;
	let collapsedDuringDrag = false;
	let rafId: number | null = null;
	let lastPointerX = 0;

	useEventListener(window, 'pointermove', onPointerMove);
	useEventListener(window, 'pointerup', onPointerUp);

	return { width, dragging, onPointerDown, reset };

	function onPointerDown(event: PointerEvent) {
		dragging.value = true;
		collapsedDuringDrag = false;
		dragStartX = event.pageX;
		dragStartWidth = width.value;
		lastPointerX = event.pageX;
	}

	function reset() {
		chosenWidth.value = defaultWidth;
		save();
	}

	function onPointerMove(event: PointerEvent) {
		if (!dragging.value || collapsedDuringDrag) return;

		lastPointerX = event.pageX;

		if (rafId === null) {
			rafId = window.requestAnimationFrame(() => {
				rafId = null;
				applyPointer();
			});
		}
	}

	function applyPointer() {
		if (collapsedDuringDrag) return;

		const delta = edge === 'right' ? lastPointerX - dragStartX : dragStartX - lastPointerX;
		// Also the distance between the pointer and the panel's outer edge
		let newWidth = Math.round(dragStartWidth + delta);

		if (collapse && newWidth < collapse.threshold) {
			collapsedDuringDrag = true;
			chosenWidth.value = dragStartWidth;
			save();
			collapse.onCollapse();
			return;
		}

		newWidth = Math.max(minWidth, Math.min(newWidth, maxWidth.value));
		if (Math.abs(newWidth - defaultWidth) <= snap) newWidth = defaultWidth;

		chosenWidth.value = newWidth;
	}

	function onPointerUp() {
		if (!dragging.value) return;

		// Apply the last move, which may still wait for its animation frame
		if (rafId !== null) {
			window.cancelAnimationFrame(rafId);
			rafId = null;
			applyPointer();
		}

		dragging.value = false;

		if (!collapsedDuringDrag) save();

		// The click that follows the drag must not reach the panel (a closed sidebar opens on click)
		window.addEventListener('click', stopClick, { capture: true, once: true });
		setTimeout(() => window.removeEventListener('click', stopClick, { capture: true }));
	}

	function save() {
		storedWidth.value = chosenWidth.value === defaultWidth ? null : chosenWidth.value;
	}
}

function stopClick(event: MouseEvent) {
	event.stopPropagation();
}
