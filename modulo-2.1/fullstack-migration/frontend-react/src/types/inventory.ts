/**
 * Interface representing an inventory item from the backend API
 */
export interface InventoryItem {
    id: string;
    sku: string;
    product_name: string;
    category: string;
    stock: number;
    price: number;
    last_updated: string;
}
