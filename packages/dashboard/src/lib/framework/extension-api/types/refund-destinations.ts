/**
 * @description
 * Defines a custom refund destination for the dashboard.
 * Each entry corresponds to a backend `RefundDestinationStrategy` matched by `code`.
 *
 * @docsCategory extensions-api
 * @since 3.6.0
 */
export interface DashboardRefundDestinationDefinition {
    /**
     * @description
     * Must match the `code` of the corresponding backend `RefundDestinationStrategy`.
     */
    code: string;
    /**
     * @description
     * Optional icon component rendered next to the destination label.
     */
    icon?: React.ComponentType<{ className?: string }>;
    /**
     * @description
     * Optional component rendered when this destination is selected,
     * for extra configuration (e.g. store credit expiry date).
     */
    component?: React.ComponentType<RefundDestinationComponentProps>;
}

/**
 * @description
 * Props passed to the custom component of a refund destination.
 *
 * @docsCategory extensions-api
 * @since 3.6.0
 */
export interface RefundDestinationComponentProps {
    /** The full order object from the order detail query. */
    order: Record<string, unknown>;
    refundTotal: number;
    currencyCode: string;
    /**
     * @description
     * Callback to pass custom metadata from the destination component
     * back to the refund flow. This data will be included in the
     * refund mutation input's metadata.
     */
    onData?: (data: Record<string, unknown>) => void;
}
