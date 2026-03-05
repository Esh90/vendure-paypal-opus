/* eslint-disable no-console */
import { QueryRunner } from 'typeorm';

/**
 * @description
 * Populates the new join tables for shared, channel-aware ProductOptionGroups
 * using data from the existing `productId` FK column on `product_option_group`.
 *
 * Call this from your migration's `up()` method **after** the new join tables
 * have been created and **before** the `productId` column is dropped.
 *
 * ```ts
 * import { MigrationInterface, QueryRunner } from 'typeorm';
 * import { migrateProductOptionGroupData } from '\@vendure/core';
 *
 * export class SharedOptionGroups1234567890 implements MigrationInterface {
 *     public async up(queryRunner: QueryRunner): Promise<any> {
 *         // --- Auto-generated DDL starts here ---
 *         // (Create new join tables and FK constraints)
 *         // ...
 *
 *         // --- Populate new tables with existing data ---
 *         await migrateProductOptionGroupData(queryRunner);
 *
 *         // --- Auto-generated DDL continues ---
 *         // (Drop old productId FK and column)
 *         // ...
 *     }
 *
 *     public async down(queryRunner: QueryRunner): Promise<any> {
 *         // Auto-generated reverse DDL
 *     }
 * }
 * ```
 *
 * @since 3.6.0
 * @docsCategory migration
 */
export async function migrateProductOptionGroupData(queryRunner: QueryRunner): Promise<void> {
    const hasProductId = await queryRunner.hasColumn('product_option_group', 'productId');
    if (!hasProductId) {
        console.log(
            'The productId column on product_option_group does not exist. ' +
                'Skipping data migration (already completed?).',
        );
        return;
    }

    const e = (name: string) => queryRunner.connection.driver.escape(name);

    // 1. Populate Product <-> ProductOptionGroup join table from existing FK
    await queryRunner.query(
        `INSERT INTO ${e('product_option_groups_product_option_group')} (${e('productId')}, ${e('productOptionGroupId')})
         SELECT ${e('productId')}, ${e('id')} FROM ${e('product_option_group')} WHERE ${e('productId')} IS NOT NULL`,
    );

    // 2. Populate ProductOptionGroup channel assignments (inherit from parent product's channels)
    await queryRunner.query(
        `INSERT INTO ${e('product_option_group_channels_channel')} (${e('productOptionGroupId')}, ${e('channelId')})
         SELECT DISTINCT pog.${e('id')}, pc.${e('channelId')}
         FROM ${e('product_option_group')} pog
         INNER JOIN ${e('product_channels_channel')} pc ON pc.${e('productId')} = pog.${e('productId')}
         WHERE pog.${e('productId')} IS NOT NULL`,
    );

    // 3. Populate ProductOption channel assignments (inherit from parent group's channels)
    await queryRunner.query(
        `INSERT INTO ${e('product_option_channels_channel')} (${e('productOptionId')}, ${e('channelId')})
         SELECT DISTINCT po.${e('id')}, pogc.${e('channelId')}
         FROM ${e('product_option')} po
         INNER JOIN ${e('product_option_group_channels_channel')} pogc ON pogc.${e('productOptionGroupId')} = po.${e('groupId')}`,
    );

    // 4. Handle orphaned option groups (NULL productId) — assign to default channel
    await queryRunner.query(
        `INSERT INTO ${e('product_option_group_channels_channel')} (${e('productOptionGroupId')}, ${e('channelId')})
         SELECT pog.${e('id')}, (SELECT ${e('id')} FROM ${e('channel')} WHERE ${e('code')} = '__default_channel__')
         FROM ${e('product_option_group')} pog
         WHERE pog.${e('id')} NOT IN (SELECT ${e('productOptionGroupId')} FROM ${e('product_option_group_channels_channel')})`,
    );

    // 5. Handle orphaned options — assign to default channel
    await queryRunner.query(
        `INSERT INTO ${e('product_option_channels_channel')} (${e('productOptionId')}, ${e('channelId')})
         SELECT po.${e('id')}, (SELECT ${e('id')} FROM ${e('channel')} WHERE ${e('code')} = '__default_channel__')
         FROM ${e('product_option')} po
         WHERE po.${e('id')} NOT IN (SELECT ${e('productOptionId')} FROM ${e('product_option_channels_channel')})`,
    );

    console.log('Successfully migrated ProductOptionGroup data to new join tables.');
}
