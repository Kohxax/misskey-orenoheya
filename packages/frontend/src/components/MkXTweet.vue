<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div :class="[isQuote ? $style.quote : $style.tweet, (!isQuote && !compact) ? $style.defaultSize : null]">
	<!-- リツイートヘッダー -->
	<div v-if="tweet.retweetedBy && !isQuote" :class="$style.rtHeader">
		<i class="ti ti-repeat"></i>
		<span><template v-for="(seg, i) in segmentText(tweet.retweetedBy.name)" :key="i"><img v-if="seg.kind === 'emoji'" :class="$style.inlineEmoji" :src="seg.src" :alt="seg.value"/><template v-else>{{ seg.value }}</template></template> さんがリポスト</span>
	</div>

	<!-- アバター列 + メイン列 -->
	<div :class="$style.body">
		<a :class="$style.avatarWrapper" :href="profileUrl" target="_blank" rel="noopener noreferrer">
			<img :class="$style.avatar" :src="tweet.author.avatarUrl" :alt="tweet.author.name" loading="lazy"/>
		</a>

		<div :class="$style.main">
			<!-- ヘッダー: 表示名・@handle・時間 -->
			<div :class="$style.header">
				<a :class="$style.displayName" :href="profileUrl" target="_blank" rel="noopener noreferrer"><template v-for="(seg, i) in segmentText(tweet.author.name)" :key="i"><img v-if="seg.kind === 'emoji'" :class="$style.inlineEmoji" :src="seg.src" :alt="seg.value"/><template v-else>{{ seg.value }}</template></template></a>
				<span :class="$style.screenName">
					@{{ tweet.author.screenName }}<i v-if="tweet.author.protected" class="ti ti-lock" :class="$style.lockIcon"></i>
				</span>
				<a :class="$style.time" :href="tweetUrl" target="_blank" rel="noopener noreferrer">
					<MkTime :time="new Date(tweet.createdAt)" mode="relative"/>
				</a>
			</div>

			<div v-if="!isQuote" :class="$style.xTicker">
				<svg :class="$style.xTickerIcon" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
					<path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.256 5.627L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z"/>
				</svg>
				<span :class="$style.xTickerName">X</span>
			</div>

			<p :class="$style.text"><template v-for="(seg, i) in segmentText(tweet.text)" :key="i"><img v-if="seg.kind === 'emoji'" :class="$style.inlineEmoji" :src="seg.src" :alt="seg.value"/><a v-else-if="seg.kind === 'url'" :class="$style.textLink" :href="seg.value" target="_blank" rel="noopener noreferrer">{{ seg.value }}</a><template v-else>{{ seg.value }}</template></template></p>

			<!-- URL プレビュー -->
			<div v-if="tweetUrls.length > 0" :class="$style.urlPreviews">
				<MkUrlPreview v-for="url in tweetUrls" :key="url" :url="url" :compact="true" :detail="false"/>
			</div>

			<!-- メディアグリッド -->
			<div v-if="tweet.media.length > 0" :class="[$style.mediaGrid, mediaGridClass]">
				<template v-for="(item, i) in tweet.media" :key="item.url">
					<button v-if="item.type === 'photo'" :class="$style.mediaItem" @click="openLightbox(photoIndexOf(i))">
						<img :class="$style.mediaImage" :src="item.thumbUrl" loading="lazy"/>
					</button>
					<button v-else :class="[$style.mediaItem, $style.videoItem]" @click="openVideo(item)">
						<img :class="$style.mediaImage" :src="item.thumbUrl" loading="lazy"/>
						<div :class="$style.playOverlay">
							<i :class="item.type === 'animated_gif' ? 'ti ti-repeat' : 'ti ti-player-play-filled'"></i>
						</div>
					</button>
				</template>
			</div>

			<!-- 引用ツイート -->
			<div v-if="tweet.quotedTweet" :class="$style.quotedTweetWrapper">
				<MkXTweet :tweet="tweet.quotedTweet" :isQuote="true" :likedIds="likedIds" @like="$emit('like', $event)"/>
			</div>

			<!-- アクション -->
			<div v-if="!isQuote" :class="$style.actions">
				<button :class="[$style.actionBtn, liked ? $style.liked : null]" :aria-label="liked ? 'いいねを取り消す' : 'いいね'" @click="onLike">
					<i :class="liked ? 'ti ti-heart-filled' : 'ti ti-heart'"></i>
				</button>
				<button v-if="tweet.author.protected" :class="[$style.actionBtn, $style.disabledBtn]" aria-label="非公開アカウントのためシェア不可" disabled>
					<i class="ti ti-ban"></i>
				</button>
				<button v-else :class="$style.actionBtn" aria-label="Misskeyでシェア" @click="onShare">
					<i class="ti ti-pencil-plus"></i>
				</button>
			</div>
		</div>
	</div>
</div>

</template>

<script lang="ts" setup>
import { computed } from 'vue';
import PhotoSwipeLightbox from 'photoswipe/lightbox';
import PhotoSwipe from 'photoswipe';
import 'photoswipe/style.css';
import * as os from '@/os.js';
import { char2twemojiFilePath, char2fluentEmojiFilePath } from '@@/js/emoji-base.js';
import { prefer } from '@/preferences.js';
import type { XTweet, XMediaItem } from '@/utility/x-types.js';
import MkUrlPreview from '@/components/MkUrlPreview.vue';

const props = defineProps<{
	tweet: XTweet;
	isQuote?: boolean;
	likedIds: Set<string>;
	compact?: boolean;
}>();

const emit = defineEmits<{
	like: [id: string];
}>();

const tweetUrl = computed(() =>
	`https://x.com/${props.tweet.author.screenName}/status/${props.tweet.id}`,
);

const isExtendedPictographic = /\p{Extended_Pictographic}/u;
const urlRe = /https?:\/\/\S+/g;
const char2path = prefer.s.emojiStyle === 'fluentEmoji' ? char2fluentEmojiFilePath : char2twemojiFilePath;

type TextSeg =
	| { kind: 'text'; value: string }
	| { kind: 'emoji'; value: string; src: string }
	| { kind: 'url'; value: string };

function splitByEmoji(str: string): TextSeg[] {
	if (prefer.s.emojiStyle === 'native') return [{ kind: 'text', value: str }];
	const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
	const result: TextSeg[] = [];
	let buf = '';
	for (const { segment } of segmenter.segment(str)) {
		if (isExtendedPictographic.test(segment)) {
			if (buf) { result.push({ kind: 'text', value: buf }); buf = ''; }
			result.push({ kind: 'emoji', value: segment, src: char2path(segment) });
		} else {
			buf += segment;
		}
	}
	if (buf) result.push({ kind: 'text', value: buf });
	return result;
}

function segmentText(str: string): TextSeg[] {
	const result: TextSeg[] = [];
	let last = 0;
	for (const m of str.matchAll(urlRe)) {
		if (m.index > last) result.push(...splitByEmoji(str.slice(last, m.index)));
		result.push({ kind: 'url', value: m[0] });
		last = m.index + m[0].length;
	}
	if (last < str.length) result.push(...splitByEmoji(str.slice(last)));
	return result;
}
const profileUrl = computed(() =>
	`https://x.com/${props.tweet.author.screenName}`,
);

const liked = computed(() => props.likedIds.has(props.tweet.id));

const tweetUrls = computed(() =>
	segmentText(props.tweet.text)
		.filter(s => s.kind === 'url')
		.map(s => s.value),
);

const mediaGridClass = computed(() => {
	const n = props.tweet.media.length;
	if (n === 1) return 'mk-x-media-1';
	if (n === 2) return 'mk-x-media-2';
	if (n === 3) return 'mk-x-media-3';
	return 'mk-x-media-4';
});

function photoIndexOf(mediaIndex: number): number {
	let count = 0;
	for (let i = 0; i < mediaIndex; i++) {
		if (props.tweet.media[i].type === 'photo') count++;
	}
	return count;
}

function getLargeUrl(url: string): string {
	if (!url.includes('twimg.com') || url.includes('.mp4')) return url;
	try {
		const u = new URL(url);
		u.searchParams.set('name', 'large');
		return u.toString();
	} catch {
		return url;
	}
}

async function openLightbox(photoIndex: number): Promise<void> {
	const photos = props.tweet.media.filter(m => m.type === 'photo');
	const sources = await Promise.all(
		photos.map(m => {
			const url = getLargeUrl(m.url);
			return new Promise<{ src: string; width: number; height: number }>(resolve => {
				const img = new Image();
				img.onload = () => resolve({ src: url, width: img.naturalWidth, height: img.naturalHeight });
				img.onerror = () => resolve({ src: url, width: 1200, height: 675 });
				img.src = url;
			});
		}),
	);
	const lb = new PhotoSwipeLightbox({
		dataSource: sources,
		pswpModule: PhotoSwipe,
		loop: false,
		initialZoomLevel: 'fit',
		secondaryZoomLevel: 2,
		maxZoomLevel: 2,
		showAnimationDuration: 100,
		hideAnimationDuration: 100,
		imageClickAction: 'close',
		tapAction: 'toggle-controls',
		padding: window.innerWidth > 500
			? { top: 32, bottom: 90, left: 32, right: 32 }
			: { top: 0, bottom: 78, left: 0, right: 0 },
	});

	const popstateHandler = (): void => {
		if (lb.pswp && lb.pswp.isOpen) {
			lb.pswp.close();
		}
	};

	lb.on('afterInit', () => {
		window.history.pushState(null, '', '#pswp');
		window.addEventListener('popstate', popstateHandler);
	});

	lb.on('destroy', () => {
		window.removeEventListener('popstate', popstateHandler);
		if (window.location.hash === '#pswp') {
			window.history.back();
		}
	});

	lb.init();
	lb.loadAndOpen(photoIndex);
}

function openVideo(_item: XMediaItem): void {
	window.open(tweetUrl.value, '_blank', 'noopener,noreferrer');
}

function onLike(): void {
	emit('like', props.tweet.id);
}

const shareUrl = computed(() => {
	if (props.tweet.retweetedBy && props.tweet.originalId) {
		return `https://x.com/${props.tweet.author.screenName}/status/${props.tweet.originalId}`;
	}
	return tweetUrl.value;
});

function onShare(): void {
	os.post({ initialText: shareUrl.value, instant: true });
}
</script>

<style lang="scss" module>
.tweet {
	padding: var(--x-tweet-padding, 12px 14px);
	background: var(--MI_THEME-panel);
	border-bottom: solid 0.5px var(--MI_THEME-divider);

	&:last-child {
		border-bottom: none;
	}
}

.defaultSize {
	@media (min-width: 500px) {
		--x-tweet-padding: 28px 32px;
		--x-avatar-size: 58px;
		--x-body-gap: 14px;
		--x-text-size: 1em;
		--x-name-size: 1em;
		--x-meta-size: 0.9em;
		--x-rt-header-size: 0.9em;
	}
}

.quote {
	/* 親の .defaultSize から継承した変数をリセット */
	--x-avatar-size: 36px;
	--x-body-gap: 8px;
	--x-text-size: 0.88em;
	--x-name-size: 0.92em;
	--x-meta-size: 0.82em;
	border: dashed 1px var(--MI_THEME-renote);
	border-radius: 8px;
	margin-top: 8px;
	padding: 10px 12px;
	background: color-mix(in srgb, var(--MI_THEME-panel) 80%, var(--MI_THEME-bg) 20%);
}

.rtHeader {
	display: flex;
	align-items: center;
	gap: 6px;
	font-size: var(--x-rt-header-size, 0.8em);
	color: var(--MI_THEME-fgTransparentWeak);
	margin-bottom: 8px;
}

.body {
	display: flex;
	gap: var(--x-body-gap, 10px);
}

.avatarWrapper {
	flex-shrink: 0;
	display: block;

	&:hover .avatar {
		opacity: 0.8;
	}
}

.avatar {
	width: var(--x-avatar-size, 42px);
	height: var(--x-avatar-size, 42px);
	border-radius: 50%;
	display: block;
	transition: opacity 0.1s;
}

.main {
	flex: 1;
	min-width: 0;
}

.header {
	display: flex;
	align-items: baseline;
	white-space: nowrap;
	margin-bottom: 0;
	overflow: hidden;
}

.displayName {
	flex-shrink: 1;
	font-weight: bold;
	font-size: var(--x-name-size, 0.95em);
	color: var(--MI_THEME-fg);
	text-decoration: none;
	overflow: hidden;
	text-overflow: ellipsis;
	margin-right: 0.4em;

	&:hover {
		text-decoration: underline;
	}
}

.screenName {
	flex-shrink: 9999999;
	font-size: var(--x-meta-size, 0.85em);
	color: var(--MI_THEME-fgTransparentWeak);
	overflow: hidden;
	text-overflow: ellipsis;
	margin-right: 0.4em;
}

.lockIcon {
	font-size: 0.9em;
	margin-left: 0.3em;
}

.inlineEmoji {
	height: 1.25em;
	vertical-align: -0.25em;
}

.textLink {
	color: var(--MI_THEME-link);
	text-decoration: none;
	word-break: break-all;

	&:hover {
		text-decoration: underline;
	}
}

.time {
	flex-shrink: 0;
	margin-left: auto;
	font-size: var(--x-meta-size, 0.85em);
	color: var(--MI_THEME-fgTransparentWeak);
	text-decoration: none;
	white-space: nowrap;
	padding-left: 0.4em;

	&:hover {
		color: var(--MI_THEME-fg);
		text-decoration: underline;
	}
}

.text {
	margin: 0 0 8px;
	font-size: var(--x-text-size, 0.9em);
	line-height: 1.5;
	white-space: pre-wrap;
	word-break: break-word;
}

.mediaGrid {
	display: grid;
	gap: 4px;
	margin-bottom: 8px;
	border-radius: 8px;
	overflow: hidden;
}

.mediaItem {
	background: none;
	border: none;
	padding: 0;
	cursor: zoom-in;
	overflow: hidden;
	display: flex;
	position: relative;
}

.videoItem {
	cursor: pointer;
}

.mediaImage {
	width: 100%;
	height: 100%;
	object-fit: cover;
	display: block;
	transition: opacity 0.15s;

	.mediaItem:hover & {
		opacity: 0.9;
	}
}

.playOverlay {
	position: absolute;
	inset: 0;
	display: flex;
	align-items: center;
	justify-content: center;
	background: rgba(0, 0, 0, 0.3);
	font-size: 2em;
	color: rgba(255, 255, 255, 0.9);
	transition: background 0.15s;

	i {
		filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.6));
	}

	.videoItem:hover & {
		background: rgba(0, 0, 0, 0.45);
	}
}

.quotedTweetWrapper {
	margin-bottom: 8px;
}

.actions {
	display: flex;
	margin-top: 2px;
	margin-bottom: -8px;
}

.actionBtn {
	background: none;
	border: none;
	cursor: pointer;
	padding: 8px;
	color: color-mix(in srgb, var(--MI_THEME-panel), var(--MI_THEME-fg) 70%);
	font-size: 0.9em;
	transition: color 0.15s;
	display: flex;
	align-items: center;

	&:not(:last-child) {
		margin-right: 20px;
	}

	&:hover {
		color: var(--MI_THEME-fgHighlighted);
	}
}

.liked {
	color: #f91880;

	&:hover {
		color: #f91880;
	}
}

.disabledBtn {
	cursor: not-allowed;
}

.urlPreviews {
	margin-bottom: 8px;
	display: flex;
	flex-direction: column;
	gap: 6px;
}

.xTicker {
	display: flex;
	align-items: center;
	height: 2ex;
	border-radius: 4px 0 0 4px;
	overflow: clip;
	margin-bottom: 4px;
	background: linear-gradient(90deg, #000, #0000);
	color: #fff;

	mask-image: linear-gradient(90deg,
		rgb(0,0,0),
		rgb(0,0,0) calc(100% - 16px),
		rgba(0,0,0,0) 100%
	);
}

.xTickerIcon {
	flex-shrink: 0;
	height: 1.4ex;
	width: 1.4ex;
	padding: 0 3px;
}

.xTickerName {
	margin-left: 2px;
	line-height: 1;
	font-size: 0.9em;
	font-weight: bold;
	white-space: nowrap;
	overflow: visible;
	color: #fff;
	-webkit-text-stroke: #000 0.15em;
	paint-order: stroke fill;
}

</style>

<!-- メディア枚数別グリッドレイアウト (グローバル) -->
<style lang="scss">
:global(.pswp) {
	--pswp-root-z-index: var(--mk-pswp-root-z-index, 2000700) !important;
	--pswp-bg: var(--MI_THEME-modalBg) !important;
}

.mk-x-media-1 {
	grid-template-columns: 1fr;
	aspect-ratio: 16 / 9;
}
.mk-x-media-2 {
	grid-template-columns: 1fr 1fr;
	aspect-ratio: 16 / 9;
}
.mk-x-media-3 {
	grid-template-columns: 1fr 0.5fr;
	grid-template-rows: 1fr 1fr;
	aspect-ratio: 16 / 9;

	> button:nth-child(1) {
		grid-row: 1 / 3;
	}
}
.mk-x-media-4 {
	grid-template-columns: 1fr 1fr;
	grid-template-rows: 1fr 1fr;
	aspect-ratio: 16 / 9;
}
</style>
