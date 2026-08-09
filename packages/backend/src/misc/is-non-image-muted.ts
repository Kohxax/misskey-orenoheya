/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import type { MiNote } from '@/models/Note.js';
import type { Packed } from '@/misc/json-schema.js';

export type NonImageMutingMap = Map<string, number | null>;

type NoteLike = Pick<MiNote, 'userId'> & {
	attachedFileTypes?: MiNote['attachedFileTypes'];
	renote?: NoteLike | Packed<'Note'>['renote'] | null;
	files?: Packed<'Note'>['files'];
};

function hasImage(note: NoteLike): boolean {
	const types = note.attachedFileTypes ?? note.files?.map(file => file.type) ?? [];
	return types.some(type => type.startsWith('image/'));
}

function isActive(map: NonImageMutingMap, userId: string): boolean {
	if (!map.has(userId)) return false;
	const expiresAt = map.get(userId);
	return expiresAt == null || expiresAt > Date.now();
}

export function isNonImageMuted(note: NoteLike, mutings: NonImageMutingMap): boolean {
	if (isActive(mutings, note.userId) && !hasImage(note)) return true;
	if (note.renote && note.renote.userId !== note.userId && isActive(mutings, note.renote.userId) && !hasImage(note.renote)) return true;
	return false;
}
