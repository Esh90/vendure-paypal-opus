import { LanguageCode } from '@vendure/common/lib/generated-types';
import { describe, expect, it } from 'vitest';

import { OrderLine } from '../../../entity/order-line/order-line.entity';
import { Order } from '../../../entity/order/order.entity';
import { ProductVariantTranslation } from '../../../entity/product-variant/product-variant-translation.entity';
import { ProductVariant } from '../../../entity/product-variant/product-variant.entity';

import { HydrateOptions } from './entity-hydrator-types';
import { EntityHydrator } from './entity-hydrator.service';

describe('EntityHydrator', () => {
    function getMissingRelations(order: Order, relations: string[]) {
        const hydrator = Object.create(EntityHydrator.prototype) as EntityHydrator & {
            getMissingRelations: (target: Order, options: HydrateOptions<Order>) => string[];
        };

        return hydrator.getMissingRelations(order, {
            relations: relations as HydrateOptions<Order>['relations'],
        });
    }

    it('detects missing nested relations on later array elements', () => {
        const order = new Order({
            lines: [
                new OrderLine({
                    productVariant: new ProductVariant({
                        translations: [
                            new ProductVariantTranslation({
                                languageCode: LanguageCode.en,
                                name: 'Loaded variant',
                            }),
                        ],
                    }),
                }),
                new OrderLine({
                    productVariant: new ProductVariant(),
                }),
            ],
        });

        expect(getMissingRelations(order, ['lines.productVariant.translations'])).toEqual([
            'lines',
            'lines.productVariant',
            'lines.productVariant.translations',
        ]);
    });

    it('does not mark nested relations on empty loaded arrays as missing', () => {
        const order = new Order({
            lines: [],
        });

        expect(getMissingRelations(order, ['lines.productVariant.translations'])).toEqual([]);
    });
});
