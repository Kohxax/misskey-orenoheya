/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { afterEach, describe, expect, test, vi } from 'vitest';
import { cleanup, render } from '@testing-library/vue';
import { defineComponent, h } from 'vue';
import type { entities } from 'misskey-js';
import type { MfmBaseProps } from '@@/js/mfm-renderer.js';
import { createMfmRenderer } from '@@/js/mfm-renderer.js';

type ReactionProps = MfmBaseProps & {
	enableEmojiMenu?: boolean;
	enableEmojiMenuReaction?: boolean;
};

const Emoji = defineComponent({
	props: {
		menuReaction: Boolean,
	},
	setup: (props) => () => h('button', { disabled: !props.menuReaction }, 'React'),
});

afterEach(cleanup);

describe('MFM emoji reaction menu', () => {
	for (const host of [null, 'remote.example']) {
		for (const enabled of [false, true]) {
			test(`respects the reaction setting for ${host ?? 'local'} emoji (${enabled})`, () => {
				const renderer = createMfmRenderer<ReactionProps>({
					components: () => ({ Url: Emoji, Link: Emoji, Mention: Emoji, A: Emoji, Time: Emoji, Emoji, CustomEmoji: Emoji }),
					supports: { emojiMenu: true },
				});
				const { getByRole } = render(defineComponent({
					setup: () => () => renderer({
						text: ':test:',
						author: { host } as entities.UserLite,
						emojiUrls: { test: 'https://remote.example/emoji.png' },
						enableEmojiMenu: true,
						enableEmojiMenuReaction: enabled,
					}, { emit: vi.fn() }),
				}));

				expect((getByRole('button', { name: 'React' }) as HTMLButtonElement).disabled).toBe(!enabled);
			});
		}
	}

	test('keeps reactions disabled for renderers without emoji menu support', () => {
		const renderer = createMfmRenderer<ReactionProps>({
			components: () => ({ Url: Emoji, Link: Emoji, Mention: Emoji, A: Emoji, Time: Emoji, Emoji, CustomEmoji: Emoji }),
		});
		const { getByRole } = render(defineComponent({
			setup: () => () => renderer({
				text: ':test:',
				author: { host: 'remote.example' } as entities.UserLite,
				emojiUrls: { test: 'https://remote.example/emoji.png' },
				enableEmojiMenuReaction: true,
			}, { emit: vi.fn() }),
		}));

		expect((getByRole('button', { name: 'React' }) as HTMLButtonElement).disabled).toBe(true);
	});
});
