/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { HttpRequestService } from '@/core/HttpRequestService.js';

const BRIDGE_URL = process.env.X_BRIDGE_URL ?? 'http://x-hometl:3001';

export const meta = {
	tags: ['x'],

	requireCredential: true,
	kind: 'read:account',
} as const;

export const paramDef = {
	type: 'object',
	properties: {},
	required: [],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		private httpRequestService: HttpRequestService,
	) {
		super(meta, paramDef, async (_ps, _me) => {
			return await this.httpRequestService.getJson(`${BRIDGE_URL}/for-you`, 'application/json, */*', undefined, true);
		});
	}
}
