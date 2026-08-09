/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { DI } from '@/di-symbols.js';
import type { MutingsRepository, NonImageMutingsRepository } from '@/models/_.js';
import type Logger from '@/logger.js';
import { bindThis } from '@/decorators.js';
import { UserMutingService } from '@/core/UserMutingService.js';
import { ChannelMutingService } from '@/core/ChannelMutingService.js';
import { UserNonImageMutingService } from '@/core/UserNonImageMutingService.js';
import { QueueLoggerService } from '../QueueLoggerService.js';

@Injectable()
export class CheckExpiredMutingsProcessorService {
	private logger: Logger;

	constructor(
		@Inject(DI.mutingsRepository)
		private mutingsRepository: MutingsRepository,

		@Inject(DI.nonImageMutingsRepository)
		private nonImageMutingsRepository: NonImageMutingsRepository,

		private userMutingService: UserMutingService,
		private userNonImageMutingService: UserNonImageMutingService,
		private channelMutingService: ChannelMutingService,
		private queueLoggerService: QueueLoggerService,
	) {
		this.logger = this.queueLoggerService.logger.createSubLogger('check-expired-mutings');
	}

	@bindThis
	public async process(): Promise<void> {
		this.logger.info('Checking expired mutings...');

		const expired = await this.mutingsRepository.createQueryBuilder('muting')
			.where('muting.expiresAt IS NOT NULL')
			.andWhere('muting.expiresAt < :now', { now: new Date() })
			.innerJoinAndSelect('muting.mutee', 'mutee')
			.getMany();

		if (expired.length > 0) {
			await this.userMutingService.unmute(expired);
		}

		const expiredNonImageMutings = await this.nonImageMutingsRepository.createQueryBuilder('muting')
			.where('muting.expiresAt IS NOT NULL')
			.andWhere('muting.expiresAt < :now', { now: new Date() })
			.getMany();
		await this.userNonImageMutingService.unmute(expiredNonImageMutings);

		await this.channelMutingService.eraseExpiredMutings();

		this.logger.succ('All expired mutings checked.');
	}
}
