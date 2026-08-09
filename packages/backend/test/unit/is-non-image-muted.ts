/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, vi } from 'vitest';
import { isNonImageMuted } from '@/misc/is-non-image-muted.js';

describe(isNonImageMuted, () => {
	const mutings = new Map([['target', null]]);

	test('hides direct non-image notes from the target', () => {
		expect(isNonImageMuted({ userId: 'target', attachedFileTypes: [] }, mutings)).toBe(true);
		expect(isNonImageMuted({ userId: 'target', attachedFileTypes: ['video/mp4'] }, mutings)).toBe(true);
	});

	test('shows direct notes containing an image', () => {
		expect(isNonImageMuted({ userId: 'target', attachedFileTypes: ['image/png'] }, mutings)).toBe(false);
		expect(isNonImageMuted({ userId: 'target', attachedFileTypes: ['video/mp4', 'image/gif'] }, mutings)).toBe(false);
	});

	test('hides pure renotes by the target regardless of the source image', () => {
		expect(isNonImageMuted({
			userId: 'target',
			attachedFileTypes: [],
			renote: { userId: 'other', attachedFileTypes: ['image/png'] },
		}, mutings)).toBe(true);
	});

	test('filters a third-party renote or quote by the source note', () => {
		expect(isNonImageMuted({
			userId: 'other',
			attachedFileTypes: ['image/png'],
			renote: { userId: 'target', attachedFileTypes: [] },
		}, mutings)).toBe(true);
		expect(isNonImageMuted({
			userId: 'other',
			attachedFileTypes: [],
			renote: { userId: 'target', attachedFileTypes: ['image/jpeg'] },
		}, mutings)).toBe(false);
	});

	test('shows a target quote with its own image even when self-quoting a non-image note', () => {
		expect(isNonImageMuted({
			userId: 'target',
			attachedFileTypes: ['image/png'],
			renote: { userId: 'target', attachedFileTypes: [] },
		}, mutings)).toBe(false);
	});

	test('uses packed file MIME types for streaming notes', () => {
		expect(isNonImageMuted({ userId: 'target', files: [{ type: 'image/webp' }] } as never, mutings)).toBe(false);
	});

	test('ignores expired settings immediately', () => {
		vi.useFakeTimers();
		vi.setSystemTime(1000);
		expect(isNonImageMuted({ userId: 'target', attachedFileTypes: [] }, new Map([['target', 999]]))).toBe(false);
		vi.useRealTimers();
	});
});
