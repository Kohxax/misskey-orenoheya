/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

process.env.NODE_ENV = 'test';

import * as assert from 'assert';
import { beforeAll, describe, test, vi } from 'vitest';
import type * as misskey from 'misskey-js';
import { api, failedApiCall, post, react, signup, uploadFile, waitFire } from '../utils.js';

const waitForTimeline = { timeout: 3000, interval: 25 };

describe('Non-image mute', () => {
	let alice: misskey.entities.SignupResponse;
	let bob: misskey.entities.SignupResponse;
	let carol: misskey.entities.SignupResponse;
	let dave: misskey.entities.SignupResponse;
	let imageFile: misskey.entities.DriveFile;
	let daveImageFile: misskey.entities.DriveFile;

	async function getRelation() {
		const response = await api('users/relation', { userId: bob.id }, alice);
		assert.strictEqual(response.status, 200);
		assert.ok(Array.isArray(response.body));
		assert.strictEqual(response.body.length, 1);
		return response.body[0];
	}

	beforeAll(async () => {
		const suffix = Math.random().toString(36).slice(2, 8);
		alice = await signup({ username: `nimalice_${suffix}` });
		bob = await signup({ username: `nimbob_${suffix}` });
		carol = await signup({ username: `nimcarol_${suffix}` });
		dave = await signup({ username: `nimdave_${suffix}` });
		imageFile = (await uploadFile(bob)).body!;
		daveImageFile = (await uploadFile(dave)).body!;
	}, 1000 * 60 * 2);

	test('create, list, delete and relation', async () => {
		const expiresAt = Date.now() + (1000 * 60 * 10);
		assert.strictEqual((await api('non-image-mute/create', { userId: bob.id, expiresAt }, alice)).status, 204);

		const list = await api('non-image-mute/list', {}, alice);
		assert.strictEqual(list.status, 200);
		assert.ok(list.body.some(muting => muting.muteeId === bob.id && muting.expiresAt != null && new Date(muting.expiresAt).getTime() === expiresAt));

		const relation = await getRelation();
		assert.strictEqual(relation.isNonImageMuted, true);

		assert.strictEqual((await api('non-image-mute/delete', { userId: bob.id }, alice)).status, 204);
		assert.strictEqual((await getRelation()).isNonImageMuted, false);
	});

	test('returns the documented API errors', async () => {
		await failedApiCall({ endpoint: 'non-image-mute/create', parameters: { userId: alice.id }, user: alice }, {
			status: 400, code: 'MUTEE_IS_YOURSELF', id: '104d4931-d1b1-4338-bf5a-e4d3ad1fc53c',
		});
		await failedApiCall({ endpoint: 'non-image-mute/create', parameters: { userId: 'xxxxxxxxxx' }, user: alice }, {
			status: 400, code: 'NO_SUCH_USER', id: '12d9cf77-4eef-4b7c-947d-06ac086f1b67',
		});
		await failedApiCall({ endpoint: 'non-image-mute/delete', parameters: { userId: dave.id }, user: alice }, {
			status: 400, code: 'NOT_MUTING', id: 'ef880d2b-f352-4b75-aac0-12474f5627e0',
		});
		await failedApiCall({ endpoint: 'non-image-mute/delete', parameters: { userId: alice.id }, user: alice }, {
			status: 400, code: 'MUTEE_IS_YOURSELF', id: '48e49346-e50b-4625-81d7-26af16d44038',
		});
		await failedApiCall({ endpoint: 'non-image-mute/delete', parameters: { userId: 'xxxxxxxxxx' }, user: alice }, {
			status: 400, code: 'NO_SUCH_USER', id: '4e426241-b66c-4f99-8982-5a62558745d3',
		});

		await api('non-image-mute/create', { userId: dave.id }, alice);
		await failedApiCall({ endpoint: 'non-image-mute/create', parameters: { userId: dave.id }, user: alice }, {
			status: 400, code: 'ALREADY_MUTING', id: '486d0a54-20d2-4554-b37b-43486b796947',
		});
		await api('non-image-mute/delete', { userId: dave.id }, alice);
	});

	test('treats expired and past-dated settings as inactive', async () => {
		assert.strictEqual((await api('non-image-mute/create', { userId: carol.id, expiresAt: Date.now() - 1 }, alice)).status, 204);
		assert.strictEqual((await api('users/show', { userId: carol.id }, alice)).body.isNonImageMuted, false);

		await api('non-image-mute/create', { userId: carol.id, expiresAt: Date.now() + 100 }, alice);
		await new Promise(resolve => setTimeout(resolve, 150));
		const list = await api('non-image-mute/list', {}, alice);
		assert.strictEqual(list.body.some(muting => muting.muteeId === carol.id), false);
		assert.strictEqual((await api('users/show', { userId: carol.id }, alice)).body.isNonImageMuted, false);
	});

	test('serializes concurrent switches so only one mode remains', async () => {
		const responses = await Promise.all([
			api('mute/create', { userId: dave.id }, alice),
			api('non-image-mute/create', { userId: dave.id }, alice),
		]);
		assert.deepStrictEqual(responses.map(response => response.status), [204, 204]);
		const user = (await api('users/show', { userId: dave.id }, alice)).body;
		assert.strictEqual(Number(user.isMuted) + Number(user.isNonImageMuted), 1);

		const imageNote = await post(dave, { text: 'concurrent cache check', fileIds: [daveImageFile.id] });
		await vi.waitFor(async () => {
			const timeline = await api('notes/local-timeline', { limit: 100 }, alice);
			assert.strictEqual(timeline.body.some(note => note.id === imageNote.id), user.isNonImageMuted);
		}, waitForTimeline);
		if (user.isMuted) await api('mute/delete', { userId: dave.id }, alice);
		if (user.isNonImageMuted) await api('non-image-mute/delete', { userId: dave.id }, alice);
	});

	test('normal mute and non-image mute switch each other off', async () => {
		await api('non-image-mute/create', { userId: bob.id }, alice);
		await api('mute/create', { userId: bob.id }, alice);
		let relation = await getRelation();
		assert.strictEqual(relation.isMuted, true);
		assert.strictEqual(relation.isNonImageMuted, false);

		await api('non-image-mute/create', { userId: bob.id }, alice);
		relation = await getRelation();
		assert.strictEqual(relation.isMuted, false);
		assert.strictEqual(relation.isNonImageMuted, true);
	});

	test('filters direct notes and renotes while keeping image notes and third-party replies', async () => {
		const textNote = await post(bob, { text: 'text only' });
		const imageNote = await post(bob, { text: 'image', fileIds: [imageFile.id] });
		const pureRenote = await post(bob, { renoteId: imageNote.id });
		const thirdPartyQuote = await post(carol, { text: 'quote', renoteId: textNote.id });
		const thirdPartyReply = await post(carol, { text: 'reply', replyId: textNote.id });

		await vi.waitFor(async () => {
			const timeline = await api('notes/local-timeline', { limit: 100, withReplies: true }, alice);
			assert.strictEqual(timeline.status, 200);
			assert.strictEqual(timeline.body.some(note => note.id === textNote.id), false);
			assert.strictEqual(timeline.body.some(note => note.id === imageNote.id), true);
			assert.strictEqual(timeline.body.some(note => note.id === pureRenote.id), false);
			assert.strictEqual(timeline.body.some(note => note.id === thirdPartyQuote.id), false);
			assert.strictEqual(timeline.body.some(note => note.id === thirdPartyReply.id), true);
		}, waitForTimeline);
	});

	test('does not affect profiles, individual notes, mentions, or notifications', async () => {
		const mentioned = await post(bob, { text: `@${alice.username} mention` });

		const profileNotes = await api('users/notes', { userId: bob.id }, alice);
		assert.strictEqual(profileNotes.status, 200);
		assert.strictEqual(profileNotes.body.some(note => note.id === mentioned.id), true);

		const shown = await api('notes/show', { noteId: mentioned.id }, alice);
		assert.strictEqual(shown.status, 200);
		assert.strictEqual(shown.body.id, mentioned.id);

		const mentions = await api('notes/mentions', {}, alice);
		assert.strictEqual(mentions.status, 200);
		assert.strictEqual(mentions.body.some(note => note.id === mentioned.id), true);

		const aliceNote = await post(alice, { text: 'react here' });
		await react(bob, aliceNote, 'like');
		const notifications = await api('i/notifications', {}, alice);
		assert.strictEqual(notifications.status, 200);
		assert.strictEqual(notifications.body.some(notification => 'userId' in notification && notification.userId === bob.id), true);
	});

	test('filters matching streaming timelines', async () => {
		await api('following/create', { userId: bob.id }, alice);
		const textFired = await waitFire(
			alice,
			'homeTimeline',
			() => post(bob, { text: 'stream text' }),
			message => message.type === 'note' && message.body.userId === bob.id,
		);
		assert.strictEqual(textFired, false);

		const imageFired = await waitFire(
			alice,
			'homeTimeline',
			() => post(bob, { text: 'stream image', fileIds: [imageFile.id] }),
			message => message.type === 'note' && message.body.userId === bob.id && message.body.files.some((file: misskey.entities.DriveFile) => file.id === imageFile.id),
		);
		assert.strictEqual(imageFired, true);
	});
});
