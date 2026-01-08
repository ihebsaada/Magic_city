export interface CreateOrderItemDto {
  productId: number;
  quantity: number;
  selectedSize?: string;
  selectedColor?: string;
}

export interface CreateOrderDto {
  customerName: string;
  customerEmail: string;
  items: CreateOrderItemDto[];
}
