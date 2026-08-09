/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { Brackets } from 'typeorm';
import { Endpoint } from '@/server/api/endpoint-base.js';
import type { NonImageMutingsRepository } from '@/models/_.js';
import { QueryService } from '@/core/QueryService.js';
import { NonImageMutingEntityService } from '@/core/entities/NonImageMutingEntityService.js';
import { DI } from '@/di-symbols.js';

export const meta = {
	tags: ['account'], requireCredential: true, kind: 'read:mutes',
	res: { type: 'array', optional: false, nullable: false, items: { type: 'object', optional: false, nullable: false, ref: 'NonImageMuting' } },
} as const;
export const paramDef = {
	type: 'object', properties: {
		limit: { type: 'integer', minimum: 1, maximum: 100, default: 30 },
		sinceId: { type: 'string', format: 'misskey:id' }, untilId: { type: 'string', format: 'misskey:id' },
		sinceDate: { type: 'integer' }, untilDate: { type: 'integer' },
	}, required: [],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.nonImageMutingsRepository) private nonImageMutingsRepository: NonImageMutingsRepository,
		private nonImageMutingEntityService: NonImageMutingEntityService,
		private queryService: QueryService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const query = this.queryService.makePaginationQuery(this.nonImageMutingsRepository.createQueryBuilder('muting'), ps.sinceId, ps.untilId, ps.sinceDate, ps.untilDate)
				.andWhere('muting.muterId = :meId', { meId: me.id })
				.andWhere(new Brackets(qb => qb.where('muting.expiresAt IS NULL').orWhere('muting.expiresAt > :now', { now: new Date() })));
			return this.nonImageMutingEntityService.packMany(await query.limit(ps.limit).getMany(), me);
		});
	}
}
