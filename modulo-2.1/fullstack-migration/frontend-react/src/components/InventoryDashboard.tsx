import React, { useState, useEffect } from 'react';
import { InventoryItem } from '../types/inventory';

const InventoryDashboard: React.FC = () => {
    // State management
    const [items, setItems] = useState<InventoryItem[]>([]);
    const [filteredItems, setFilteredItems] = useState<InventoryItem[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [categories, setCategories] = useState<string[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    // Fetch inventory data on component mount
    useEffect(() => {
        const fetchInventory = async () => {
            try {
                setLoading(true);
                setError(null);

                const response = await fetch('http://localhost:8080/api/inventory');

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const data: InventoryItem[] = await response.json();

                // Set items
                setItems(data);
                setFilteredItems(data);

                // Extract unique categories dynamically
                const uniqueCategories = Array.from(
                    new Set(data.map((item) => item.category))
                ).sort();
                setCategories(uniqueCategories);

            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : 'Failed to fetch inventory';
                setError(errorMessage);
                console.error('Error fetching inventory:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchInventory();
    }, []);

    // Handle category filter change
    const handleCategoryChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        const category = event.target.value;
        setSelectedCategory(category);

        if (category === 'all') {
            setFilteredItems(items);
        } else {
            setFilteredItems(items.filter((item) => item.category === category));
        }
    };

    // Format price to currency
    const formatPrice = (price: number): string => {
        return `$${price.toFixed(2)}`;
    };

    // Format date
    const formatDate = (dateString: string): string => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    };

    // Loading state
    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-xl text-gray-600">Loading inventory...</div>
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-xl text-red-600">Error: {error}</div>
            </div>
        );
    }

    return (
        <div className="container mx-auto px-4 py-8">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-4xl font-bold text-gray-800 mb-2">
                    Inventory Dashboard
                </h1>
                <p className="text-gray-600">
                    Total Items: {filteredItems.length}
                </p>
            </div>

            {/* Filter Section */}
            <div className="mb-6 flex items-center gap-4">
                <label htmlFor="category-filter" className="text-lg font-medium text-gray-700">
                    Filter by Category:
                </label>
                <select
                    id="category-filter"
                    value={selectedCategory}
                    onChange={handleCategoryChange}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                    <option value="all">All Categories</option>
                    {categories.map((category) => (
                        <option key={category} value={category}>
                            {category}
                        </option>
                    ))}
                </select>
            </div>

            {/* Inventory Table */}
            <div className="overflow-x-auto shadow-lg rounded-lg">
                <table className="min-w-full bg-white border border-gray-200">
                    <thead className="bg-gray-100">
                        <tr>
                            <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider">
                                Name
                            </th>
                            <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider">
                                Category
                            </th>
                            <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider">
                                Price
                            </th>
                            <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider">
                                Stock
                            </th>
                            <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider">
                                Last Updated
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {filteredItems.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                                    No items found in this category
                                </td>
                            </tr>
                        ) : (
                            filteredItems.map((item) => (
                                <tr
                                    key={item.id}
                                    className={`hover:bg-gray-50 transition-colors ${item.stock === 0 ? 'bg-red-50' : ''
                                        }`}
                                >
                                    <td className="px-6 py-4 text-sm text-gray-900">
                                        {item.product_name}
                                        <div className="text-xs text-gray-500">SKU: {item.sku}</div>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-700">
                                        {item.category}
                                    </td>
                                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                                        {formatPrice(item.price)}
                                    </td>
                                    <td
                                        className={`px-6 py-4 text-sm ${item.stock === 0
                                                ? 'text-red-600 font-bold'
                                                : 'text-gray-900'
                                            }`}
                                    >
                                        {item.stock === 0 ? (
                                            <span className="flex items-center gap-2">
                                                <svg
                                                    className="w-5 h-5"
                                                    fill="currentColor"
                                                    viewBox="0 0 20 20"
                                                >
                                                    <path
                                                        fillRule="evenodd"
                                                        d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                                                        clipRule="evenodd"
                                                    />
                                                </svg>
                                                OUT OF STOCK
                                            </span>
                                        ) : (
                                            item.stock
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-700">
                                        {formatDate(item.last_updated)}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Summary Statistics */}
            <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-blue-50 p-6 rounded-lg border border-blue-200">
                    <h3 className="text-lg font-semibold text-blue-900 mb-2">
                        Total Items
                    </h3>
                    <p className="text-3xl font-bold text-blue-600">{items.length}</p>
                </div>
                <div className="bg-green-50 p-6 rounded-lg border border-green-200">
                    <h3 className="text-lg font-semibold text-green-900 mb-2">
                        In Stock
                    </h3>
                    <p className="text-3xl font-bold text-green-600">
                        {items.filter((item) => item.stock > 0).length}
                    </p>
                </div>
                <div className="bg-red-50 p-6 rounded-lg border border-red-200">
                    <h3 className="text-lg font-semibold text-red-900 mb-2">
                        Out of Stock
                    </h3>
                    <p className="text-3xl font-bold text-red-600">
                        {items.filter((item) => item.stock === 0).length}
                    </p>
                </div>
            </div>
        </div>
    );
};

export default InventoryDashboard;
