/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { DI } from '@/di-symbols.js';
import type { NonImageMutingsRepository } from '@/models/_.js';
import { awaitAll } from '@/misc/prelude/await-all.js';
import type { Packed } from '@/misc/json-schema.js';
import type { MiUser } from '@/models/User.js';
import type { MiNonImageMuting } from '@/models/NonImageMuting.js';
import { bindThis } from '@/decorators.js';
import { IdService } from '@/core/IdService.js';
import { UserEntityService } from './UserEntityService.js';

@Injectable()
export class NonImageMutingEntityService {
	constructor(
		@Inject(DI.nonImageMutingsRepository)
		private nonImageMutingsRepository: NonImageMutingsRepository,
		private userEntityService: UserEntityService,
		private idService: IdService,
	) {
	}

	@bindThis
	public async pack(src: MiNonImageMuting['id'] | MiNonImageMuting, me: { id: MiUser['id'] }, hints?: { packedMutee?: Packed<'UserDetailedNotMe'> }): Promise<Packed<'NonImageMuting'>> {
		const muting = typeof src === 'object' ? src : await this.nonImageMutingsRepository.findOneByOrFail({ id: src });
		return await awaitAll({
			id: muting.id,
			createdAt: this.idService.parse(muting.id).date.toISOString(),
			expiresAt: muting.expiresAt?.toISOString() ?? null,
			muteeId: muting.muteeId,
			mutee: hints?.packedMutee ?? this.userEntityService.pack(muting.muteeId, me, { schema: 'UserDetailedNotMe' }),
		});
	}

	@bindThis
	public async packMany(mutings: MiNonImageMuting[], me: { id: MiUser['id'] }): Promise<Packed<'NonImageMuting'>[]> {
		const userMap = await this.userEntityService.packMany(mutings.map(muting => muting.mutee ?? muting.muteeId), me, { schema: 'UserDetailedNotMe' })
			.then(users => new Map(users.map(user => [user.id, user])));
		return Promise.all(mutings.map(muting => this.pack(muting, me, { packedMutee: userMap.get(muting.muteeId) })));
	}
}
