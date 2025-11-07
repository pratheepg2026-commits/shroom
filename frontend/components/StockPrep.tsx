// Fix: Removed extraneous file markers that were causing syntax errors.
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

// --- Helper function to calculate requirements for a specific date ---
const calculateRequirements = (targetDate: Date, subs: Subscription[], sales: Sale[], wholesaleSales: WholesaleSale[]): RequirementsData => {
    const targetDateString = getLocalDateString(targetDate);
    const dayOfWeek = targetDate.toLocaleDateString('en-US', { weekday: 'long' });

    const reqMap = new Map<string, number>();
    const orders: DailyOrder[] = [];

    // 1. Filter and process subscriptions
    const dailySubs = subs.filter(sub => sub.status === Status.ACTIVE && (sub.preferredDeliveryDay === dayOfWeek || sub.preferredDeliveryDay === 'Any Day'));
    dailySubs.forEach(sub => {
        const currentQty = reqMap.get(sub.plan) || 0;
        reqMap.set(sub.plan, currentQty + 1);
        orders.push({ ...sub, type: 'Subscription' });
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

const RequirementsDisplay: React.FC<{ data: RequirementsData }> = ({ data }) => {
    const { requirements, dailyOrders } = data;
    
    const getTypePill = (type: DailyOrder['type']) => {
        switch(type) {
            case 'Subscription': return 'bg-blue-500/20 text-blue-300';
            case 'Retail': return 'bg-purple-500/20 text-purple-300';
            case 'Wholesale': return 'bg-pink-500/20 text-pink-300';
        }
    }
    
    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pt-4">
            <div className="lg:col-span-1 bg-black/20 backdrop-blur-md border border-white/10 rounded-xl shadow-lg p-6 h-fit">
                <h2 className="text-xl font-bold mb-4 text-white">Total Product Requirements</h2>
                <table className="min-w-full text-sm text-left text-gray-300">
                    <thead className="bg-white/5 uppercase text-xs">
                        <tr>
                            <th scope="col" className="px-4 py-2">Product</th>
                            <th scope="col" className="px-4 py-2 text-right">Quantity</th>
                        </tr>
                    </thead>
                    <tbody>
                        {Array.from(requirements.entries()).map(([name, qty]) => (
                            <tr key={name} className="border-b border-white/10">
                                <td className="px-4 py-2 font-medium text-white">{name}</td>
                                <td className="px-4 py-2 text-right font-semibold">{qty}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {requirements.size === 0 && <p className="text-center text-gray-400 py-4">No requirements for this day.</p>}
            </div>

            <div className="lg:col-span-2 bg-black/20 backdrop-blur-md border border-white/10 rounded-xl shadow-lg p-6">
                <h2 className="text-xl font-bold mb-4 text-white">Customer & Order Details</h2>
                <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                    {dailyOrders.length === 0 && <p className="text-center text-gray-400 py-4">No orders scheduled for this day.</p>}
                    {dailyOrders.map(order => (
                        <div key={order.id} className="bg-gray-800/50 p-4 rounded-lg border border-white/10">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="font-bold text-white">
                                        {'name' in order ? order.name : 'shopName' in order ? order.shopName : order.customerName}
                                    </p>
                                    <p className="text-xs text-gray-400">
                                        {'address' in order ? order.address : 'Retail Customer'}
                                    </p>
                                    <p className="text-xs text-gray-400">
                                        {'phone' in order ? order.phone : 'contact' in order ? order.contact : ''}
                                    </p>
                                </div>
                                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getTypePill(order.type)}`}>{order.type}</span>
                            </div>
                            <div className="border-t border-white/10 mt-2 pt-2">
                                <ul className="text-sm text-gray-300 list-disc list-inside">
                                    {order.type === 'Subscription' && <li>1x {order.plan}</li>}
                                    {(order.type === 'Retail' || order.type === 'Wholesale') && order.products.map(p => (
                                        <li key={p.name}>{p.quantity}x {p.name}</li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};


const StockPrep: React.FC = () => {
    const [todayReqs, setTodayReqs] = useState<RequirementsData>({ requirements: new Map(), dailyOrders: [] });
    const [tomorrowReqs, setTomorrowReqs] = useState<RequirementsData>({ requirements: new Map(), dailyOrders: [] });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isExporting, setIsExporting] = useState(false);
    const [isExportingCSV, setIsExportingCSV] = useState(false);
    const [activeTab, setActiveTab] = useState<'today' | 'tomorrow'>('today');

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [subs, sales, wholesaleSales] = await Promise.all([
                getSubscriptions(),
                getSales(),
                getWholesaleSales(),
            ]);

            const today = new Date();
            const tomorrow = new Date();
            tomorrow.setDate(today.getDate() + 1);

            setTodayReqs(calculateRequirements(today, subs, sales, wholesaleSales));
            setTomorrowReqs(calculateRequirements(tomorrow, subs, sales, wholesaleSales));

        } catch (err) {
            console.error(err);
            setError("Failed to fetch daily requirements.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleExportPDF = () => {
        const data = activeTab === 'today' ? todayReqs : tomorrowReqs;
        const date = new Date();
        if (activeTab === 'tomorrow') date.setDate(date.getDate() + 1);
        
        setIsExporting(true);
        const jspdf = (window as any).jspdf;
        const autoTable = (window as any).autoTable;
    
        if (!jspdf || !autoTable) {
            alert("PDF generation libraries not loaded. Please try again.");
            setIsExporting(false);
            return;
        }
    
        try {
          const { jsPDF } = jspdf;
          const doc = new jsPDF();
          const formattedDate = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    
          doc.setFontSize(18);
          doc.text(`SHROOMMUSH - Daily Stock Prep for ${formattedDate}`, 14, 22);
          
          doc.setFontSize(14);
          doc.text("Total Product Requirements", 14, 35);
          autoTable(doc, {
            startY: 40,
            head: [['Product', 'Total Quantity']],
            body: Array.from(data.requirements.entries()).map(([name, qty]) => [name, qty]),
            headStyles: { fillColor: [34, 197, 94] },
          });
          
          doc.addPage();
          doc.setFontSize(14);
          doc.text("Customer & Order Details", 14, 22);

          const subs = data.dailyOrders.filter(o => o.type === 'Subscription');
          const retail = data.dailyOrders.filter(o => o.type === 'Retail');
          const wholesale = data.dailyOrders.filter(o => o.type === 'Wholesale');

          let lastY = 30;

          if (subs.length > 0) {
              autoTable(doc, { head: [['Subscriptions']], startY: lastY, theme: 'plain', styles: { fontSize: 12, fontStyle: 'bold' } });
              autoTable(doc, {
                  body: subs.map(o => [
                      (o as Subscription).name,
                      (o as Subscription).address,
                      (o as Subscription).plan,
                  ]),
                  startY: (doc as any).lastAutoTable.finalY,
              });
              lastY = (doc as any).lastAutoTable.finalY + 10;
          }
          if (retail.length > 0) {
             autoTable(doc, { head: [['Retail Orders']], startY: lastY, theme: 'plain', styles: { fontSize: 12, fontStyle: 'bold' } });
              autoTable(doc, {
                  body: retail.map(o => [
                      (o as Sale).customerName,
                      'Retail Customer',
                      (o as Sale).products.map(p => `${p.quantity}x ${p.name}`).join('\n')
                  ]),
                  startY: (doc as any).lastAutoTable.finalY,
              });
              lastY = (doc as any).lastAutoTable.finalY + 10;
          }
          if (wholesale.length > 0) {
             autoTable(doc, { head: [['Wholesale Orders']], startY: lastY, theme: 'plain', styles: { fontSize: 12, fontStyle: 'bold' } });
              autoTable(doc, {
                  body: wholesale.map(o => [
                      (o as WholesaleSale).shopName,
                      (o as WholesaleSale).address,
                      (o as WholesaleSale).products.map(p => `${p.quantity}x ${p.name}`).join('\n')
                  ]),
                  startY: (doc as any).lastAutoTable.finalY,
              });
          }

          doc.save(`stock-prep-${date.toISOString().split('T')[0]}.pdf`);
        } catch (error) {
          console.error("Error exporting PDF:", error);
          alert("An error occurred while generating the PDF.");
        } finally {
          setIsExporting(false);
        }
    };

    const handleExportCSV = () => {
        setIsExportingCSV(true);
        try {
            const dataToUse = activeTab === 'today' ? todayReqs : tomorrowReqs;
            const dateLabel = activeTab === 'today' ? 'today' : 'tomorrow';
        
            const flattenedData = dataToUse.dailyOrders.flatMap(order => {
                if (order.type === 'Subscription') {
                    return [{
                        'Order Type': 'Subscription',
                        'Customer/Shop Name': order.name,
                        'Contact': order.phone,
                        'Address': `${order.address}, ${order.flatNo || ''} ${order.flatName || ''}`.trim(),
                        'Product': order.plan,
                        'Quantity': 1
                    }];
                } else {
                    return order.products.map(product => ({
                        'Order Type': order.type,
                        'Customer/Shop Name': 'customerName' in order ? order.customerName : order.shopName,
                        'Contact': 'contact' in order ? order.contact : 'N/A',
                        'Address': 'address' in order ? order.address : 'N/A',
                        'Product': product.name,
                        'Quantity': product.quantity
                    }));
                }
            });
            
            exportToCSV(flattenedData, `stock-prep-${dateLabel}.csv`);
        } catch (error) {
            console.error("Error exporting CSV:", error);
            alert("An error occurred while generating the CSV.");
        } finally {
            setIsExportingCSV(false);
        }
    };
    
    if (loading) return <LoadingSpinner />;
    if (error) return <ApiError onRetry={fetchData} />;

    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);

    const todayFormatted = today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    const tomorrowFormatted = tomorrow.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

    return (
        <div>
            <div className="flex justify-between items-center mb-4">
                <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-green-500">Stock Preparation</h1>
                <div className="flex items-center space-x-2">
                    <Button onClick={handleExportCSV} variant="secondary" disabled={isExportingCSV}>
                        {isExportingCSV ? 'Exporting...' : `Export CSV`}
                    </Button>
                    <Button onClick={handleExportPDF} variant="secondary" disabled={isExporting}>
                        {isExporting ? 'Exporting...' : `Export PDF`}
                    </Button>
                </div>
            </div>
            
            <div className="border-b border-white/10 mb-6">
                <nav className="-mb-px flex space-x-6" aria-label="Tabs">
                    <button
                        onClick={() => setActiveTab('today')}
                        className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-lg transition-colors ${
                            activeTab === 'today'
                                ? 'border-emerald-500 text-emerald-400'
                                : 'border-transparent text-gray-400 hover:text-white hover:border-gray-500'
                        }`}
                    >
                        Today ({todayFormatted})
                    </button>
                    <button
                        onClick={() => setActiveTab('tomorrow')}
                        className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-lg transition-colors ${
                            activeTab === 'tomorrow'
                                ? 'border-emerald-500 text-emerald-400'
                                : 'border-transparent text-gray-400 hover:text-white hover:border-gray-500'
                        }`}
                    >
                        Tomorrow ({tomorrowFormatted})
                    </button>
                </nav>
            </div>

            <div>
                {activeTab === 'today' && <RequirementsDisplay data={todayReqs} />}
                {activeTab === 'tomorrow' && <RequirementsDisplay data={tomorrowReqs} />}
            </div>
        </div>
    );
};

export default StockPrep;
