import { RequestContext } from '../../api/common/request-context';
import { OrderLine } from '../../entity/order-line/order-line.entity';

import { OrderLineDiscountDistributionStrategy } from './order-line-discount-distribution-strategy';

/**
 * @description
 * The default {@link OrderLineDiscountDistributionStrategy}. Weights each line by its current
 * prorated line price (incl. tax) and assigns zero weight to fully-cancelled lines (quantity 0).
 * This reproduces Vendure's historical distribution behaviour exactly.
 *
 * @docsCategory orders
 * @docsPage OrderLineDiscountDistributionStrategy
 * @since 3.7.0
 */
export class DefaultOrderLineDiscountDistributionStrategy implements OrderLineDiscountDistributionStrategy {
    getWeight(ctx: RequestContext, line: OrderLine): number {
        return line.quantity !== 0 ? line.proratedLinePriceWithTax : 0;
    }
}
