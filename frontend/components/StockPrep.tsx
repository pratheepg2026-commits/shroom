import React, { useState, useEffect } from 'react';

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

  useEffect(() => {
    fetchStockPrep();
  }, []);

  const fetchStockPrep = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/stock-prep');
      
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

  // DeliverySection component (defined inside StockPrep)
  const DeliverySection = ({ title, data }: { title: string; data: DayData }) => (
    <div className="bg-gray-800/50 rounded-lg p-6 mb-6">
      {/* Header with date and total boxes */}
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

      {/* Breakdown Pills */}
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

      {/* Delivery List */}
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
                  {/* Customer name with type badge */}
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
                  
                  {/* Address */}
                  {delivery.address && (
                    <p className="text-sm text-gray-400">
                      {delivery.flatNo && `${delivery.flatNo}, `}{delivery.address}
                    </p>
                  )}
                  
                  {/* Phone */}
                  {delivery.phone && (
                    <p className="text-sm text-gray-400">{delivery.phone}</p>
                  )}
                  
                  {/* Plan/Invoice info */}
                  <p className="text-xs text-emerald-400 mt-1">{delivery.plan}</p>
                </div>
                
                {/* Box count badge */}
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
      {/* Header */}
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

      {/* Today and Tomorrow sections */}
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
