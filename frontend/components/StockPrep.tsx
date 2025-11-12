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
  try {
    setLoading(true);
    setError(null);

    const response = await fetch('https://shroommush.onrender.com/api/stock-prep');
    if (!response.ok) throw new Error('Failed to fetch stock prep data');

    const data = await response.json();
    console.log('[DEBUG] StockPrep API data:', JSON.stringify(data, null, 2));

    // ✅ Transform backend data to frontend format
    const makeDayData = (dateString: string): DayData => {
      const dayName = new Date(dateString).toLocaleDateString('en-US', { weekday: 'long' });
      const allDeliveries: StockPrepOrder[] = [
        ...data.subscriptions.map((s: any) => ({
          id: s.id || crypto.randomUUID(),
          customerName: s.customerName || 'Unnamed Subscription',
          products: s.products || [],
          deliveryDate: dateString,
          type: 'Subscription',
          address: s.address,
          phone: s.phone,
        })),
        ...data.retailSales.map((r: any) => ({
          id: r.id || crypto.randomUUID(),
          customerName: r.customerName || 'Retail Sale',
          products: r.products || [],
          deliveryDate: dateString,
          type: 'Retail',
          address: r.address,
          phone: r.phone,
        })),
        ...data.wholesaleSales.map((w: any) => ({
          id: w.id || crypto.randomUUID(),
          customerName: w.customerName || 'Wholesale Order',
          products: w.products || [],
          deliveryDate: dateString,
          type: 'Wholesale',
          address: w.address,
          phone: w.phone,
        })),
      ];

      return {
        date: dateString,
        day: dayName,
        deliveries: allDeliveries,
        totalBoxes: allDeliveries.reduce(
          (sum, d) => sum + d.products.reduce((s, p) => s + (p.quantity || 0), 0),
          0
        ),
        breakdown: {
          subscriptions: data.subscriptions.length,
          retail: data.retailSales.length,
          wholesale: data.wholesaleSales.length,
        },
      };
    };

    const finalStockData: StockPrepData = {
      today: makeDayData(data.dateRange.today),
      tomorrow: makeDayData(data.dateRange.tomorrow),
    };

    setStockData(finalStockData);
    console.log('[DEBUG] finalStockData (transformed):', JSON.stringify(finalStockData, null, 2));

  } catch (err) {
    console.error('Error fetching stock prep:', err);
    setError('Failed to load stock preparation data');
  } finally {
    setLoading(false);
  }
}, []);


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
                    <p className="text-gray-400 text-sm">{data.day}, {data.date}</p>
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
                            className="bg-gray-800/50 rounded-lg p-4 border border-white/10 hover:bg-gray-800/70 transition"
                        >
                            <div className="flex justify-between items-start">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                                        <h4 className="font-semibold text-white">{delivery.customerName}</h4>
                                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${getTypeBadgeClass(delivery.type)}`}>
                                            {delivery.type}
                                        </span>
                                    </div>
                                    
                                    {delivery.address && (
                                        <p className="text-sm text-gray-400">{delivery.address}</p>
                                    )}
                                    
                                    {delivery.phone && (
                                        <p className="text-sm text-gray-400">📞 {delivery.phone}</p>
                                    )}
                                    
                                    <p className="text-xs text-emerald-400 mt-2">
                                        {delivery.products.map(p => `${p.quantity}x ${p.name}`).join(', ')}
                                    </p>
                                </div>
                                
                                <div className="bg-emerald-500 text-white rounded-full w-12 h-12 flex items-center justify-center font-bold text-lg flex-shrink-0">
                                    {delivery.products.reduce((sum, p) => sum + p.quantity, 0)}
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
