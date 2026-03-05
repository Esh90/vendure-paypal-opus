import { TransactionalConnection } from '@vendure/core';
import { createTestEnvironment } from '@vendure/testing';
import path from 'path';
import { QueryRunner } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { initialData } from '../../../e2e-common/e2e-initial-data';
import { TEST_SETUP_TIMEOUT_MS, testConfig } from '../../../e2e-common/test-config';
import { migrateProductOptionGroupData } from '../src/migration-utils/v3_6_shared_option_groups';

describe('migrateProductOptionGroupData()', () => {
    const { server, adminClient } = createTestEnvironment(testConfig());
    let queryRunner: QueryRunner;
    let e: (name: string) => string;

    // Snapshots of the original join table data, taken before any modifications
    let originalProductGroups: Array<{ productId: number; productOptionGroupId: number }>;
    let originalGroupChannels: Array<{ productOptionGroupId: number; channelId: number }>;
    let originalOptionChannels: Array<{ productOptionId: number; channelId: number }>;

    beforeAll(async () => {
        await server.init({
            initialData,
            customerCount: 1,
            productsCsvPath: path.join(__dirname, 'fixtures/e2e-products-minimal.csv'),
        });
        await adminClient.asSuperAdmin();
        const rawConnection = server.app.get(TransactionalConnection).rawConnection;
        queryRunner = rawConnection.createQueryRunner();
        e = (name: string) => rawConnection.driver.escape(name);

        // Snapshot the original join table data (populated during server init)
        originalProductGroups = await queryRunner.query(
            `SELECT ${e('productId')}, ${e('productOptionGroupId')}
             FROM ${e('product_option_groups_product_option_group')}`,
        );
        originalGroupChannels = await queryRunner.query(
            `SELECT ${e('productOptionGroupId')}, ${e('channelId')}
             FROM ${e('product_option_group_channels_channel')}`,
        );
        originalOptionChannels = await queryRunner.query(
            `SELECT ${e('productOptionId')}, ${e('channelId')}
             FROM ${e('product_option_channels_channel')}`,
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
     * 1. Adds a `productId` column to `product_option_group`
     * 2. Populates it from the snapshot
     * 3. Clears the join tables that migrateProductOptionGroupData will populate
     */
    async function simulatePreMigrationState() {
        // Add the old-style productId column
        await queryRunner.query(`ALTER TABLE ${e('product_option_group')} ADD ${e('productId')} int NULL`);

        // Populate productId from the snapshot (each group maps to one product in test data)
        for (const row of originalProductGroups) {
            await queryRunner.query(
                `UPDATE ${e('product_option_group')}
                 SET ${e('productId')} = ${row.productId}
                 WHERE ${e('id')} = ${row.productOptionGroupId}`,
            );
        }

        // Clear the join tables
        await queryRunner.query(`DELETE FROM ${e('product_option_channels_channel')}`);
        await queryRunner.query(`DELETE FROM ${e('product_option_group_channels_channel')}`);
        await queryRunner.query(`DELETE FROM ${e('product_option_groups_product_option_group')}`);
    }

    /**
     * Restores the database to its original state after a test:
     * 1. Restores join table data from the snapshots
     * 2. Drops the temporary `productId` column (with FK check workaround for SQLite)
     */
    async function restoreOriginalState() {
        // First, restore join table data so FK constraints are satisfied
        await queryRunner.query(`DELETE FROM ${e('product_option_channels_channel')}`);
        await queryRunner.query(`DELETE FROM ${e('product_option_group_channels_channel')}`);
        await queryRunner.query(`DELETE FROM ${e('product_option_groups_product_option_group')}`);

        for (const row of originalProductGroups) {
            await queryRunner.query(
                `INSERT INTO ${e('product_option_groups_product_option_group')}
                 (${e('productId')}, ${e('productOptionGroupId')}) VALUES (${row.productId}, ${row.productOptionGroupId})`,
            );
        }
        for (const row of originalGroupChannels) {
            await queryRunner.query(
                `INSERT INTO ${e('product_option_group_channels_channel')}
                 (${e('productOptionGroupId')}, ${e('channelId')}) VALUES (${row.productOptionGroupId}, ${row.channelId})`,
            );
        }
        for (const row of originalOptionChannels) {
            await queryRunner.query(
                `INSERT INTO ${e('product_option_channels_channel')}
                 (${e('productOptionId')}, ${e('channelId')}) VALUES (${row.productOptionId}, ${row.channelId})`,
            );
        }

        // Drop the temporary productId column via raw SQL.
        // We can't use queryRunner.dropColumn() because TypeORM's metadata
        // doesn't know about columns added via raw ALTER TABLE.
        const hasProductId = await queryRunner.hasColumn('product_option_group', 'productId');
        if (hasProductId) {
            await queryRunner.query(`ALTER TABLE ${e('product_option_group')} DROP COLUMN ${e('productId')}`);
        }
    }

    it('should skip if productId column does not exist', async () => {
        // The current schema has no productId column, so this should no-op
        const hasProductId = await queryRunner.hasColumn('product_option_group', 'productId');
        expect(hasProductId).toBe(false);

        // Should not throw
        await migrateProductOptionGroupData(queryRunner);
    });

    it('should populate join tables from productId FK column', async () => {
        await simulatePreMigrationState();

        try {
            // Verify preconditions: join tables are empty, productId column exists
            const hasProductId = await queryRunner.hasColumn('product_option_group', 'productId');
            expect(hasProductId).toBe(true);

            const emptyJoin: any[] = await queryRunner.query(
                `SELECT * FROM ${e('product_option_groups_product_option_group')}`,
            );
            expect(emptyJoin).toHaveLength(0);

            // Run the migration
            await migrateProductOptionGroupData(queryRunner);

            // Verify: Product <-> ProductOptionGroup join table
            const productGroups: Array<{ productId: number; productOptionGroupId: number }> =
                await queryRunner.query(
                    `SELECT ${e('productId')}, ${e('productOptionGroupId')}
                     FROM ${e('product_option_groups_product_option_group')}
                     ORDER BY ${e('productOptionGroupId')}`,
                );
            expect(productGroups.length).toBe(originalProductGroups.length);
            for (const expected of originalProductGroups) {
                expect(productGroups).toContainEqual(
                    expect.objectContaining({
                        productId: expected.productId,
                        productOptionGroupId: expected.productOptionGroupId,
                    }),
                );
            }

            // Verify: ProductOptionGroup channel assignments
            const groupChannels: Array<{ productOptionGroupId: number; channelId: number }> =
                await queryRunner.query(
                    `SELECT ${e('productOptionGroupId')}, ${e('channelId')}
                     FROM ${e('product_option_group_channels_channel')}
                     ORDER BY ${e('productOptionGroupId')}`,
                );
            expect(groupChannels.length).toBe(originalGroupChannels.length);
            for (const expected of originalGroupChannels) {
                expect(groupChannels).toContainEqual(
                    expect.objectContaining({
                        productOptionGroupId: expected.productOptionGroupId,
                        channelId: expected.channelId,
                    }),
                );
            }

            // Verify: ProductOption channel assignments
            const optionChannels: Array<{ productOptionId: number; channelId: number }> =
                await queryRunner.query(
                    `SELECT ${e('productOptionId')}, ${e('channelId')}
                     FROM ${e('product_option_channels_channel')}
                     ORDER BY ${e('productOptionId')}`,
                );
            expect(optionChannels.length).toBe(originalOptionChannels.length);
            for (const expected of originalOptionChannels) {
                expect(optionChannels).toContainEqual(
                    expect.objectContaining({
                        productOptionId: expected.productOptionId,
                        channelId: expected.channelId,
                    }),
                );
            }
        } finally {
            await restoreOriginalState();
        }
    });

    it('should assign orphaned option groups to default channel', async () => {
        await simulatePreMigrationState();

        try {
            // Get the default channel ID
            const channels: Array<{ id: number }> = await queryRunner.query(
                `SELECT ${e('id')} FROM ${e('channel')} WHERE ${e('code')} = '__default_channel__'`,
            );
            const defaultChannelId = channels[0].id;

            // Get all option group IDs
            const allGroups: Array<{ id: number }> = await queryRunner.query(
                `SELECT ${e('id')} FROM ${e('product_option_group')}`,
            );

            // Set one group's productId to NULL to simulate an orphan
            const orphanGroupId = allGroups[0].id;
            await queryRunner.query(
                `UPDATE ${e('product_option_group')}
                 SET ${e('productId')} = NULL
                 WHERE ${e('id')} = ${orphanGroupId}`,
            );

            // Run the migration
            await migrateProductOptionGroupData(queryRunner);

            // Verify orphaned group was assigned to default channel
            const orphanChannels: Array<{ productOptionGroupId: number; channelId: number }> =
                await queryRunner.query(
                    `SELECT ${e('productOptionGroupId')}, ${e('channelId')}
                     FROM ${e('product_option_group_channels_channel')}
                     WHERE ${e('productOptionGroupId')} = ${orphanGroupId}`,
                );
            expect(orphanChannels.length).toBeGreaterThanOrEqual(1);
            expect(orphanChannels).toContainEqual(
                expect.objectContaining({
                    productOptionGroupId: orphanGroupId,
                    channelId: defaultChannelId,
                }),
            );
        } finally {
            await restoreOriginalState();
        }
    });
});
