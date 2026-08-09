/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export class AddNonImageMuting1786231866234 {
    name = 'AddNonImageMuting1786231866234'

    async up(queryRunner) {
        await queryRunner.query(`CREATE TABLE "non_image_muting" ("id" character varying(32) NOT NULL, "expiresAt" TIMESTAMP WITH TIME ZONE, "muteeId" character varying(32) NOT NULL, "muterId" character varying(32) NOT NULL, CONSTRAINT "PK_b892559d0015e1a943483bb3033" PRIMARY KEY ("id"))`);
        await queryRunner.query(`COMMENT ON COLUMN "non_image_muting"."muteeId" IS 'The mutee user ID.'`);
        await queryRunner.query(`COMMENT ON COLUMN "non_image_muting"."muterId" IS 'The muter user ID.'`);
        await queryRunner.query(`CREATE INDEX "IDX_fb47592a1e3d8452ca9f5158c4" ON "non_image_muting" ("expiresAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_557949e6e4ce694e9d7657cf67" ON "non_image_muting" ("muteeId") `);
        await queryRunner.query(`CREATE INDEX "IDX_bea008d531263c0be0ab3b2fcc" ON "non_image_muting" ("muterId") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_50f87e698511fe7fb83dd857c0" ON "non_image_muting" ("muterId", "muteeId") `);
        await queryRunner.query(`ALTER TABLE "non_image_muting" ADD CONSTRAINT "FK_557949e6e4ce694e9d7657cf675" FOREIGN KEY ("muteeId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "non_image_muting" ADD CONSTRAINT "FK_bea008d531263c0be0ab3b2fccb" FOREIGN KEY ("muterId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "non_image_muting" DROP CONSTRAINT "FK_bea008d531263c0be0ab3b2fccb"`);
        await queryRunner.query(`ALTER TABLE "non_image_muting" DROP CONSTRAINT "FK_557949e6e4ce694e9d7657cf675"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_50f87e698511fe7fb83dd857c0"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_bea008d531263c0be0ab3b2fcc"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_557949e6e4ce694e9d7657cf67"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_fb47592a1e3d8452ca9f5158c4"`);
        await queryRunner.query(`DROP TABLE "non_image_muting"`);
    }
}
