<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<XColumn :column="column" :isStacked="isStacked" :refresher="reload">
	<template #header>
		<i class="ti ti-brand-x"></i>
		<span style="margin-left: 8px;">{{ i18n.ts._deck._columns.xHomeTimeline }}</span>
	</template>

	<MkPullToRefresh :refresher="reload">
		<div v-if="bridgeError" :class="[$style.error, $style[`error_${bridgeError.type}`]]">
			<i :class="bridgeError.type === 'AUTH_ERROR' ? 'ti ti-lock-open-off' : bridgeError.type === 'QUERY_ID_ERROR' ? 'ti ti-refresh-alert' : 'ti ti-alert-circle'"></i>
			<span>{{ bridgeError.message }}</span>
		</div>

		<div v-else-if="error" :class="$style.error">
			<i class="ti ti-alert-circle"></i>
			<span>{{ error }}</span>
		</div>

		<div v-else-if="tweets.length === 0 && !loading" :class="$style.empty">
			<i class="ti ti-mood-empty"></i>
		</div>

		<template v-else>
			<MkXTweet
				v-for="tweet in tweets"
				:key="tweet.id"
				:tweet="tweet"
				:likedIds="likedIds"
				:compact="true"
				@like="onLike"
			/>
		</template>

		<div v-if="loading && tweets.length === 0" :class="$style.loading">
			<MkLoading/>
		</div>
	</MkPullToRefresh>
</XColumn>
</template>

<script lang="ts" setup>
import { onMounted } from 'vue';
import XColumn from './column.vue';
import MkXTweet from '@/components/MkXTweet.vue';
import MkLoading from '@/components/global/MkLoading.vue';
import MkPullToRefresh from '@/components/MkPullToRefresh.vue';
import type { Column } from '@/deck.js';
import { useXTimeline } from '@/composables/use-x-timeline.js';
import { i18n } from '@/i18n.js';

const props = defineProps<{
	column: Column;
	isStacked: boolean;
}>();

const { tweets, likedIds, loading, error, bridgeError, fetchTimeline, reload, onLike } = useXTimeline('x/timeline');

onMounted(async () => {
	loading.value = true;
	await fetchTimeline();
	loading.value = false;
});
</script>

<style lang="scss" module>
.error {
	padding: 12px 16px;
	font-size: 0.85em;
	line-height: 1.5;
	display: flex;
	align-items: flex-start;
	gap: 8px;
	color: var(--MI_THEME-error);
	border-bottom: solid 0.5px var(--MI_THEME-divider);
}

.error_AUTH_ERROR {
	background: color-mix(in srgb, var(--MI_THEME-error) 10%, var(--MI_THEME-panel));
}

.error_QUERY_ID_ERROR {
	background: color-mix(in srgb, var(--MI_THEME-warn, #f0a500) 10%, var(--MI_THEME-panel));
	color: var(--MI_THEME-warn, #c07800);
}

.error_UNKNOWN {
	background: color-mix(in srgb, var(--MI_THEME-error) 10%, var(--MI_THEME-panel));
}

.empty {
	padding: 32px;
	text-align: center;
	color: var(--MI_THEME-fgTransparentWeak);
	font-size: 1.5em;
}

.loading {
	padding: 16px;
	display: flex;
	justify-content: center;
}
</style>
