// Read-only projection of the existing SecureOrderPolicy and status transition rules.
export function adminOrderCapabilities(order: {
  status: string;
  securePolicy?: { policyVersion: number } | null;
}) {
  const canEdit = order.securePolicy?.policyVersion === 1;
  const ranks: Record<string, number> = {
    PENDING: 0,
    PROCESSING: 1,
    SHIPPED: 2,
    DELIVERED: 3,
  };
  const allowedStatuses = canEdit
    ? ["PENDING", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"]
        .filter(
          (status) =>
            status === order.status ||
            (order.status !== "CANCELLED" &&
              (status === "CANCELLED"
                ? ranks[order.status] < 2
                : ranks[status] >= ranks[order.status])),
        )
        .map((status) => status.toLowerCase())
    : [];
  return {
    canEdit,
    readOnlyReason: canEdit
      ? null
      : {
          code: "HISTORICAL_ORDER_READ_ONLY",
          message: "Historical orders are read-only.",
        },
    allowedStatuses,
  };
}
