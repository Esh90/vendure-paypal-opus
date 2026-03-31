import { globalRegistry } from '../../registry/global-registry.js';
import { DashboardRefundDestinationDefinition } from '../types/refund-destinations.js';

globalRegistry.register('refundDestinationRegistry', []);

export function registerRefundDestinationExtensions(
    refundDestinations?: DashboardRefundDestinationDefinition[],
) {
    if (refundDestinations) {
        globalRegistry.set('refundDestinationRegistry', existing => [...existing, ...refundDestinations]);
    }
}

export function getRefundDestinationExtensions(): DashboardRefundDestinationDefinition[] {
    return globalRegistry.get('refundDestinationRegistry') ?? [];
}
