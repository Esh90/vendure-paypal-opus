import { Injectable } from '@nestjs/common';
import {
    CollectionListOptions,
    CreateCollectionInput,
    DeletionResponse,
    DeletionResult,
    ID,
    Translated,
    UpdateCollectionInput,
} from '@vendure/common/lib/generated-types';
import { PaginatedList } from '@vendure/common/lib/shared-types';
import { In, IsNull } from 'typeorm';

import { RequestContext } from '../../api/common/request-context';
import { RelationPaths } from '../../api/decorators/relations.decorator';
import { Instrument } from '../../common';
import { CollectionFilterDefinition } from '../../config/catalog/collection-filter';
import { ConfigService } from '../../config/config.service';
import { TransactionalConnection } from '../../connection/transactional-connection';
import { Collection } from '../../entity/collection/collection.entity';
import { ProductVariant } from '../../entity/product-variant/product-variant.entity';
import { EventBus } from '../../event-bus/event-bus';
import { AssetEvent } from '../../event-bus/events/asset-event';
import { CustomFieldRelationService } from '../helpers/custom-field-relation/custom-field-relation.service';
import { ListQueryBuilder } from '../helpers/list-query-builder/list-query-builder';
import { patchEntity } from '../helpers/utils/patch-entity';

import { ChannelService } from './channel.service';
import { RoleService } from './role.service';
import { TagService } from './tag.service';

/**
 * @description
 * Contains methods relating to {@link Collection} entities.
 *
 * @docsCategory services
 * @docsPage CollectionService
 */
@Injectable()
@Instrument()
export class CollectionService {
    constructor(
        private connection: TransactionalConnection,
        private configService: ConfigService,
        private listQueryBuilder: ListQueryBuilder,
        private channelService: ChannelService,
        private tagService: TagService,
        private roleService: RoleService,
        private customFieldRelationService: CustomFieldRelationService,
        private eventBus: EventBus,
    ) {}

    /**
     * @description
     * Returns a Map of collection IDs to their product variant counts.
     * This performs a single bulk query to get variant counts for all provided collection IDs,
     * avoiding N+1 query issues when resolving `productVariantCount` on multiple collections.
     */
    async getProductVariantCounts(ctx: RequestContext, collectionIds: ID[]): Promise<Map<ID, number>> {
        if (collectionIds.length === 0) {
            return new Map();
        }
        const results = await this.connection
            .getRepository(ctx, ProductVariant)
            .createQueryBuilder('productvariant')
            .select('collection.id', 'collectionId')
            .addSelect('COUNT(DISTINCT productvariant.id)', 'count')
            .innerJoin('productvariant.channels', 'channel', 'channel.id = :channelId', {
                channelId: ctx.channelId,
            })
            .innerJoin('productvariant.collections', 'collection', 'collection.id IN (:...collectionIds)', {
                collectionIds,
            })
            .innerJoin('productvariant.product', 'product')
            .andWhere('product.deletedAt IS NULL')
            .andWhere('productvariant.deletedAt IS NULL')
            .groupBy('collection.id')
            .getRawMany<{ collectionId: string; count: string }>();

        const countMap = new Map<ID, number>();
        for (const id of collectionIds) {
            countMap.set(String(id), 0);
        }
        for (const result of results) {
            countMap.set(String(result.collectionId), Number(result.count));
        }
        return countMap;
    }

    /**
     * @description
     * Returns a Map of collection IDs to their product variants.
     * This performs a single bulk query to get variants for all provided collection IDs,
     * avoiding N+1 query issues when resolving `productVariants` on multiple collections.
     */
    async getProductVariantsForCollections(
        ctx: RequestContext,
        collectionIds: ID[],
    ): Promise<Map<ID, ProductVariant[]>> {
        if (collectionIds.length === 0) {
            return new Map();
        }
        const allVariants = await this.connection.getRepository(ctx, ProductVariant).find({
            relations: ['collections', 'channels', 'product', 'featuredAsset'],
            where: {
                collections: {
                    id: In(collectionIds),
                },
                channels: {
                    id: ctx.channelId,
                },
                product: {
                    deletedAt: IsNull(),
                },
                deletedAt: IsNull(),
            },
        });

        const variantsByCollectionId = new Map<ID, ProductVariant[]>();
        for (const id of collectionIds) {
            variantsByCollectionId.set(id, []);
        }

        for (const variant of allVariants) {
            for (const collection of variant.collections) {
                if (variantsByCollectionId.has(collection.id)) {
                    const variants = variantsByCollectionId.get(collection.id);
                    variants?.push(variant);
                }
            }
        }
        return variantsByCollectionId;
    }

    findOne(
        ctx: RequestContext,
        id: ID,
        relations?: RelationPaths<Collection>,
    ): Promise<Translated<Collection> | undefined> {
        return this.connection
            .findOneInChannel(ctx, Collection, id, ctx.channelId, {
                relations: relations ?? [],
            })
            .then(result => (result ? this.translator.translate(result, ctx) : undefined));
    }

    findOneBySlug(
        ctx: RequestContext,
        slug: string,
        relations?: RelationPaths<Collection>,
    ): Promise<Translated<Collection> | undefined> {
        return this.connection
            .getRepository(ctx, Collection)
            .findOne({
                where: {
                    slug,
                    channels: { id: ctx.channelId },
                },
                relations: relations ?? [],
            })
            .then(result => (result ? this.translator.translate(result, ctx) : undefined));
    }

    findAll(
        ctx: RequestContext,
        options?: CollectionListOptions,
        relations?: RelationPaths<Collection>,
    ): Promise<PaginatedList<Translated<Collection>>> {
        return this.listQueryBuilder
            .build(Collection, options, {
                ctx,
                relations: relations ?? [],
                channelId: ctx.channelId,
            })
            .getManyAndCount()
            .then(([items, totalItems]) => ({
                items: items.map(item => this.translator.translate(item, ctx)),
                totalItems,
            }));
    }

    getAvailableFilters(ctx: RequestContext): CollectionFilterDefinition[] {
        return this.configService.collectionOptions.collectionFilters;
    }

    @Transaction()
    async create(ctx: RequestContext, input: CreateCollectionInput): Promise<Translated<Collection>> {
        const collection = await this.connection.getRepository(ctx, Collection).save(new Collection(input));
        await this.channelService.assignToCurrentChannel(collection, ctx);
        if (input.assetIds) {
            await this.updateEntityAssets(ctx, collection, input);
        }
        if (input.filters) {
            collection.filters = input.filters;
            await this.connection.getRepository(ctx, Collection).save(collection);
        }
        await this.eventBus.publish(new AssetEvent(ctx, collection, 'created', input));
        return this.findOne(ctx, collection.id) as Promise<Translated<Collection>>;
    }

    @Transaction()
    async update(ctx: RequestContext, input: UpdateCollectionInput): Promise<Translated<Collection>> {
        const collection = await this.connection.getEntityOrThrow(ctx, Collection, input.id);
        patchEntity(collection, input);
        if (input.assetIds || input.featuredAssetId) {
            await this.updateEntityAssets(ctx, collection, input);
        }
        if (input.filters) {
            collection.filters = input.filters;
        }
        const updatedCollection = await this.connection.getRepository(ctx, Collection).save(collection);
        await this.eventBus.publish(new AssetEvent(ctx, updatedCollection, 'updated', input));
        return this.findOne(ctx, collection.id) as Promise<Translated<Collection>>;
    }

    @Transaction()
    async move(ctx: RequestContext, input: any): Promise<Translated<Collection>> {
        // Implementation of move logic
        return this.findOne(ctx, input.id) as Promise<Translated<Collection>>;
    }

    @Transaction()
    async delete(ctx: RequestContext, id: ID): Promise<DeletionResponse> {
        const collection = await this.connection.getEntityOrThrow(ctx, Collection, id);
        await this.connection.getRepository(ctx, Collection).remove(collection);
        return { result: DeletionResult.DELETED };
    }

    private get translator() {
        return (this as any).translatorService; // Placeholder for internal translator access
    }

    private async updateEntityAssets(ctx: RequestContext, entity: Collection, input: any) {
        // Placeholder for asset update logic
    }
}
