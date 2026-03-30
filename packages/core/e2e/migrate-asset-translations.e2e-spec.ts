import { TransactionalConnection } from '@vendure/core';
import { createTestEnvironment } from '@vendure/testing';
import path from 'path';
import { QueryRunner } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { initialData } from '../../../e2e-common/e2e-initial-data';
import { TEST_SETUP_TIMEOUT_MS, testConfig } from '../../../e2e-common/test-config';
import { migrateAssetTranslationData } from '../src/migration-utils/v3_6_asset_translations';

// TODO: Remove this test file (and the migration helper it tests) once v3.6 has been stable
// for a while. The migration is a one-time operation from the old `name` column on `asset`
// to the new `asset_translation` table. Once all users have upgraded past v3.6, nobody will
// ever run this migration again, and the test will only add maintenance overhead as the
// schema evolves.
describe('migrateAssetTranslationData()', () => {
    const { server } = createTestEnvironment(testConfig());
    let queryRunner: QueryRunner;
    let esc: (name: string) => string;

    // Snapshots of the original translation data, taken before any modifications
    let originalTranslations: Array<{
        id: number;
        languageCode: string;
        name: string;
        baseId: number;
    }>;
    let defaultLanguageCode: string;

    beforeAll(async () => {
        await server.init({
            initialData,
            customerCount: 1,
            productsCsvPath: path.join(__dirname, 'fixtures/e2e-products-minimal.csv'),
        });
        const rawConnection = server.app.get(TransactionalConnection).rawConnection;
        queryRunner = rawConnection.createQueryRunner();
        esc = (name: string) => rawConnection.driver.escape(name);

        // Get the default language code from the default channel
        const channels: Array<{ defaultLanguageCode: string }> = await queryRunner.query(
            `SELECT ${esc('defaultLanguageCode')} FROM ${esc('channel')} WHERE ${esc('code')} = '__default_channel__'`,
        );
        defaultLanguageCode = channels[0].defaultLanguageCode;

        // Snapshot existing translations
        originalTranslations = await queryRunner.query(
            `SELECT ${esc('id')}, ${esc('languageCode')}, ${esc('name')}, ${esc('baseId')}
             FROM ${esc('asset_translation')}`,
        );
    }, TEST_SETUP_TIMEOUT_MS);

    afterAll(async () => {
        if (queryRunner?.isReleased === false) {
            await queryRunner.release();
        }
        await server.destroy();
    });

    /**
     * Simulates the pre-migration database state:
     * 1. Adds a `name` column back to `asset`
     * 2. Populates it from the existing translations
     * 3. Clears the `asset_translation` table
     */
    async function simulatePreMigrationState() {
        await queryRunner.query(`ALTER TABLE ${esc('asset')} ADD ${esc('name')} varchar(255) NULL`);
        for (const row of originalTranslations) {
            await queryRunner.query(
                `UPDATE ${esc('asset')}
                 SET ${esc('name')} = '${row.name.replace(/'/g, "''")}'
                 WHERE ${esc('id')} = ${row.baseId}`,
            );
        }
        await queryRunner.query(`DELETE FROM ${esc('asset_translation')}`);
    }

    /**
     * Restores the database to its original state after a test:
     * 1. Restores translation rows from the snapshot
     * 2. Drops the temporary `name` column from `asset`
     */
    async function restoreOriginalState() {
        await queryRunner.query(`DELETE FROM ${esc('asset_translation')}`);

        for (const row of originalTranslations) {
            await queryRunner.query(
                `INSERT INTO ${esc('asset_translation')} (${esc('id')}, ${esc('languageCode')}, ${esc('name')}, ${esc('baseId')})
                 VALUES (${row.id}, '${row.languageCode}', '${row.name.replace(/'/g, "''")}', ${row.baseId})`,
            );
        }

        const hasName = await queryRunner.hasColumn('asset', 'name');
        if (hasName) {
            await queryRunner.query(`ALTER TABLE ${esc('asset')} DROP COLUMN ${esc('name')}`);
        }
    }

    it('should skip if name column does not exist', async () => {
        const hasName = await queryRunner.hasColumn('asset', 'name');
        expect(hasName).toBe(false);
        // Should not throw
        await migrateAssetTranslationData(queryRunner);
    });

    it('should populate asset_translation from name column', async () => {
        try {
            await simulatePreMigrationState();

            // Verify preconditions
            expect(await queryRunner.hasColumn('asset', 'name')).toBe(true);
            const emptyTranslations = await queryRunner.query(`SELECT * FROM ${esc('asset_translation')}`);
            expect(emptyTranslations).toHaveLength(0);

            // Run the migration
            await migrateAssetTranslationData(queryRunner);

            // Verify: translation rows created for every asset
            const translations: Array<{ languageCode: string; name: string; baseId: number }> =
                await queryRunner.query(
                    `SELECT ${esc('languageCode')}, ${esc('name')}, ${esc('baseId')}
                     FROM ${esc('asset_translation')}`,
                );

            expect(translations.length).toBe(originalTranslations.length);

            for (const original of originalTranslations) {
                expect(translations).toContainEqual(
                    expect.objectContaining({
                        languageCode: defaultLanguageCode,
                        name: original.name,
                        baseId: original.baseId,
                    }),
                );
            }
        } finally {
            await restoreOriginalState();
        }
    });

    it('should be idempotent when called twice', async () => {
        try {
            await simulatePreMigrationState();
            await migrateAssetTranslationData(queryRunner);
            // Running a second time should not throw or produce duplicate rows
            await migrateAssetTranslationData(queryRunner);

            const translations = await queryRunner.query(
                `SELECT ${esc('baseId')} FROM ${esc('asset_translation')}`,
            );
            expect(translations.length).toBe(originalTranslations.length);
        } finally {
            await restoreOriginalState();
        }
    });

    it('should use the default channel language code', async () => {
        try {
            await simulatePreMigrationState();
            await migrateAssetTranslationData(queryRunner);

            const translations: Array<{ languageCode: string }> = await queryRunner.query(
                `SELECT DISTINCT ${esc('languageCode')} FROM ${esc('asset_translation')}`,
            );

            expect(translations).toHaveLength(1);
            expect(translations[0].languageCode).toBe(defaultLanguageCode);
        } finally {
            await restoreOriginalState();
        }
    });

    it('should skip assets with NULL names', async () => {
        try {
            await simulatePreMigrationState();

            // Set one asset's name to NULL to simulate corrupt/incomplete data
            const assets: Array<{ id: number }> = await queryRunner.query(
                `SELECT ${esc('id')} FROM ${esc('asset')} LIMIT 1`,
            );
            const nullAssetId = assets[0].id;
            await queryRunner.query(
                `UPDATE ${esc('asset')} SET ${esc('name')} = NULL WHERE ${esc('id')} = ${nullAssetId}`,
            );

            // Should not throw
            await migrateAssetTranslationData(queryRunner);

            // The NULL-named asset should NOT get a translation row (NOT NULL constraint)
            const translations: Array<{ baseId: number }> = await queryRunner.query(
                `SELECT ${esc('baseId')} FROM ${esc('asset_translation')}`,
            );
            expect(translations.length).toBe(originalTranslations.length - 1);
            expect(translations.map(t => t.baseId)).not.toContain(nullAssetId);
        } finally {
            await restoreOriginalState();
        }
    });
});
