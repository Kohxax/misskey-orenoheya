/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export interface XMediaItem {
	url: string;
	thumbUrl: string;
	type: 'photo' | 'video' | 'animated_gif';
}

export interface XTweet {
	id: string;
	text: string;
	createdAt: string;
	author: {
		name: string;
		screenName: string;
		avatarUrl: string;
		protected: boolean;
	};
	media: XMediaItem[];
	quotedTweet?: XTweet;
	retweetedBy?: {
		name: string;
		screenName: string;
	};
	/** リポスト時のみ: 元ツイートのID（idはRT自体のID、originalIdが元ツイートのID） */
	originalId?: string;
}
