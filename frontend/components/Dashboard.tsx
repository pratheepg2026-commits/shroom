import React, { useEffect, useState, useCallback, useRef } from 'react';
import { getDashboardStats } from '../services/api';
import { DashboardStats, View, Status } from '../types';
import Card from './common/Card';
import Button from './common/Button';
import ApiError from './common/ApiError';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, TooltipProps } from 'recharts';
import { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent';

interface DashboardProps {
    navigate: (view: View, state?: any) => void;
}

// Icons
const CurrencyRupeeIcon: React.FC<{className?: string}> = ({className}) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 8.25H9.75L8.25 12H15.75m0 0L14.25 15.75m1.5-3.75H9.75m3.75 7.5H9.75m3.75 0c1.036 0 1.875-.84 1.875-1.875s-.84-1.875-1.875-1.875H9.75" />
    </svg>
);
const UsersIcon: React.FC<{className?: string}> = ({className}) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-4.68c.11-.32.227-.65.354-.972a3.75 3.75 0 015.139-2.253M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
);
const ExpenseIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
);
const ProfitLossIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" /></svg>
);


const LoadingSpinner = () => (
    <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-emerald-500"></div>
    </div>
);

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
};

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: any[]; label?: string | number; }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-gray-800/80 backdrop-blur-sm border border-white/20 p-3 rounded-lg shadow-lg text-white">
        <p className="font-bold mb-1">{`Day ${label}`}</p>
        <p className="text-emerald-400">{`Total Sales: ${formatCurrency(data.sales)}`}</p>
        <p className="text-sm text-gray-300">{`Retail Orders: ${data.retailOrders}`}</p>
        <p className="text-sm text-gray-300">{`Wholesale Orders: ${data.wholesaleOrders}`}</p>
      </div>
    );
  }
  return null;
};

const Dashboard: React.FC<DashboardProps> = ({ navigate }) => {
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isExporting, setIsExporting] = useState(false);
    const dashboardRef = useRef<HTMLDivElement>(null);
    
    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const statsData = await getDashboardStats();
            setStats(statsData);
        } catch (error) {
            console.error("Failed to fetch dashboard data:", error);
            setError("Failed to fetch dashboard data. Please check the console for details.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleExportPDF = async () => {
        if (!dashboardRef.current) return;
        setIsExporting(true);

        const html2canvas = (window as any).html2canvas;
        const jspdf = (window as any).jspdf;

        if (!html2canvas || !jspdf) {
            alert("PDF generation libraries not loaded. Please try again.");
            setIsExporting(false);
            return;
        }

        try {
            const canvas = await html2canvas(dashboardRef.current, {
                backgroundColor: '#0a0a0a',
                scale: 2,
            });
            const imgData = canvas.toDataURL('image/png');
            const { jsPDF } = jspdf;
            const pdf = new jsPDF({
                orientation: 'landscape',
                unit: 'px',
                format: [canvas.width, canvas.height]
            });
            pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
            pdf.save('shroommush-dashboard.pdf');
        } catch (error) {
            console.error("Error exporting PDF:", error);
            alert("An error occurred while generating the PDF.");
        } finally {
            setIsExporting(false);
        }
    };

    if (loading) {
        return <LoadingSpinner />;
    }
    
    if (error) {
        return <ApiError onRetry={fetchData} />;
    }

    if (!stats) {
        return <div className="text-center text-gray-400">No dashboard data available.</div>;
    }
    
    const PIE_COLORS = ['#10b981', '#34d399', '#6ee7b7', '#a7f3d0', '#d1fae5', '#fde047', '#facc15'];
    
    const salesChartData = stats.salesByDay.filter(d => d.sales > 0).sort((a, b) => a.day - b.day);

    return (
        <div ref={dashboardRef} className="p-2">
            <div className="flex justify-between items-center mb-6">
                 <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-green-500">Dashboard</h1>
                 <Button onClick={handleExportPDF} variant="secondary" disabled={isExporting}>
                    {isExporting ? 'Exporting...' : 'Export as PDF'}
                </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <div className="cursor-pointer transition-transform duration-200 hover:scale-105" onClick={() => navigate('reporting')}>
                    <Card 
                        title="Current Month Sales" 
                        value={formatCurrency(stats.currentMonthSales)}
                        icon={<CurrencyRupeeIcon className="h-8 w-8" />}
                        description={`Retail: ${formatCurrency(stats.currentMonthRetailSales)} | Wholesale: ${formatCurrency(stats.currentMonthWholesaleSales)}`}
                    />
                </div>
                 <div className="cursor-pointer transition-transform duration-200 hover:scale-105" onClick={() => navigate('subscriptions', { filterStatus: Status.ACTIVE })}>
                    <Card 
                        title="Active Subscriptions" 
                        value={stats.activeSubscriptions}
                        icon={<UsersIcon className="h-8 w-8" />}
                    />
                </div>
                 <div className="cursor-pointer transition-transform duration-200 hover:scale-105" onClick={() => navigate('expenses')}>
                    <Card 
                        title="Current Month Expenses" 
                        value={formatCurrency(stats.currentMonthExpenses)}
                        icon={<ExpenseIcon />}
                    />
                </div>
                 <div className="cursor-pointer transition-transform duration-200 hover:scale-105" onClick={() => navigate('pnl')}>
                    <Card 
                        title="Current Month Profit" 
                        value={formatCurrency(stats.currentMonthProfit)}
                        icon={<ProfitLossIcon />}
                        description={stats.currentMonthProfit >= 0 ? 'In profit' : 'In loss'}
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 bg-black/20 backdrop-blur-md border border-white/10 rounded-xl shadow-lg p-6">
                    <h2 className="text-xl font-bold mb-4 text-white">Sales this Month</h2>
                    <ResponsiveContainer width="100%" height={300}>
                       <BarChart data={salesChartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                            <defs>
                                <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.8}/>
                                <stop offset="95%" stopColor="#10b981" stopOpacity={0.4}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" />
                            <XAxis dataKey="day" stroke="#9ca3af" tick={{ fill: '#d1d5db' }} />
                            <YAxis stroke="#9ca3af" tick={{ fill: '#d1d5db' }} tickFormatter={(value) => formatCurrency(value as number)} />
                            <Tooltip content={<CustomTooltip />} cursor={{fill: 'rgba(255, 255, 255, 0.05)'}}/>
                            <Bar dataKey="sales" fill="url(#colorSales)" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-xl shadow-lg p-6">
                    <h2 className="text-xl font-bold mb-4 text-white">
                        {stats.currentMonthProfit >= 0 ? 'Revenue Breakdown' : 'Expense Breakdown'}
                    </h2>
                     <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                             <Tooltip contentStyle={{ backgroundColor: 'rgba(30, 41, 59, 0.8)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff' }}/>
                             <Legend wrapperStyle={{ color: '#e5e7eb' }}/>
                             <Pie
                                data={stats.expenseBreakdown}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                outerRadius={100}
                                fill="#8884d8"
                                dataKey="value"
                                nameKey="name"
                            >
                                {stats.expenseBreakdown.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.name === 'Net Profit' ? '#f59e0b' : PIE_COLORS[index % PIE_COLORS.length]} />
                                ))}
                            </Pie>
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
