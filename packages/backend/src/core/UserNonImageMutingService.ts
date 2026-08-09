/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { DataSource, In } from 'typeorm';
import type { MiNonImageMuting } from '@/models/_.js';
import { MiNonImageMuting as NonImageMuting } from '@/models/NonImageMuting.js';
import { MiMuting } from '@/models/Muting.js';
import { acquireUserMuteLock } from '@/misc/acquire-user-mute-lock.js';
import { IdService } from '@/core/IdService.js';
import type { MiUser } from '@/models/User.js';
import { DI } from '@/di-symbols.js';
import { bindThis } from '@/decorators.js';
import { CacheService } from '@/core/CacheService.js';

@Injectable()
export class UserNonImageMutingService {
	constructor(
		@Inject(DI.db)
		private db: DataSource,

		private idService: IdService,
		private cacheService: CacheService,
	) {
	}

	@bindThis
	public async mute(user: MiUser, target: MiUser, expiresAt: Date | null = null): Promise<boolean> {
		const created = await this.db.transaction(async manager => {
			await acquireUserMuteLock(manager, user.id, target.id);
			const existing = await manager.getRepository(NonImageMuting).findOneBy({ muterId: user.id, muteeId: target.id });
			if (existing && (existing.expiresAt == null || existing.expiresAt.getTime() > Date.now())) return false;
			if (existing) await manager.getRepository(NonImageMuting).delete(existing.id);
			await manager.getRepository(MiMuting).delete({ muterId: user.id, muteeId: target.id });
			await manager.getRepository(NonImageMuting).insert({
				id: this.idService.gen(),
				expiresAt,
				muterId: user.id,
				muteeId: target.id,
			});
			return true;
		});
		if (!created) return false;

		await Promise.all([
			this.cacheService.userMutingsCache.delete(user.id),
			this.cacheService.nonImageMutingsCache.delete(user.id),
		]);
		return true;
	}

	@bindThis
	public async unmute(mutings: MiNonImageMuting[]): Promise<void> {
		if (mutings.length === 0) return;

		await this.db.transaction(async manager => {
			for (const muting of [...mutings].sort((a, b) => `${a.muterId}:${a.muteeId}`.localeCompare(`${b.muterId}:${b.muteeId}`))) {
				await acquireUserMuteLock(manager, muting.muterId, muting.muteeId);
			}
			await manager.getRepository(NonImageMuting).delete({ id: In(mutings.map(muting => muting.id)) });
		});

		for (const muterId of new Set(mutings.map(muting => muting.muterId))) {
			await this.cacheService.nonImageMutingsCache.delete(muterId);
		}
	}
}
