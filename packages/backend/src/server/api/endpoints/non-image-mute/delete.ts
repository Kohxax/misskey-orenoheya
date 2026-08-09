/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import type { NonImageMutingsRepository } from '@/models/_.js';
import { DI } from '@/di-symbols.js';
import { GetterService } from '@/server/api/GetterService.js';
import { UserNonImageMutingService } from '@/core/UserNonImageMutingService.js';
import { ApiError } from '../../error.js';

export const meta = {
	tags: ['account'], requireCredential: true, kind: 'write:mutes',
	errors: {
		noSuchUser: { message: 'No such user.', code: 'NO_SUCH_USER', id: '4e426241-b66c-4f99-8982-5a62558745d3' },
		muteeIsYourself: { message: 'Mutee is yourself.', code: 'MUTEE_IS_YOURSELF', id: '48e49346-e50b-4625-81d7-26af16d44038' },
		notMuting: { message: 'You are not muting non-image notes from that user.', code: 'NOT_MUTING', id: 'ef880d2b-f352-4b75-aac0-12474f5627e0' },
	},
} as const;
export const paramDef = { type: 'object', properties: { userId: { type: 'string', format: 'misskey:id' } }, required: ['userId'] } as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.nonImageMutingsRepository) private nonImageMutingsRepository: NonImageMutingsRepository,
		private getterService: GetterService,
		private userNonImageMutingService: UserNonImageMutingService,
	) {
		super(meta, paramDef, async (ps, me) => {
			if (me.id === ps.userId) throw new ApiError(meta.errors.muteeIsYourself);
			const mutee = await this.getterService.getUser(ps.userId).catch(err => {
				if (err.id === '15348ddd-432d-49c2-8a5a-8069753becff') throw new ApiError(meta.errors.noSuchUser);
				throw err;
			});
			const muting = await this.nonImageMutingsRepository.findOneBy({ muterId: me.id, muteeId: mutee.id });
			if (!muting) throw new ApiError(meta.errors.notMuting);
			await this.userNonImageMutingService.unmute([muting]);
		});
	}
}
