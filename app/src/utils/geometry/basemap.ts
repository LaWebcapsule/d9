import type { RasterSourceSpecification, RequestTransformFunction, StyleSpecification } from 'maplibre-gl';
import { getTheme } from '@/utils/get-theme';
import { useSettingsStore } from '@/stores/settings';

export type BasemapSource = {
	name: string;
	type: 'raster' | 'tile' | 'style';
	url: string;
	tileSize?: number;
	attribution?: string;
};

const defaultBasemap: BasemapSource = {
	name: 'OpenStreetMap',
	type: 'raster',
	url: 'https://{a-c}.tile.openstreetmap.org/{z}/{x}/{y}.png',
	tileSize: 256,
	attribution: '© OpenStreetMap contributors',
};

const glyphs = 'https://fonts.openmaptiles.org/{fontstack}/{range}.pbf';

export function getBasemapSources(): BasemapSource[] {
	const settingsStore = useSettingsStore();

	if (settingsStore.settings?.mapbox_key) {
		return [getDefaultMapboxBasemap(), defaultBasemap, ...(settingsStore.settings?.basemaps || [])];
	}

	return [defaultBasemap, ...(settingsStore.settings?.basemaps || [])];
}

export function getStyleFromBasemapSource(basemap: BasemapSource): StyleSpecification | string {
	if (basemap.type == 'style') {
		return basemap.url;
	} else {
		const source: RasterSourceSpecification = { type: 'raster' };
		if (basemap.attribution) source.attribution = basemap.attribution;

		if (basemap.type == 'raster') {
			source.tiles = expandUrl(basemap.url);
			source.tileSize = basemap.tileSize || 512;
		}

		if (basemap.type == 'tile') {
			source.url = basemap.url;
		}

		return {
			version: 8,
			glyphs,
			layers: [{ id: basemap.name, source: basemap.name, type: 'raster' }],
			sources: { [basemap.name]: source },
		};
	}
}

function expandUrl(url: string): string[] {
	const urls = [];
	let match = /\{([a-z])-([a-z])\}/.exec(url);

	if (match) {
		// char range
		const startCharCode = match[1].charCodeAt(0);
		const stopCharCode = match[2].charCodeAt(0);
		let charCode;

		for (charCode = startCharCode; charCode <= stopCharCode; ++charCode) {
			urls.push(url.replace(match[0], String.fromCharCode(charCode)));
		}

		return urls;
	}

	match = /\{(\d+)-(\d+)\}/.exec(url);

	if (match) {
		// number range
		const stop = parseInt(match[2], 10);

		for (let i = parseInt(match[1], 10); i <= stop; i++) {
			urls.push(url.replace(match[0], i.toString()));
		}

		return urls;
	}

	match = /\{(([a-z0-9]+)(,([a-z0-9]+))+)\}/.exec(url);

	if (match) {
		// csv
		const subdomains = match[1].split(',');

		for (const subdomain of subdomains) {
			urls.push(url.replace(match[0], subdomain));
		}

		return urls;
	}

	urls.push(url);
	return urls;
}

const mapboxApi = 'https://api.mapbox.com';

/**
 * maplibre-gl doesn't resolve mapbox:// URLs (styles, sprites, fonts, tilesets), so they're rewritten
 * to the Mapbox API, and requests to the Mapbox API get the access token
 */
export function getMapboxTransformRequest(accessToken?: string | null): RequestTransformFunction | undefined {
	if (!accessToken) return undefined;

	return (url) => {
		const resolved = url.startsWith('mapbox://') ? resolveMapboxUrl(url.slice('mapbox://'.length)) : url;

		if (!resolved.startsWith(`${mapboxApi}/`) || /[?&]access_token=/.test(resolved)) {
			return { url: resolved };
		}

		const separator = resolved.includes('?') ? '&' : '?';
		return { url: `${resolved}${separator}access_token=${encodeURIComponent(accessToken)}` };
	};
}

/**
 * Same rules as mapbox-gl's URL normalization. Unknown forms are left untouched,
 * so the failing request shows the original URL.
 */
function resolveMapboxUrl(path: string): string {
	if (path.startsWith('styles/')) return `${mapboxApi}/styles/v1/${path.slice('styles/'.length)}`;
	if (path.startsWith('fonts/')) return `${mapboxApi}/fonts/v1/${path.slice('fonts/'.length)}`;
	if (path.startsWith('tiles/')) return `${mapboxApi}/v4/${path.slice('tiles/'.length)}`;

	if (path.startsWith('sprites/')) {
		// maplibre-gl appends the sprite suffix (@2x, .json, .png), which goes after "sprite" in the API URL
		const match = /^sprites\/(.+?)((?:@\dx)?\.(?:json|png))(\?.*)?$/.exec(path);
		if (match) return `${mapboxApi}/styles/v1/${match[1]}/sprite${match[2]}${match[3] ?? ''}`;
	}

	// Comma-separated tileset ids, e.g. mapbox.mapbox-streets-v8,mapbox.mapbox-terrain-v2
	if (/^[\w.-]+(,[\w.-]+)*$/.test(path)) return `${mapboxApi}/v4/${path}.json?secure`;

	return `mapbox://${path}`;
}

function getDefaultMapboxBasemap(): BasemapSource {
	const defaultMapboxBasemap: BasemapSource = {
		name: 'Mapbox',
		type: 'style',
		url: 'mapbox://styles/directus/cktaiz31c509n18nrxj63zdy6',
	};

	if (getTheme() === 'dark') {
		defaultMapboxBasemap.url = 'mapbox://styles/directus/cl0bombrr001115taz5ilsynw';
	}

	return defaultMapboxBasemap;
}
