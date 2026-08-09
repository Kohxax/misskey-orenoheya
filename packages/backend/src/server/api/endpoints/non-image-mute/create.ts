/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Injectable } from '@nestjs/common';
import ms from 'ms';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { GetterService } from '@/server/api/GetterService.js';
import { UserNonImageMutingService } from '@/core/UserNonImageMutingService.js';
import { ApiError } from '../../error.js';

export const meta = {
	tags: ['account'], requireCredential: true, prohibitMoved: true, kind: 'write:mutes',
	limit: { duration: ms('1hour'), max: 20 },
	errors: {
		noSuchUser: { message: 'No such user.', code: 'NO_SUCH_USER', id: '12d9cf77-4eef-4b7c-947d-06ac086f1b67' },
		muteeIsYourself: { message: 'Mutee is yourself.', code: 'MUTEE_IS_YOURSELF', id: '104d4931-d1b1-4338-bf5a-e4d3ad1fc53c' },
		alreadyMuting: { message: 'You are already muting non-image notes from that user.', code: 'ALREADY_MUTING', id: '486d0a54-20d2-4554-b37b-43486b796947' },
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		userId: { type: 'string', format: 'misskey:id' },
		expiresAt: { type: 'integer', nullable: true, description: 'A future Unix Epoch timestamp. `null` means indefinite.' },
	},
	required: ['userId'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		private getterService: GetterService,
		private userNonImageMutingService: UserNonImageMutingService,
	) {
		super(meta, paramDef, async (ps, me) => {
			if (me.id === ps.userId) throw new ApiError(meta.errors.muteeIsYourself);
			const mutee = await this.getterService.getUser(ps.userId).catch(err => {
				if (err.id === '15348ddd-432d-49c2-8a5a-8069753becff') throw new ApiError(meta.errors.noSuchUser);
				throw err;
			});
			if (ps.expiresAt != null && ps.expiresAt <= Date.now()) return;
			if (!await this.userNonImageMutingService.mute(me, mutee, ps.expiresAt == null ? null : new Date(ps.expiresAt))) {
				throw new ApiError(meta.errors.alreadyMuting);
			}
		});
	}
}
