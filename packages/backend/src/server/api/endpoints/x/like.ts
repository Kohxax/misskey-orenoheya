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
	kind: 'write:account',
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		id: { type: 'string' },
	},
	required: ['id'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		private httpRequestService: HttpRequestService,
	) {
		super(meta, paramDef, async (ps, _me) => {
			await this.httpRequestService.send(`${BRIDGE_URL}/like`, {
				method: 'POST',
				body: JSON.stringify({ id: ps.id }),
				headers: { 'Content-Type': 'application/json' },
				isLocalAddressAllowed: true,
			});
			return { ok: true };
		});
	}
}
