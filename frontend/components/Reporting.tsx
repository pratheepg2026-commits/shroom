import React, { useState, useEffect, useCallback } from 'react';
import { getSales, getWholesaleSales, getExpenses, getSalesReturns, getProducts,getWarehouses,getInventory  } from '../services/api';
import { Sale, WholesaleSale, Expense, SalesReturn, Product, ExpenseCategory, PnlAnalysisData as PnlAnalysisDataType } from '../types';
import Button from './common/Button';
import ApiError from './common/ApiError';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Area } from 'recharts';
import { exportToCSV } from '../services/csvExporter';

const LoadingSpinner = () => (
    <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-emerald-500"></div>
    </div>
);

const ReportCard: React.FC<{title: string, value: string, description?: string}> = ({ title, value, description }) => (
    <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-xl shadow-lg p-6">
        <p className="text-sm font-medium text-gray-300 uppercase tracking-wider">{title}</p>
        <p className="text-3xl font-bold text-white mt-1">{value}</p>
        {description && <p className="text-xs text-gray-400 mt-1">{description}</p>}
    </div>
);

type ReportType = 'sales' | 'pnl' | 'returns' | 'warehouse' | 'credits';

interface SalesAnalysisData {
    type: 'sales';
    totalRevenue: number;
    totalOrders: number;
    avgOrderValue: number;
    topProducts: { name: string; quantity: number; revenue: number }[];
    dailySales: { date: string; revenue: number }[];
}

interface ReturnsAnalysisData {
    type: 'returns';
    totalReturns: number;
    totalRefundAmount: number;
    avgReturnValue: number;
    warehouseReturns: { warehouseName: string; count: number; amount: number }[];
    topReturnedProducts: { name: string; quantity: number; refundAmount: number }[];
}

interface WarehouseOverviewData {
    type: 'warehouse';
    warehouses: {
        name: string;
        totalSales: number;
        totalExpenses: number;
        totalInventory: number;
        netProfit: number;
        salesCount: number;
    }[];
}

interface CreditsAnalysisData {
    type: 'credits';
    totalUnpaid: number;
    retailUnpaid: number;
    wholesaleUnpaid: number;
    unpaidSales: {
        invoiceNumber: string;
        customerName: string;
        type: 'Retail' | 'Wholesale';
        amount: number;
        date: string;
    }[];
}

type ReportData = SalesAnalysisData | PnlAnalysisDataType | ReturnsAnalysisData | WarehouseOverviewData | CreditsAnalysisData | null;

const getLocalDateString = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const Reporting: React.FC = () => {
    const [reportType, setReportType] = useState<ReportType>('sales');
    const [startDate, setStartDate] = useState<string>(() => {
        const date = new Date();
        date.setDate(1);
        return getLocalDateString(date);
    });
    const [endDate, setEndDate] = useState<string>(getLocalDateString(new Date()));
    
    const [allSales, setAllSales] = useState<Sale[]>([]);
    const [allWholesale, setAllWholesale] = useState<WholesaleSale[]>([]);
    const [allExpenses, setAllExpenses] = useState<Expense[]>([]);
    const [allReturns, setAllReturns] = useState<SalesReturn[]>([]);
    const [allWarehouses, setAllWarehouses] = useState<Warehouse[]>([]); 
    const [allInventory, setAllInventory] = useState<any[]>([]);  // Or use proper Inventory type

    const [reportData, setReportData] = useState<ReportData>(null);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [salesData, wholesaleData, expensesData, returnsData, warehousesData, inventoryData] = await Promise.all([
                getSales(),
                getWholesaleSales(),
                getExpenses(),
                getSalesReturns(),
                getWarehouses(),
                getInventory()  // Add this
            ]);
            setAllSales(salesData);
            setAllWholesale(wholesaleData);
            setAllExpenses(expensesData);
            setAllReturns(returnsData);
            setAllWarehouses(warehousesData);
            setAllInventory(inventoryData);  // Add this line
        } catch (err) {
            console.error(err);
            setError("Failed to fetch initial data for reporting.");
        } finally {
            setLoading(false);
        }
    }, []);


    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleGenerateReport = () => {
        setGenerating(true);
        setReportData(null);

        const start = new Date(startDate);
        const end = new Date(endDate);

        const filteredSales = allSales.filter(s => new Date(s.date) >= start && new Date(s.date) <= end);
        const filteredWholesale = allWholesale.filter(s => new Date(s.date) >= start && new Date(s.date) <= end);
        const filteredExpenses = allExpenses.filter(e => new Date(e.date) >= start && new Date(e.date) <= end);
        const filteredReturns = allReturns.filter(r => new Date(r.date) >= start && new Date(r.date) <= end);

        if (reportType === 'sales') {
            const combinedSales = [...filteredSales, ...filteredWholesale];
            const totalRevenue = combinedSales.reduce((sum, s) => sum + s.totalAmount, 0);
            const totalOrders = combinedSales.length;
            const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

            const productMap = new Map<string, { quantity: number; revenue: number }>();
            combinedSales.forEach(sale => {
                sale.products.forEach(p => {
                    const existing = productMap.get(p.name) || { quantity: 0, revenue: 0 };
                    existing.quantity += p.quantity;
                    existing.revenue += p.quantity * p.price;
                    productMap.set(p.name, existing);
                });
            });
            const topProducts = Array.from(productMap.entries())
                .map(([name, data]) => ({ name, ...data }))
                .sort((a, b) => b.revenue - a.revenue)
                .slice(0, 10);
            
            const dailySalesMap = new Map<string, number>();
            combinedSales.forEach(s => {
                const existing = dailySalesMap.get(s.date) || 0;
                dailySalesMap.set(s.date, existing + s.totalAmount);
            });
            const dailySales = Array.from(dailySalesMap.entries())
                .map(([date, revenue]) => ({ date, revenue }))
                .sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());


            setReportData({ type: 'sales', totalRevenue, totalOrders, avgOrderValue, topProducts, dailySales });
        } else if (reportType === 'pnl') {
            const totalRevenue = filteredSales.reduce((sum, s) => sum + s.totalAmount, 0) + filteredWholesale.reduce((sum, s) => sum + s.totalAmount, 0);
            const totalExpenses = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
            const totalReturns = filteredReturns.reduce((sum, r) => sum + r.totalRefundAmount, 0);
            const netProfit = totalRevenue - totalExpenses - totalReturns;
            
            const expenseMap = new Map<ExpenseCategory, number>();
            filteredExpenses.forEach(e => {
                const existing = expenseMap.get(e.category) || 0;
                expenseMap.set(e.category, existing + e.amount);
            });
            const expenseBreakdown = Array.from(expenseMap.entries()).map(([name, value]) => ({ name, value }));
            
            const dailyDataMap = new Map<string, { revenue: number, expense: number, return: number }>();
            
            [...filteredSales, ...filteredWholesale].forEach(s => {
                const entry = dailyDataMap.get(s.date) || { revenue: 0, expense: 0, return: 0 };
                entry.revenue += s.totalAmount;
                dailyDataMap.set(s.date, entry);
            });
            filteredExpenses.forEach(e => {
                const entry = dailyDataMap.get(e.date) || { revenue: 0, expense: 0, return: 0 };
                entry.expense += e.amount;
                dailyDataMap.set(e.date, entry);
            });
            filteredReturns.forEach(r => {
                const entry = dailyDataMap.get(r.date) || { revenue: 0, expense: 0, return: 0 };
                entry.return += r.totalRefundAmount;
                dailyDataMap.set(r.date, entry);
            });

            const profitTrend = Array.from(dailyDataMap.entries())
                .map(([date, data]) => ({
                    date: new Date(date).toLocaleDateString('en-CA'),
                    profit: data.revenue - data.expense - data.return
                }))
                .sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());

            setReportData({ type: 'pnl', totalRevenue, totalExpenses, totalReturns, netProfit, expenseBreakdown, profitTrend });
        }
        else if (reportType === 'returns') {
    const totalReturns = filteredReturns.length;
    const totalRefundAmount = filteredReturns.reduce((sum, r) => sum + r.totalRefundAmount, 0);
    const avgReturnValue = totalReturns > 0 ? totalRefundAmount / totalReturns : 0;

    // Warehouse-wise returns
    const warehouseMap = new Map<string, { count: number; amount: number }>();
    filteredReturns.forEach(r => {
        const warehouseName = allWarehouses.find(w => w.id === r.warehouseId)?.name || 'Unknown';
        const existing = warehouseMap.get(warehouseName) || { count: 0, amount: 0 };
        existing.count++;
        existing.amount += r.totalRefundAmount;
        warehouseMap.set(warehouseName, existing);
    });
    const warehouseReturns = Array.from(warehouseMap.entries())
        .map(([warehouseName, data]) => ({ warehouseName, ...data }))
        .sort((a, b) => b.amount - a.amount);

    // Top returned products
    const productMap = new Map<string, { quantity: number; refundAmount: number }>();
    filteredReturns.forEach(r => {
        r.products.forEach(p => {
            const existing = productMap.get(p.name) || { quantity: 0, refundAmount: 0 };
            existing.quantity += p.quantity;
            existing.refundAmount += p.quantity * p.price;
            productMap.set(p.name, existing);
        });
    });
    const topReturnedProducts = Array.from(productMap.entries())
        .map(([name, data]) => ({ name, ...data }))
        .sort((a, b) => b.refundAmount - a.refundAmount)
        .slice(0, 10);

    setReportData({ type: 'returns', totalReturns, totalRefundAmount, avgReturnValue, warehouseReturns, topReturnedProducts });
}
else if (reportType === 'warehouse') {
    const warehouseData = allWarehouses.map(warehouse => {
        const warehouseSales = [...filteredSales, ...filteredWholesale].filter(s => s.warehouseId === warehouse.id);
        const totalSales = warehouseSales.reduce((sum, s) => sum + s.totalAmount, 0);
        const salesCount = warehouseSales.length;
        
        const warehouseExpenses = filteredExpenses.filter(e => e.warehouseId === warehouse.id);
        const totalExpenses = warehouseExpenses.reduce((sum, e) => sum + e.amount, 0);
        
        // Get inventory value (assuming you have inventory data with warehouseId)
        const warehouseInventory = allInventory?.filter(i => i.warehouseId === warehouse.id) || [];
        const totalInventory = warehouseInventory.reduce((sum, i) => sum + (i.quantity * (i.costPerUnit || 0)), 0);
        
        const netProfit = totalSales - totalExpenses;

        return {
            name: warehouse.name,
            totalSales,
            totalExpenses,
            totalInventory,
            netProfit,
            salesCount
        };
    });

    setReportData({ type: 'warehouse', warehouses: warehouseData });
}
else if (reportType === 'credits') {
    const unpaidRetail = filteredSales.filter(s => s.status === 'Unpaid');
    const unpaidWholesale = filteredWholesale.filter(s => s.status === 'Unpaid');
    
    const retailUnpaid = unpaidRetail.reduce((sum, s) => sum + s.totalAmount, 0);
    const wholesaleUnpaid = unpaidWholesale.reduce((sum, s) => sum + s.totalAmount, 0);
    const totalUnpaid = retailUnpaid + wholesaleUnpaid;

    const unpaidSales = [
        ...unpaidRetail.map(s => ({
            invoiceNumber: s.invoiceNumber,
            customerName: s.customerName,
            type: 'Retail' as const,
            amount: s.totalAmount,
            date: s.date
        })),
        ...unpaidWholesale.map(s => ({
            invoiceNumber: s.invoiceNumber,
            customerName: s.shopName,
            type: 'Wholesale' as const,
            amount: s.totalAmount,
            date: s.date
        }))
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    setReportData({ type: 'credits', totalUnpaid, retailUnpaid, wholesaleUnpaid, unpaidSales });
}

        
        setGenerating(false);
    };

    const handleExportCSV = () => {
        if (!reportData) return;
        const start = new Date(startDate);
        const end = new Date(endDate);

        if (reportData && reportData.type === 'sales') {
            const filteredSales = allSales.filter(s => new Date(s.date) >= start && new Date(s.date) <= end);
            const filteredWholesale = allWholesale.filter(s => new Date(s.date) >= start && new Date(s.date) <= end);
            exportToCSV([...filteredSales, ...filteredWholesale], `sales_report_${startDate}_to_${endDate}.csv`);
        } else {
             const filteredExpenses = allExpenses.filter(e => new Date(e.date) >= start && new Date(e.date) <= end);
             exportToCSV(filteredExpenses, `pnl_expenses_${startDate}_to_${endDate}.csv`);
        }
    };
    
    const formatCurrency = (value: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(value);
    
    const PIE_COLORS = ['#10b981', '#34d399', '#6ee7b7', '#a7f3d0', '#d1fae5', '#fde047', '#facc15'];

    if (loading) return <LoadingSpinner />;
    if (error) return <ApiError onRetry={fetchData} />;

    return (
        <div>
            <h1 className="text-3xl font-bold mb-6 text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-green-500">Advanced Reporting</h1>
            
            <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-xl shadow-lg p-4 mb-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Report Type</label>
                        <select value={reportType} onChange={e => setReportType(e.target.value as ReportType)} className="w-full bg-gray-800/50 border border-white/20 rounded-md p-2 text-gray-200">
                            <option value="sales">Sales Analysis</option>
                            <option value="pnl">Profit & Loss Summary</option>
                            <option value="returns">Returns Analysis</option>
                            <option value="warehouse">Warehouse Overview</option>
                            <option value="credits">Credits & Unpaid Sales</option>
                        </select>

                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Start Date</label>
                        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full bg-gray-800/50 border border-white/20 rounded-md p-2 text-gray-200"/>
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">End Date</label>
                        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full bg-gray-800/50 border border-white/20 rounded-md p-2 text-gray-200"/>
                    </div>
                    <Button onClick={handleGenerateReport} disabled={generating} className="w-full">
                        {generating ? 'Generating...' : 'Generate Report'}
                    </Button>
                </div>
            </div>

            {generating && <LoadingSpinner />}
            
            {!reportData && !generating && (
                <div className="text-center py-16 bg-black/20 backdrop-blur-md border border-white/10 rounded-xl">
                    <p className="text-gray-400">Select your filters and generate a report to see the analysis.</p>
                </div>
            )}

            {reportData && (
                <div className="space-y-8 animate-fade-in">
                    <div className="flex justify-end">
                        <Button onClick={handleExportCSV} variant="secondary">Export as CSV</Button>
                    </div>

                    {/* Sales Report */}
                    {reportData && reportData.type === 'sales' && (
                        <div className="space-y-8">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <ReportCard title="Total Revenue" value={formatCurrency(reportData.totalRevenue)} />
                                <ReportCard title="Total Orders" value={reportData.totalOrders.toString()} />
                                <ReportCard title="Avg. Order Value" value={formatCurrency(reportData.avgOrderValue)} />
                            </div>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-xl shadow-lg p-6">
                                    <h2 className="text-xl font-bold mb-4 text-white">Top Selling Products</h2>
                                    <div className="overflow-x-auto">
                                        <table className="min-w-full text-sm text-left text-gray-300">
                                            <thead className="bg-white/5 uppercase text-xs">
                                                <tr>
                                                    <th className="px-4 py-2">Product</th>
                                                    <th className="px-4 py-2 text-right">Qty Sold</th>
                                                    <th className="px-4 py-2 text-right">Revenue</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {reportData.topProducts.map(p => (
                                                    <tr key={p.name} className="border-b border-white/10">
                                                        <td className="px-4 py-2 font-medium">{p.name}</td>
                                                        <td className="px-4 py-2 text-right">{p.quantity}</td>
                                                        <td className="px-4 py-2 text-right">{formatCurrency(p.revenue)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                                <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-xl shadow-lg p-6">
                                    <h2 className="text-xl font-bold mb-4 text-white">Daily Sales</h2>
                                    <ResponsiveContainer width="100%" height={300}>
                                        <BarChart data={reportData.dailySales}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" />
                                            <XAxis dataKey="date" stroke="#9ca3af" tick={{ fontSize: 12 }} />
                                            <YAxis stroke="#9ca3af" tickFormatter={(val) => `₹${val/1000}k`} />
                                            <Tooltip contentStyle={{ backgroundColor: 'rgba(30, 41, 59, 0.8)', border: '1px solid rgba(255,255,255,0.2)' }}/>
                                            <Bar dataKey="revenue" fill="#22c55e" />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* P&L Report */}
                    {reportData && reportData.type === 'pnl' && (
                         <div className="space-y-8">
                             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                <ReportCard title="Total Revenue" value={formatCurrency(reportData.totalRevenue)} />
                                <ReportCard title="Total Expenses" value={formatCurrency(reportData.totalExpenses)} />
                                <ReportCard title="Total Returns" value={formatCurrency(reportData.totalReturns)} />
                                <ReportCard title="Net Profit" value={formatCurrency(reportData.netProfit)} description={reportData.netProfit >= 0 ? 'Profit' : 'Loss'}/>
                            </div>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-xl shadow-lg p-6">
                                    <h2 className="text-xl font-bold mb-4 text-white">Profit Trend</h2>
                                    <ResponsiveContainer width="100%" height={300}>
                                        <LineChart data={reportData.profitTrend} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                                            <defs>
                                                <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.8}/>
                                                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" />
                                            <XAxis dataKey="date" stroke="#9ca3af" tick={{ fontSize: 12 }} />
                                            <YAxis stroke="#9ca3af" tickFormatter={(value) => formatCurrency(value as number)} />
                                            <Tooltip contentStyle={{ backgroundColor: 'rgba(30, 41, 59, 0.8)', border: '1px solid rgba(255,255,255,0.2)' }} />
                                            <Line type="monotone" dataKey="profit" stroke="#22c55e" strokeWidth={2} dot={{ r: 4, fill: '#22c55e' }} />
                                            <Area type="monotone" dataKey="profit" stroke={false} fill="url(#colorProfit)" />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                                <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-xl shadow-lg p-6">
                                    <h2 className="text-xl font-bold mb-4 text-white">Expense Breakdown</h2>
                                    <ResponsiveContainer width="100%" height={300}>
                                        <PieChart>
                                            <Tooltip contentStyle={{ backgroundColor: 'rgba(30, 41, 59, 0.8)', border: '1px solid rgba(255,255,255,0.2)' }}/>
                                            <Legend />
                                            <Pie data={reportData.expenseBreakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} fill="#8884d8">
                                                {reportData.expenseBreakdown.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                                ))}
                                            </Pie>
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                         </div>
                    )}
                </div>
            )}
            {/* Returns Analysis Report */}
{reportData && reportData.type === 'returns' && (
    <div className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <ReportCard title="Total Returns" value={reportData.totalReturns.toString()} />
            <ReportCard title="Total Refund Amount" value={formatCurrency(reportData.totalRefundAmount)} />
            <ReportCard title="Avg. Return Value" value={formatCurrency(reportData.avgReturnValue)} />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-xl shadow-lg p-6">
                <h2 className="text-xl font-bold mb-4 text-white">Warehouse-wise Returns</h2>
                <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={reportData.warehouseReturns}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" />
                        <XAxis dataKey="warehouseName" stroke="#9ca3af" tick={{ fontSize: 12 }} />
                        <YAxis stroke="#9ca3af" tickFormatter={(val) => `₹${val/1000}k`} />
                        <Tooltip contentStyle={{ backgroundColor: 'rgba(30, 41, 59, 0.8)', border: '1px solid rgba(255,255,255,0.2)' }}/>
                        <Legend />
                        <Bar dataKey="count" fill="#ef4444" name="Return Count" />
                        <Bar dataKey="amount" fill="#f87171" name="Refund Amount" />
                    </BarChart>
                </ResponsiveContainer>
            </div>
            <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-xl shadow-lg p-6">
                <h2 className="text-xl font-bold mb-4 text-white">Top Returned Products</h2>
                <div className="overflow-x-auto">
                    <table className="min-w-full text-sm text-left text-gray-300">
                        <thead className="bg-white/5 uppercase text-xs">
                            <tr>
                                <th className="px-4 py-2">Product</th>
                                <th className="px-4 py-2 text-right">Qty Returned</th>
                                <th className="px-4 py-2 text-right">Refund Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            {reportData.topReturnedProducts.map(p => (
                                <tr key={p.name} className="border-b border-white/10">
                                    <td className="px-4 py-2 font-medium">{p.name}</td>
                                    <td className="px-4 py-2 text-right">{p.quantity}</td>
                                    <td className="px-4 py-2 text-right">{formatCurrency(p.refundAmount)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>
)}

{/* Warehouse Overview Report */}
{reportData && reportData.type === 'warehouse' && (
    <div className="space-y-8">
        <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-xl shadow-lg overflow-hidden">
            <div className="overflow-x-auto">
                <table className="min-w-full text-sm text-left text-gray-300">
                    <thead className="bg-white/5 uppercase text-xs">
                        <tr>
                            <th className="px-6 py-3">Warehouse</th>
                            <th className="px-6 py-3 text-right">Sales Count</th>
                            <th className="px-6 py-3 text-right">Total Sales</th>
                            <th className="px-6 py-3 text-right">Total Expenses</th>
                            <th className="px-6 py-3 text-right">Inventory Value</th>
                            <th className="px-6 py-3 text-right">Net Profit</th>
                        </tr>
                    </thead>
                    <tbody>
                        {reportData.warehouses.map(w => (
                            <tr key={w.name} className="border-b border-white/10 hover:bg-white/5 transition-colors">
                                <td className="px-6 py-4 font-medium text-white">{w.name}</td>
                                <td className="px-6 py-4 text-right">{w.salesCount}</td>
                                <td className="px-6 py-4 text-right">{formatCurrency(w.totalSales)}</td>
                                <td className="px-6 py-4 text-right">{formatCurrency(w.totalExpenses)}</td>
                                <td className="px-6 py-4 text-right">{formatCurrency(w.totalInventory)}</td>
                                <td className={`px-6 py-4 text-right font-semibold ${w.netProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                    {formatCurrency(w.netProfit)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    </div>
)}

{/* Credits Analysis Report */}
{reportData && reportData.type === 'credits' && (
    <div className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <ReportCard title="Total Unpaid" value={formatCurrency(reportData.totalUnpaid)} description="Outstanding Amount" />
            <ReportCard title="Retail Unpaid" value={formatCurrency(reportData.retailUnpaid)} />
            <ReportCard title="Wholesale Unpaid" value={formatCurrency(reportData.wholesaleUnpaid)} />
        </div>
        <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-xl shadow-lg overflow-hidden">
            <h2 className="text-xl font-bold p-6 text-white border-b border-white/10">Unpaid Sales Details</h2>
            <div className="overflow-x-auto">
                <table className="min-w-full text-sm text-left text-gray-300">
                    <thead className="bg-white/5 uppercase text-xs">
                        <tr>
                            <th className="px-6 py-3">Invoice #</th>
                            <th className="px-6 py-3">Customer/Shop</th>
                            <th className="px-6 py-3">Type</th>
                            <th className="px-6 py-3">Date</th>
                            <th className="px-6 py-3 text-right">Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        {reportData.unpaidSales.map(sale => (
                            <tr key={sale.invoiceNumber} className="border-b border-white/10 hover:bg-white/5 transition-colors">
                                <td className="px-6 py-4 font-mono text-xs">{sale.invoiceNumber}</td>
                                <td className="px-6 py-4 font-medium text-white">{sale.customerName}</td>
                                <td className="px-6 py-4">
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                                        sale.type === 'Retail' ? 'bg-blue-500/20 text-blue-300' : 'bg-purple-500/20 text-purple-300'
                                    }`}>
                                        {sale.type}
                                    </span>
                                </td>
                                <td className="px-6 py-4">{new Date(sale.date).toLocaleDateString()}</td>
                                <td className="px-6 py-4 text-right font-semibold text-yellow-400">{formatCurrency(sale.amount)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    </div>
)}

            <style>{`
                @keyframes fade-in {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0px); }
                }
                .animate-fade-in { animation: fade-in 0.5s ease-out forwards; }
            `}</style>
        </div>
    );
};

export default Reporting;
