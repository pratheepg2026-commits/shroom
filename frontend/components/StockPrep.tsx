// StockPrep.tsx - COMPLETE UPDATED VERSION WITH DATE FIX
import React, { useState, useEffect, useCallback } from 'react';
import { getSubscriptions, getSales, getWholesaleSales } from '../services/api';
import { Subscription, Sale, WholesaleSale, Status } from '../types';
import { exportToCSV } from '../services/csvExporter';
import Button from './common/Button';
import ApiError from './common/ApiError';


const LoadingSpinner = () => (
    <div className="flex justify-center items-center h-64">
      <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-emerald-500"></div>
    </div>
);


type DailyOrder = (Subscription & { type: 'Subscription' }) | (Sale & { type: 'Retail' }) | (WholesaleSale & { type: 'Wholesale' });
type RequirementsData = { requirements: Map<string, number>, dailyOrders: DailyOrder[] };


const getLocalDateString = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};


// NEW: Smart subscription delivery calculator
const getSubscriptionDeliveriesForDate = (
    sub: Subscription, 
    targetDate: Date
): number => {
    if (!sub.preferredDeliveryDay || sub.preferredDeliveryDay === 'Any Day') {
        return 0;
    }
    
    const targetDay = targetDate.toLocaleDateString('en-US', { weekday: 'long' });
    
    if (sub.preferredDeliveryDay !== targetDay) {
        return 0;
    }
    
    const year = targetDate.getFullYear();
    const month = targetDate.getMonth();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let count = 0;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    for (let day = 1; day <= daysInMonth; day++) {
        const checkDate = new Date(year, month, day);
        if (checkDate >= today && 
            checkDate.toLocaleDateString('en-US', { weekday: 'long' }) === sub.preferredDeliveryDay) {
            count++;
        }
    }
    
    if (count === 0) return 0;
    
    const boxesPerMonth = sub.boxesPerMonth || 1;
    const boxesPerDelivery = Math.floor(boxesPerMonth / count);
    const remainder = boxesPerMonth % count;
    
    return boxesPerDelivery + (remainder > 0 ? 1 : 0);
};


// UPDATED: Calculate requirements with smart subscription filtering
const calculateRequirements = (targetDate: Date, subs: Subscription[], sales: Sale[], wholesaleSales: WholesaleSale[]): RequirementsData => {
    const targetDateString = getLocalDateString(targetDate);
    const reqMap = new Map<string, number>();
    const orders: DailyOrder[] = [];

    // 1. Process subscriptions with proper delivery schedule
    subs.forEach(sub => {
        if (sub.status !== Status.ACTIVE) return;
        
        const boxes = getSubscriptionDeliveriesForDate(sub, targetDate);
        if (boxes > 0) {
            const currentQty = reqMap.get(sub.plan) || 0;
            reqMap.set(sub.plan, currentQty + boxes);
            orders.push({ ...sub, type: 'Subscription' });
        }
    });

    // 2. Filter and process retail sales
    const dailySales = sales.filter(s => s.date === targetDateString);
    dailySales.forEach(sale => {
        sale.products.forEach(p => {
            const currentQty = reqMap.get(p.name) || 0;
            reqMap.set(p.name, currentQty + p.quantity);
        });
        orders.push({ ...sale, type: 'Retail' });
    });

    // 3. Filter and process wholesale sales
    const dailyWholesale = wholesaleSales.filter(ws => ws.date === targetDateString);
    dailyWholesale.forEach(sale => {
        sale.products.forEach(p => {
            const currentQty = reqMap.get(p.name) || 0;
            reqMap.set(p.name, currentQty + p.quantity);
        });
        orders.push({ ...sale, type: 'Wholesale' });
    });

    return { requirements: reqMap, dailyOrders: orders };
};

// ... rest of component stays the same (RequirementsDisplay, StockPrep, exports)


interface Delivery {
  type: string;
  id: string;
  customerName: string;
  address: string;
  flatNo: string;
  phone: string;
  boxes: number;
  plan: string;
  deliveryDate: string;
}

interface DayData {
  date: string;
  day: string;
  deliveries: Delivery[];
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

  const API_BASE_URL = 'https://shroommush.onrender.com';

  useEffect(() => {
    fetchStockPrep();
  }, []);

  const fetchStockPrep = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${API_BASE_URL}/api/stock-prep`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch stock prep data');
      }
      
      const data = await response.json();
      setStockData(data);
    } catch (err) {
      console.error('Error fetching stock prep:', err);
      setError('Failed to load stock preparation data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-500/20 border border-red-500 rounded-lg p-4 text-red-400">
          {error}
        </div>
      </div>
    );
  }

  const DeliverySection = ({ title, data }: { title: string; data: DayData }) => (
    <div className="bg-gray-800/50 rounded-lg p-6 mb-6">
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
          {data.deliveries.map((delivery, index) => (
            <div 
              key={`${delivery.type}-${delivery.id}-${index}`} 
              className="bg-gray-700/50 rounded-lg p-4 hover:bg-gray-700/70 transition"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h4 className="font-semibold text-gray-200">{delivery.customerName}</h4>
                    <span className={`px-2 py-0.5 rounded text-xs ${
                      delivery.type === 'Subscription' 
                        ? 'bg-blue-500/20 text-blue-400' 
                        : delivery.type === 'Retail Sale' 
                        ? 'bg-green-500/20 text-green-400' 
                        : 'bg-purple-500/20 text-purple-400'
                    }`}>
                      {delivery.type}
                    </span>
                  </div>
                  
                  {delivery.address && (
                    <p className="text-sm text-gray-400">
                      {delivery.flatNo && `${delivery.flatNo}, `}{delivery.address}
                    </p>
                  )}
                  
                  {delivery.phone && (
                    <p className="text-sm text-gray-400">{delivery.phone}</p>
                  )}
                  
                  <p className="text-xs text-emerald-400 mt-1">{delivery.plan}</p>
                </div>
                
                <div className="bg-emerald-500 text-white rounded-full w-12 h-12 flex items-center justify-center font-bold text-lg flex-shrink-0">
                  {delivery.boxes}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-200">Stock Preparation</h2>
        <button
          onClick={fetchStockPrep}
          className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh  
        </button>
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
