import React, { useState, useEffect } from 'react';

import Button from './common/Button';

const LoadingSpinner = () => (
    <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-emerald-500"></div>
    </div>
);

interface StockPrepOrder {
    id: string;
    customerName: string;
    products: { name: string; quantity: number }[];
    deliveryDate: string;
    type: 'Subscription' | 'Retail' | 'Wholesale';
    address?: string;
    phone?: string;
}

interface DayData {
    date: string;
    day: string;
    deliveries: StockPrepOrder[];
    totalBoxes: number;
    breakdown: {
        subscriptions: number;
        retail: number;
        wholesale: number;
    };
}

interface StockPrepData {
    today: DayData;
    tomorrow: DayData;
}

const StockPrep: React.FC = () => {
    const [stockData, setStockData] = useState<StockPrepData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

  
const fetchStockPrep = React.useCallback(async () => {
    console.log('[DEBUG] fetchStockPrep() called');
    setLoading(true);
    setError(null);

    try {
        const response = await fetch('https://shroommush.onrender.com/api/stock-prep', {
            headers: { 'Content-Type': 'application/json' },
        });

        console.log('[DEBUG] Response status:', response.status);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const raw = await response.json();
        console.log('[DEBUG] Parsed data:', raw);

        // Backend already calculates today/tomorrow in IST – if missing, bail
        if (!raw.today || !raw.tomorrow) {
            console.warn('[DEBUG] Incomplete stock prep response', raw);
            setStockData(null);
            return;
        }

        // Map backend delivery -> UI StockPrepOrder
        const mapDelivery = (d: any): StockPrepOrder => {
            const base = {
                id: d.id,
                customerName: d.customerName || d.name || 'Unknown',
                deliveryDate: d.deliveryDate || d.date || '',
                type: (d.type as StockPrepOrder['type']) || 'Retail',
                address: d.address || '',
                phone: d.phone || d.contact || '',
            };

            // Subscriptions: backend sends "boxes" + "plan"
            if (base.type === 'Subscription') {
                const boxes = d.boxes ?? d.quantity ?? 0;
                const planName = d.plan || 'Subscription';
                const products =
                    boxes > 0 ? [{ name: planName, quantity: boxes }] : [];
                return { ...base, products };
            }

            // Retail / Wholesale: backend sends "products"
            const apiProducts = Array.isArray(d.products) ? d.products : [];
            const products = apiProducts.map((p: any) => ({
                name: p.name || p.productName || 'Item',
                quantity: p.quantity ?? p.qty ?? 0,
            }));

            return { ...base, products };
        };

        // Build DayData from backend "today"/"tomorrow"
        const buildDayData = (day: any): DayData => {
            const deliveries: StockPrepOrder[] = (day.deliveries || []).map(mapDelivery);

            const totalBoxes = deliveries.reduce(
                (sum, d) =>
                    sum +
                    d.products.reduce(
                        (pSum, p) => pSum + (p.quantity || 0),
                        0
                    ),
                0
            );

            return {
                date: day.date,
                day: day.day,
                deliveries,
                totalBoxes,
                breakdown: {
                    subscriptions: deliveries.filter(d => d.type === 'Subscription').length,
                    retail: deliveries.filter(d => d.type === 'Retail').length,
                    wholesale: deliveries.filter(d => d.type === 'Wholesale').length,
                },
            };
        };

        const finalStockData: StockPrepData = {
            today: buildDayData(raw.today),
            tomorrow: buildDayData(raw.tomorrow),
        };

        console.log('[DEBUG] finalStockData:', finalStockData);
        setStockData(finalStockData);
    } catch (err) {
        console.error('[DEBUG] fetchStockPrep error:', err);
        setError((err as Error).message || 'Failed to load stock data');
    } finally {
        setLoading(false);
    }
}, []);


useEffect(() => {
    fetchStockPrep();
}, [fetchStockPrep]);



    const getTypeBadgeClass = (type: string) => {
        switch (type) {
            case 'Subscription':
                return 'bg-blue-500/20 text-blue-400';
            case 'Retail':
                return 'bg-green-500/20 text-green-400';
            case 'Wholesale':
                return 'bg-purple-500/20 text-purple-400';
            default:
                return 'bg-gray-500/20 text-gray-400';
        }
    };
const DeliverySection = ({ title, data }: { title: string; data: DayData }) => (
    <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-xl shadow-lg p-6 mb-6">
        <div className="flex justify-between items-center mb-4">
            <div>
                <h3 className="text-xl font-semibold text-emerald-400">{title}</h3>
                <p className="text-gray-400 text-sm">
                    {data.day}, {data.date}
                </p>
            </div>
            <div className="bg-emerald-500/20 rounded-lg px-4 py-2">
                <p className="text-2xl font-bold text-emerald-400">{data.totalBoxes}</p>
                <p className="text-xs text-gray-400">Total Boxes</p>
            </div>
        </div>

        <div className="flex gap-2 mb-4 flex-wrap">
            <span className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-xs font-medium">
                {data.breakdown.subscriptions} Subscriptions
            </span>
            <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-xs font-medium">
                {data.breakdown.retail} Retail
            </span>
            <span className="px-3 py-1 bg-purple-500/20 text-purple-400 rounded-full text-xs font-medium">
                {data.breakdown.wholesale} Wholesale
            </span>
        </div>

        {data.deliveries.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No deliveries scheduled</p>
        ) : (
            <div className="space-y-3">
                {data.deliveries.map((delivery) => (
                    <div
                        key={`${delivery.type}-${delivery.id}`}
                        className="bg-white/5 rounded-lg p-4 border border-white/5"
                    >
                        <div className="flex justify-between items-start">
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                    <h4 className="font-semibold text-white">
                                        {delivery.customerName}
                                    </h4>
                                    <span
                                        className={`px-2 py-0.5 rounded text-xs font-medium ${getTypeBadgeClass(
                                            delivery.type
                                        )}`}
                                    >
                                        {delivery.type}
                                    </span>
                                </div>

                                {/* Address */}
                                {delivery.address && (
                                    <p className="text-sm text-gray-400">
                                        {delivery.address}
                                    </p>
                                )}

                                {/* Phone */}
                                {delivery.phone && (
                                    <p className="text-sm text-gray-400">
                                        Phone: {delivery.phone}
                                    </p>
                                )}

                                {/* Products */}
                                <div className="mt-2 text-sm text-gray-300">
                                    {delivery.products.map((p, idx) => (
                                        <span key={idx} className="inline-block mr-3">
                                            {p.quantity} x {p.name}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        )}
    </div>
);
    if (loading) return <LoadingSpinner />;
    if (error) return <div className="text-red-400 text-center py-8">{error}</div>;

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-green-500">
                    Stock Preparation
                </h1>
                <Button onClick={fetchStockPrep}>
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Refresh
                </Button>
            </div>

            {stockData?.today && stockData?.tomorrow ? (
              <>
                <DeliverySection title="Today's Deliveries" data={stockData.today} />
                <DeliverySection title="Tomorrow's Deliveries" data={stockData.tomorrow} />
              </>
            ) : (
              <p className="text-gray-500 text-center py-8">No stock data available</p>
            )}
        </div>
    );
};

export default StockPrep;
