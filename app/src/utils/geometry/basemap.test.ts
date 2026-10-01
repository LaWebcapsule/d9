import { test, expect } from 'vitest';
import { getMapboxTransformRequest, getStyleFromBasemapSource } from '@/utils/geometry/basemap';

const transform = getMapboxTransformRequest('pk.test')!;

test('Returns undefined without access token', () => {
	expect(getMapboxTransformRequest(undefined)).toBeUndefined();
	expect(getMapboxTransformRequest(null)).toBeUndefined();
});

test('Leaves non mapbox:// URLs untouched', () => {
	expect(transform('https://tile.openstreetmap.org/1/2/3.png', 'Tile' as any)).toEqual({
		url: 'https://tile.openstreetmap.org/1/2/3.png',
	});
});

test('Resolves mapbox:// styles', () => {
	expect(transform('mapbox://styles/directus/cktaiz31c509n18nrxj63zdy6', 'Style' as any)).toEqual({
		url: 'https://api.mapbox.com/styles/v1/directus/cktaiz31c509n18nrxj63zdy6?access_token=pk.test',
	});
});

test('Resolves mapbox:// sprites', () => {
	expect(transform('mapbox://sprites/directus/cktaiz31c509n18nrxj63zdy6@2x.json', 'SpriteJSON' as any)).toEqual({
		url: 'https://api.mapbox.com/styles/v1/directus/cktaiz31c509n18nrxj63zdy6/sprite@2x.json?access_token=pk.test',
	});

	expect(transform('mapbox://sprites/directus/cktaiz31c509n18nrxj63zdy6.png', 'SpriteImage' as any)).toEqual({
		url: 'https://api.mapbox.com/styles/v1/directus/cktaiz31c509n18nrxj63zdy6/sprite.png?access_token=pk.test',
	});
});

test('Resolves mapbox:// sprites with a revision segment', () => {
	expect(transform('mapbox://sprites/directus/cktaiz31c509n18nrxj63zdy6/abc123@2x.png', 'SpriteImage' as any)).toEqual({
		url: 'https://api.mapbox.com/styles/v1/directus/cktaiz31c509n18nrxj63zdy6/abc123/sprite@2x.png?access_token=pk.test',
	});
});

test('Resolves mapbox:// fonts', () => {
	expect(transform('mapbox://fonts/directus/Open%20Sans%20Regular/0-255.pbf', 'Glyphs' as any)).toEqual({
		url: 'https://api.mapbox.com/fonts/v1/directus/Open%20Sans%20Regular/0-255.pbf?access_token=pk.test',
	});
});

test('Resolves mapbox:// tilesets', () => {
	expect(transform('mapbox://mapbox.mapbox-streets-v8,mapbox.mapbox-terrain-v2', 'Source' as any)).toEqual({
		url: 'https://api.mapbox.com/v4/mapbox.mapbox-streets-v8,mapbox.mapbox-terrain-v2.json?secure&access_token=pk.test',
	});
});

test('Resolves mapbox://tiles URLs', () => {
	expect(transform('mapbox://tiles/mapbox.satellite/1/2/3.png', 'Tile' as any)).toEqual({
		url: 'https://api.mapbox.com/v4/mapbox.satellite/1/2/3.png?access_token=pk.test',
	});
});

test('Keeps existing query parameters', () => {
	expect(transform('mapbox://styles/directus/cktaiz31c509n18nrxj63zdy6?fresh=true', 'Style' as any)).toEqual({
		url: 'https://api.mapbox.com/styles/v1/directus/cktaiz31c509n18nrxj63zdy6?fresh=true&access_token=pk.test',
	});
});

test('Leaves unknown mapbox:// forms untouched', () => {
	expect(transform('mapbox://unknown/thing/here', 'Source' as any)).toEqual({
		url: 'mapbox://unknown/thing/here',
	});
});

test('Adds the token to Mapbox API URLs once', () => {
	expect(transform('https://api.mapbox.com/v4/mapbox.satellite/1/2/3.png', 'Tile' as any)).toEqual({
		url: 'https://api.mapbox.com/v4/mapbox.satellite/1/2/3.png?access_token=pk.test',
	});

	expect(
		transform('https://api.mapbox.com/v4/mapbox.satellite/1/2/3.png?access_token=pk.other', 'Tile' as any)
	).toEqual({
		url: 'https://api.mapbox.com/v4/mapbox.satellite/1/2/3.png?access_token=pk.other',
	});
});

test('Encodes the access token', () => {
	expect(getMapboxTransformRequest('pk.a&b')!('mapbox://styles/directus/style', 'Style' as any)).toEqual({
		url: 'https://api.mapbox.com/styles/v1/directus/style?access_token=pk.a%26b',
	});
});

test('Builds a raster style from a raster basemap', () => {
	expect(
		getStyleFromBasemapSource({
			name: 'OSM',
			type: 'raster',
			url: 'https://{a-b}.tile.example.org/{z}/{x}/{y}.png',
			attribution: '© Example',
		})
	).toEqual({
		version: 8,
		glyphs: 'https://fonts.openmaptiles.org/{fontstack}/{range}.pbf',
		layers: [{ id: 'OSM', source: 'OSM', type: 'raster' }],
		sources: {
			OSM: {
				type: 'raster',
				attribution: '© Example',
				tiles: ['https://a.tile.example.org/{z}/{x}/{y}.png', 'https://b.tile.example.org/{z}/{x}/{y}.png'],
				tileSize: 512,
			},
		},
	});
});

test('Returns style basemaps as URL', () => {
	expect(getStyleFromBasemapSource({ name: 'Custom', type: 'style', url: 'https://example.org/style.json' })).toBe(
		'https://example.org/style.json'
	);
});
