import { ConfigurableOperationInput } from '@vendure/common/lib/generated-types';
import { beforeEach, describe, expect, it } from 'vitest';

import { PromotionItemAction, PromotionOrderAction } from '../../config';
import { EntityIdStrategy } from '../../config/entity/entity-id-strategy';

import { ConfigurableOperationCodec } from './configurable-operation-codec';
import { IdCodec } from './id-codec';
import { IdCodecService } from './id-codec.service';

/**
 * A strict ID strategy that prefixes IDs with "h_".
 * Unlike the default AutoIncrementIdStrategy, this will throw
 * on double-decode since a raw number like 42 is not a valid encoded ID.
 */
class TestHashedIdStrategy implements EntityIdStrategy<'increment'> {
    readonly primaryKeyType = 'increment' as const;
    encodeId(primaryKey: number): string {
        return `h_${primaryKey}`;
    }
    decodeId(id: string): number {
        if (typeof id !== 'string' || !id.startsWith('h_')) {
            throw new Error(`Invalid ID: ${id}`);
        }
        return parseInt(id.substring(2), 10);
    }
}

describe('ConfigurableOperationCodec', () => {
    let codec: ConfigurableOperationCodec;

    const testAction = new PromotionItemAction({
        code: 'test_action',
        description: [{ languageCode: 'en' as any, value: 'test' }],
        args: {
            productVariantIds: { type: 'ID', list: true },
            discount: { type: 'float' },
        },
        execute: () => 0,
    });

    beforeEach(() => {
        const idStrategy = new TestHashedIdStrategy();
        const idCodec = new IdCodec(idStrategy);
        const idCodecService = {
            encode: (target: any, transformKeys?: string[]) => idCodec.encode(target, transformKeys),
            decode: (target: any, transformKeys?: string[]) => idCodec.decode(target, transformKeys),
        } as IdCodecService;

        const mockConfigService = {
            promotionOptions: {
                promotionActions: [testAction],
            },
        } as any;

        codec = new ConfigurableOperationCodec(mockConfigService, idCodecService);
    });

    describe('decodeConfigurableOperationIds', () => {
        it('decodes ID list args with custom EntityIdStrategy', () => {
            const input: ConfigurableOperationInput[] = [
                {
                    code: 'test_action',
                    arguments: [
                        { name: 'productVariantIds', value: '["h_1","h_2"]' },
                        { name: 'discount', value: '10' },
                    ],
                },
            ];

            codec.decodeConfigurableOperationIds(PromotionItemAction, input);

            expect(input[0].arguments[0].value).toBe('[1,2]');
            expect(input[0].arguments[1].value).toBe('10');
        });

        // Regression test for https://github.com/vendurehq/vendure/issues/4700
        it('does not double-decode when called twice with types sharing the same pool', () => {
            const input: ConfigurableOperationInput[] = [
                {
                    code: 'test_action',
                    arguments: [
                        { name: 'productVariantIds', value: '["h_1","h_2"]' },
                    ],
                },
            ];

            // First decode works fine
            codec.decodeConfigurableOperationIds(PromotionOrderAction, input);
            expect(input[0].arguments[0].value).toBe('[1,2]');

            // Second decode on the same input should throw because
            // the values are already decoded raw numbers, not valid encoded IDs
            expect(() => {
                codec.decodeConfigurableOperationIds(PromotionItemAction, input);
            }).toThrowError('Invalid ID: 1');
        });
    });

    describe('encodeConfigurableOperationIds', () => {
        it('encodes ID list args with custom EntityIdStrategy', () => {
            const input = [
                {
                    code: 'test_action',
                    args: [
                        { name: 'productVariantIds', value: '[1,2]' },
                        { name: 'discount', value: '10' },
                    ],
                },
            ];

            codec.encodeConfigurableOperationIds(PromotionItemAction, input);

            expect(input[0].args[0].value).toBe('["h_1","h_2"]');
            expect(input[0].args[1].value).toBe('10');
        });
    });
});
