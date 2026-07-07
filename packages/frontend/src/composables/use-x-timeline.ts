/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { ref } from 'vue';
import { useInterval } from '@@/js/use-interval.js';
import type { XTweet } from '@/utility/x-types.js';
import { $i } from '@/i.js';
import { apiUrl } from '@@/js/config.js';

const POLL_INTERVAL_MS = 60_000;

export type BridgeError = { type: 'AUTH_ERROR' | 'QUERY_ID_ERROR' | 'UNKNOWN'; message: string };

const ERROR_MESSAGES: Record<string, string> = {
	AUTH_ERROR: 'Xのセッションが切れています。.env の auth_token / ct0 を更新してブリッジを再起動してください。',
	QUERY_ID_ERROR: 'XのAPIが変更されました。DevTools → Network → HomeLatestTimeline / HomeTimeline のURLからQuery IDを確認・更新してください。',
	UNKNOWN: 'X接続エラーが発生しています。ブリッジのログを確認してください。',
};

async function callApi<T>(endpoint: string, params: Record<string, unknown> = {}): Promise<T> {
	const res = await window.fetch(`${apiUrl}/${endpoint}`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ ...params, i: $i?.token }),
		credentials: 'omit',
	});
	if (!res.ok) throw new Error(`API ${res.status}`);
	return res.json() as Promise<T>;
}

function sortByIdDesc(list: XTweet[]): XTweet[] {
	return [...list].sort((a, b) => (BigInt(b.id) > BigInt(a.id) ? 1 : -1));
}

export function useXTimeline(
	timelineEndpoint: 'x/timeline' | 'x/for-you',
	options: { polling?: boolean; sort?: boolean } = {},
) {
	const { polling = true, sort = true } = options;
	const tweets = ref<XTweet[]>([]);
	const likedIds = ref<Set<string>>(new Set());
	const loading = ref(false);
	const error = ref<string | null>(null);
	const bridgeError = ref<BridgeError | null>(null);

	async function fetchStatus(): Promise<void> {
		try {
			const s = await callApi<{
				ok: boolean;
				consecutiveErrors: number;
				lastError: { type: string; message: string; at: string } | null;
			}>('x/status');
			if (!s.ok && s.lastError) {
				const type = (s.lastError.type as BridgeError['type']) ?? 'UNKNOWN';
				bridgeError.value = { type, message: ERROR_MESSAGES[type] ?? ERROR_MESSAGES['UNKNOWN'] };
			} else {
				bridgeError.value = null;
			}
		} catch {
			// status endpoint が落ちていても無視
		}
	}

	async function fetchLiked(): Promise<void> {
		try {
			const ids = await callApi<string[]>('x/liked');
			likedIds.value = new Set(ids);
		} catch {
			// 取得失敗は無視
		}
	}

	async function fetchTimeline(): Promise<void> {
		const isFirstFetch = tweets.value.length === 0;
		try {
			const fetched = await callApi<XTweet[]>(timelineEndpoint);
			if (sort) {
				// フォロー中TL: ID降順ソートで時系列を維持
				if (isFirstFetch) {
					tweets.value = sortByIdDesc(fetched);
				} else {
					const latestId = tweets.value[0].id;
					const newer = fetched.filter(t => BigInt(t.id) > BigInt(latestId));
					if (newer.length > 0) {
						tweets.value = sortByIdDesc([...newer, ...tweets.value]);
					}
				}
			} else {
				// おすすめTL: ブリッジのアルゴリズム順を維持（ソートなし）
				if (isFirstFetch) {
					tweets.value = fetched;
				} else {
					const seen = new Set(tweets.value.map(t => t.id));
					const newTweets = fetched.filter(t => !seen.has(t.id));
					if (newTweets.length > 0) {
						tweets.value = [...newTweets, ...tweets.value];
					}
				}
			}
			error.value = null;
		} catch (e) {
			if (isFirstFetch) {
				error.value = String(e);
			}
		}
		if (isFirstFetch) {
			await fetchLiked();
		}
		await fetchStatus();
	}

	async function reload(): Promise<void> {
		loading.value = true;
		tweets.value = [];
		await fetchTimeline();
		loading.value = false;
	}

	async function onLike(id: string): Promise<void> {
		if (likedIds.value.has(id)) {
			likedIds.value = new Set([...likedIds.value].filter(x => x !== id));
			try {
				await callApi('x/unlike', { id });
			} catch {
				likedIds.value = new Set([...likedIds.value, id]);
			}
		} else {
			likedIds.value = new Set([...likedIds.value, id]);
			try {
				await callApi('x/like', { id });
			} catch {
				likedIds.value = new Set([...likedIds.value].filter(x => x !== id));
			}
		}
	}

	if (polling) {
		useInterval(fetchTimeline, POLL_INTERVAL_MS, { immediate: false, afterMounted: true });
	}

	return {
		tweets,
		likedIds,
		loading,
		error,
		bridgeError,
		fetchTimeline,
		reload,
		onLike,
	};
}
