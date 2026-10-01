import { setWorkerUrl } from 'maplibre-gl';
// maplibre-gl resolves its worker relative to import.meta.url, which Vite can't follow once bundled.
// ?worker makes Vite emit the worker together with the chunk it imports.
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';

setWorkerUrl(workerUrl);
