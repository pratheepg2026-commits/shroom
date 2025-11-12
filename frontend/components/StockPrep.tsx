import React, { useState, useEffect } from 'react';
import { getSubscriptions, getSales, getWholesaleSales } from '../services/api';
import { Subscription, Sale, WholesaleSale } from '../types';
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

    useEffect(() => {
        fetchStockPrep();
    }, []);

    const fetchStockPrep = async () => {
      const formatDate = (date: string | Date) => {
      const d = typeof date === 'string' ? new Date(date) : date;
      return d.toISOString().slice(0, 10);  // returns 'YYYY-MM-DD'
    };

      setLoading(true);
      setError(null);
      console.log('[DEBUG] fetchStockPrep called');
      
      try {
        console.log('[DEBUG] Fetching subscriptions, sales, wholesale sales...');
        
        const [subscriptions, retailSales, wholesaleSales] = await Promise.all([
          getSubscriptions(),
          getSales(),
          getWholesaleSales()
        ]);
        
        console.log('[DEBUG] Subscriptions:', subscriptions);
        console.log('[DEBUG] Retail Sales:', retailSales);
        console.log('[DEBUG] Wholesale Sales:', wholesaleSales);
    
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
    
        const todayStr = today.toISOString().split('T')[0];
        const tomorrowStr = tomorrow.toISOString().split('T')[0];
        
        console.log('[DEBUG] Date filters:', { todayStr, tomorrowStr });
    
        const processOrders = (targetDate: string): StockPrepOrder[] => {
          console.log(`[DEBUG] Processing orders for date: ${targetDate}`);
          const orders: StockPrepOrder[] = [];
    
          // Subscriptions
          const filteredSubs = subscriptions.filter(s => s.isActive && formatDate(s.nextDeliveryDate) === targetDate);
          console.log(`[DEBUG] Filtered subscriptions for ${targetDate}:`, filteredSubs.length);
          filteredSubs.forEach(s => {
            orders.push({
              id: s.id,
              customerName: s.customerName || 'Unknown',
              products: [{ name: s.productName || s.plan || 'Unknown', quantity: s.quantity || 1 }],
              deliveryDate: s.nextDeliveryDate,
              type: 'Subscription',
              address: s.address || '',
              phone: s.phone || ''
            });
          });
    
          // Retail Sales
    
           retailSales.forEach(s => {
             console.log('[DEBUG] Retail sale raw date:', s.date);
           });
         
            
          const filteredRetail = retailSales.filter(s => s.status === 'Pending' && formatDate(s.date) === targetDate);
          console.log(`[DEBUG] Filtered retail sales for ${targetDate}:`, filteredRetail.length,s.date);
          filteredRetail.forEach(s => {
            orders.push({
              id: s.id,
              customerName: s.customerName || 'Unknown',
              products: s.products || [],
              deliveryDate: s.date,
              type: 'Retail',
            });
          });
    
          // Wholesale Sales
          const filteredWholesale = wholesaleSales.filter(s => s.status === 'Pending' && formatDate(s.date) === targetDate);
          console.log(`[DEBUG] Filtered wholesale sales for ${targetDate}:`, filteredWholesale.length);
          filteredWholesale.forEach(s => {
            orders.push({
              id: s.id,
              customerName: s.shopName || 'Unknown',
              products: s.products || [],
              deliveryDate: s.date,
              type: 'Wholesale',
              address: s.address || '',
              phone: s.contact || ''
            });
          });
    
          console.log(`[DEBUG] Total orders for ${targetDate}:`, orders.length);
          return orders;
        };
    
        const todayDeliveries = processOrders(todayStr);
        const tomorrowDeliveries = processOrders(tomorrowStr);
    
        const calculateDayData = (dateStr: string, date: Date, deliveries: StockPrepOrder[]): DayData => {
          const totalBoxes = deliveries.reduce((sum, d) => 
            sum + d.products.reduce((pSum, p) => pSum + p.quantity, 0), 0
          );
    
          return {
            date: date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
            day: date.toLocaleDateString('en-US', { weekday: 'long' }),
            deliveries,
            totalBoxes,
            breakdown: {
              subscriptions: deliveries.filter(d => d.type === 'Subscription').length,
              retail: deliveries.filter(d => d.type === 'Retail').length,
              wholesale: deliveries.filter(d => d.type === 'Wholesale').length
            }
          };
        };
    
        const finalStockData = {
          today: calculateDayData(todayStr, today, todayDeliveries),
          tomorrow: calculateDayData(tomorrowStr, tomorrow, tomorrowDeliveries)
        };
    
        console.log('[DEBUG] Final stock data:', finalStockData);
        setStockData(finalStockData);
    
      } catch (err) {
        console.error('[ERROR] Failed to fetch stock prep:', err);
        setError('Failed to load stock preparation data');
      } finally {
        setLoading(false);
      }
    };

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

            {stockData && (
                <>
                    <DeliverySection title="Today's Deliveries" data={stockData.today} />
                    <DeliverySection title="Tomorrow's Deliveries" data={stockData.tomorrow} />
                </>
            )}
        </div>
    );
};

export default StockPrep;
