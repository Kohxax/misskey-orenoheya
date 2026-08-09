/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import type { EntityManager } from 'typeorm';
import type { MiUser } from '@/models/User.js';

export async function acquireUserMuteLock(manager: EntityManager, muterId: MiUser['id'], muteeId: MiUser['id']): Promise<void> {
	await manager.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`${muterId}:${muteeId}`]);
}
