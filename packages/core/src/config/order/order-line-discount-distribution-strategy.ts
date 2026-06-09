import { RequestContext } from '../../api/common/request-context';
import { InjectableStrategy } from '../../common/types/injectable-strategy';
import { OrderLine } from '../../entity/order-line/order-line.entity';
import { Order } from '../../entity/order/order.entity';

/**
 * @description
 * Determines the weight used to distribute (prorate) an order-level promotion discount across the
 * {@link OrderLine}s of an {@link Order}. The weights returned for all lines are fed into the
 * `prorate()` helper, which splits the total order-level discount amount proportionally.
 *
 * This makes it possible to control what happens to the distribution when a line is canceled or
 * refunded. The default strategy gives a fully-canceled line (quantity 0) a weight of 0, so its
 * share of the discount is redistributed across the remaining lines. A custom strategy can instead
 * weight lines by their originally-placed quantity, keeping each surviving line's share stable when
 * another line is refunded.
 *
 * :::info
 *
 * This is configured via the `orderOptions.orderLineDiscountDistributionStrategy` property of
 * your VendureConfig.
 *
 * :::
 *
 * @docsCategory orders
 * @docsPage OrderLineDiscountDistributionStrategy
 * @docsWeight 0
 * @since 3.7.0
 */
export interface OrderLineDiscountDistributionStrategy extends InjectableStrategy {
    /**
     * @description
     * Returns the (non-negative) weight for the given OrderLine. Returning 0 excludes the line from
     * receiving any share of the order-level discount.
     */
    getWeight(ctx: RequestContext, line: OrderLine, order: Order): number;
}
