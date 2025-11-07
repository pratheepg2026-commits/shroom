import React, { useState, useEffect, useCallback } from 'react';
import { getSales, getWholesaleSales, getExpenses, getSalesReturns, getProducts } from '../services/api';
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

type ReportType = 'sales' | 'pnl';

interface SalesAnalysisData {
    type: 'sales';
    totalRevenue: number;
    totalOrders: number;
    avgOrderValue: number;
    topProducts: { name: string; quantity: number; revenue: number }[];
    dailySales: { date: string; revenue: number }[];
}

type ReportData = SalesAnalysisData | PnlAnalysisDataType | null;

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
    
    const [reportData, setReportData] = useState<ReportData>(null);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [salesData, wholesaleData, expensesData, returnsData] = await Promise.all([
                getSales(),
                getWholesaleSales(),
                getExpenses(),
                getSalesReturns()
            ]);
            setAllSales(salesData);
            setAllWholesale(wholesaleData);
            setAllExpenses(expensesData);
            setAllReturns(returnsData);
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
        
        setGenerating(false);
    };

    const handleExportCSV = () => {
        if (!reportData) return;
        const start = new Date(startDate);
        const end = new Date(endDate);

        if (reportData.type === 'sales') {
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
                    {reportData.type === 'sales' && (
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
                    {reportData.type === 'pnl' && (
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