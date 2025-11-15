import React, { useState, useEffect, useCallback } from 'react';
import { 
    getSales, 
    getWholesaleSales, 
    getExpenses, 
    getSalesReturns, 
    getProducts,
    getWarehouses,
    getInventory,  
} from '../services/api';
import { 
    Sale, 
    WholesaleSale, 
    Expense, 
    SalesReturn, 
    Product, 
    ExpenseCategory, 
    PnlAnalysisData as PnlAnalysisDataType, 
    Warehouse 
} from '../types';
import Button from './common/Button';
import ApiError from './common/ApiError';
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, 
    ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Area 
} from 'recharts';
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

type ReportType = 'sales' | 'pnl' | 'returns' | 'warehouse' | 'credits' | 'advanced';

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

// ---- Advanced Reporting Types ----
interface ProductMarginRow {
    productName: string;
    totalQty: number;
    revenue: number;
    cogs: number;
    grossMargin: number;
    grossMarginPct: number;
    returnsQty: number;
    returnsAmount: number;
    netMargin: number;
    netMarginPct: number;
    inventoryValue: number;
    roiPercent: number;
}

interface ReorderRow {
    productName: string;
    currentStock: number;
    coverageDays: number;
    recommendedQty: number;
}

interface CustomerProfitRow {
    customerName: string;
    revenue: number;
    returns: number;
    netRevenue: number;
    orderCount: number;
}

interface CreditAgingBucket {
    label: string;
    amount: number;
}

interface CreditAgingData {
    totalUnpaid: number;
    avgDaysOutstanding: number;
    buckets: CreditAgingBucket[];
}

interface ReturnsReasonRow {
    reason: string;
    count: number;
    amount: number;
}

interface PeriodComparisonData {
    current: {
        revenue: number;
        netProfit: number;
        expenses: number;
        returns: number;
    };
    previous: {
        revenue: number;
        netProfit: number;
        expenses: number;
        returns: number;
    };
}

interface ForecastRow {
    productName: string;
    dailyAvgQty: number;
    forecast30dQty: number;
}

interface ExpenseKpiData {
    totalExpenses: number;
    fixed: number;
    variable: number;
    fixedPct: number;
    variablePct: number;
}

interface CapitalRoiData {
    netProfit: number;
    inventoryCapital: number;
    roiPercent: number;
}

interface AdvancedReportingData {
    type: 'advanced';
    productMargins: ProductMarginRow[];
    abcSummary: {
        classLabel: 'A' | 'B' | 'C';
        productCount: number;
        revenueShare: number;
        marginShare: number;
    }[];
    reorderRecommendations: ReorderRow[];
    customerProfitability: CustomerProfitRow[];
    creditAging: CreditAgingData;
    returnsByReason: ReturnsReasonRow[];
    periodComparison: PeriodComparisonData;
    forecast: ForecastRow[];
    expenseKpis: ExpenseKpiData;
    capitalRoi: CapitalRoiData;
}

type ReportData = 
    | SalesAnalysisData 
    | PnlAnalysisDataType 
    | ReturnsAnalysisData 
    | WarehouseOverviewData 
    | CreditsAnalysisData 
    | AdvancedReportingData
    | null;

const getLocalDateString = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const MS_PER_DAY = 1000 * 60 * 60 * 24;

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
    const [allInventory, setAllInventory] = useState<any[]>([]);
    const [allProducts, setAllProducts] = useState<Product[]>([]);

    const [reportData, setReportData] = useState<ReportData>(null);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [
                salesData, 
                wholesaleData, 
                expensesData, 
                returnsData, 
                warehousesData, 
                inventoryData,
                productsData
            ] = await Promise.all([
                getSales(),
                getWholesaleSales(),
                getExpenses(),
                getSalesReturns(),
                getWarehouses(),
                getInventory(),
                getProducts()
            ]);

            setAllSales(salesData);
            setAllWholesale(wholesaleData);
            setAllExpenses(expensesData);
            setAllReturns(returnsData);
            setAllWarehouses(warehousesData);
            setAllInventory(inventoryData);
            setAllProducts(productsData);
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
        const filteredExpenses = allExpenses.filter(e => {
            const expenseDate = new Date(e.date);
            return expenseDate >= start && expenseDate <= end;
        });
        const filteredReturns = allReturns.filter(r => new Date(r.date) >= start && new Date(r.date) <= end);

        try {
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
            } 
            else if (reportType === 'pnl') {
                const totalRevenue = filteredSales.reduce((sum, s) => sum + s.totalAmount, 0) 
                    + filteredWholesale.reduce((sum, s) => sum + s.totalAmount, 0);
                const totalExpenses = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
                const totalReturns = filteredReturns.reduce((sum, r) => sum + r.totalRefundAmount, 0);
                const netProfit = totalRevenue - totalExpenses - totalReturns;
                
                const expenseMap = new Map<ExpenseCategory, number>();
                filteredExpenses.forEach(e => {
                    const existing = expenseMap.get(e.category) || 0;
                    expenseMap.set(e.category, existing + e.amount);
                });
                const expenseBreakdown = Array.from(expenseMap.entries()).map(([name, value]) => ({ name, value }));
                
                const dailyDataMap = new Map<string, { revenue: number, expense: number, returned: number }>();
                
                [...filteredSales, ...filteredWholesale].forEach(s => {
                    const entry = dailyDataMap.get(s.date) || { revenue: 0, expense: 0, returned: 0 };
                    entry.revenue += s.totalAmount;
                    dailyDataMap.set(s.date, entry);
                });
                filteredExpenses.forEach(e => {
                    const entry = dailyDataMap.get(e.date) || { revenue: 0, expense: 0, returned: 0 };
                    entry.expense += e.amount;
                    dailyDataMap.set(e.date, entry);
                });
                filteredReturns.forEach(r => {
                    const entry = dailyDataMap.get(r.date) || { revenue: 0, expense: 0, returned: 0 };
                    entry.returned += r.totalRefundAmount;
                    dailyDataMap.set(r.date, entry);
                });

                const profitTrend = Array.from(dailyDataMap.entries())
                    .map(([date, data]) => ({
                        date: new Date(date).toLocaleDateString('en-CA'),
                        profit: data.revenue - data.expense - data.returned
                    }))
                    .sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());

                setReportData({ type: 'pnl', totalRevenue, totalExpenses, totalReturns, netProfit, expenseBreakdown, profitTrend });
            }
            else if (reportType === 'returns') {
                const totalReturns = filteredReturns.length;
                const totalRefundAmount = filteredReturns.reduce((sum, r) => sum + r.totalRefundAmount, 0);
                const avgReturnValue = totalReturns > 0 ? totalRefundAmount / totalReturns : 0;
                
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
            
                const productMap = new Map<string, { quantity: number; refundAmount: number }>();
                filteredReturns.forEach(r => {
                    // IMPORTANT: correct field is returnedProducts, NOT r.products
                    r.returnedProducts.forEach(p => {
                        const product = allProducts.find(prod => prod.id === p.productId);
                        const name = product?.name || 'Unknown';
                        const existing = productMap.get(name) || { quantity: 0, refundAmount: 0 };
                        existing.quantity += p.quantity;
                        existing.refundAmount += p.quantity * p.price;
                        productMap.set(name, existing);
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
                    const warehouseSales = [...filteredSales, ...filteredWholesale].filter(
                        s => String(s.warehouseId) === String(warehouse.id)
                    );
                
                    const totalSales = warehouseSales.reduce((sum, s) => sum + s.totalAmount, 0);
                    const salesCount = warehouseSales.length;
                
                    const warehouseExpenses = filteredExpenses.filter(
                        e => String((e as any).warehouseId || (e as any).warehouse_id) === String(warehouse.id)
                    );
                
                    const totalExpenses = warehouseExpenses.reduce((sum, e) => sum + e.amount, 0);
                
                    const warehouseInventory = allInventory?.filter(
                        (i: any) => String(i.warehouseId) === String(warehouse.id)
                    ) || [];
                
                    const totalInventory = warehouseInventory.reduce(
                        (sum, i: any) => sum + (i.quantity * (i.costPerUnit || 0)),
                        0
                    );
                
                    const netProfit = totalSales - totalExpenses;
                
                    return {
                        name: warehouse.name,
                        totalSales,
                        totalExpenses,
                        totalInventory,
                        netProfit,
                        salesCount,
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
            else if (reportType === 'advanced') {
                // ---- ADVANCED REPORTING ----
                const combinedSales = [...filteredSales, ...filteredWholesale];

                // Helper maps
                const productByName = new Map(allProducts.map(p => [p.name, p]));
                const inventoryByProductId = new Map<string, { totalQty: number; totalCost: number }>();

                allInventory.forEach((inv: any) => {
                    const productId = String(inv.productId || inv.product_id || '');
                    if (!productId) return;
                    const entry = inventoryByProductId.get(productId) || { totalQty: 0, totalCost: 0 };
                    entry.totalQty += inv.quantity || 0;
                    entry.totalCost += (inv.quantity || 0) * (inv.costPerUnit || 0);
                    inventoryByProductId.set(productId, entry);
                });

                // --- 1 & 2: Product Margin + ROI ---
                const productAgg = new Map<string, ProductMarginRow>();

                const ensureProd = (productName: string): ProductMarginRow => {
                    let row = productAgg.get(productName);
                    if (!row) {
                        const product = productByName.get(productName);
                        let inventoryValue = 0;
                        if (product) {
                            const pid = String(product.id);
                            const inv = inventoryByProductId.get(pid);
                            if (inv) inventoryValue = inv.totalCost;
                        }
                        row = {
                            productName,
                            totalQty: 0,
                            revenue: 0,
                            cogs: 0,
                            grossMargin: 0,
                            grossMarginPct: 0,
                            returnsQty: 0,
                            returnsAmount: 0,
                            netMargin: 0,
                            netMarginPct: 0,
                            inventoryValue,
                            roiPercent: 0,
                        };
                        productAgg.set(productName, row);
                    }
                    return row;
                };

                // Sales side
                combinedSales.forEach(sale => {
                    sale.products.forEach(p => {
                        const row = ensureProd(p.name);
                        row.totalQty += p.quantity;
                        const lineRevenue = p.quantity * p.price;
                        row.revenue += lineRevenue;

                        const product = productByName.get(p.name);
                        if (product) {
                            const pid = String(product.id);
                            const inv = inventoryByProductId.get(pid);
                            const avgCost = inv && inv.totalQty > 0 ? inv.totalCost / inv.totalQty : 0;
                            row.cogs += p.quantity * avgCost;
                        }
                    });
                });

                // Returns side
                filteredReturns.forEach(r => {
                    r.returnedProducts.forEach(p => {
                        const product = allProducts.find(prod => prod.id === p.productId);
                        const name = product?.name || 'Unknown';
                        const row = ensureProd(name);
                        row.returnsQty += p.quantity;
                        const refundLine = p.quantity * p.price;
                        row.returnsAmount += refundLine;
                    });
                });

                let totalRevenueForABC = 0;
                let totalMarginForABC = 0;

                productAgg.forEach(row => {
                    row.grossMargin = row.revenue - row.cogs;
                    row.netMargin = row.grossMargin - row.returnsAmount;
                    row.grossMarginPct = row.revenue > 0 ? (row.grossMargin / row.revenue) * 100 : 0;
                    row.netMarginPct = row.revenue > 0 ? (row.netMargin / row.revenue) * 100 : 0;
                    row.roiPercent = row.inventoryValue > 0 ? (row.netMargin / row.inventoryValue) * 100 : 0;

                    totalRevenueForABC += row.revenue;
                    totalMarginForABC += row.netMargin;
                });

                const productMargins = Array.from(productAgg.values())
                    .sort((a, b) => b.netMargin - a.netMargin)
                    .slice(0, 50); // limit to top 50 rows

                // --- 3: ABC Analysis ---
                const sortedForABC = [...productMargins].sort((a, b) => b.revenue - a.revenue);
                let cumShare = 0;
                let aCount = 0, bCount = 0, cCount = 0;
                let aRev = 0, bRev = 0, cRev = 0;
                let aMar = 0, bMar = 0, cMar = 0;

                sortedForABC.forEach(p => {
                    const share = totalRevenueForABC > 0 ? p.revenue / totalRevenueForABC : 0;
                    cumShare += share;
                    if (cumShare <= 0.8) {
                        aCount++; aRev += p.revenue; aMar += p.netMargin;
                    } else if (cumShare <= 0.95) {
                        bCount++; bRev += p.revenue; bMar += p.netMargin;
                    } else {
                        cCount++; cRev += p.revenue; cMar += p.netMargin;
                    }
                });

                const totalMarginABC = aMar + bMar + cMar || 1;
                const abcSummary = [
                    {
                        classLabel: 'A' as const,
                        productCount: aCount,
                        revenueShare: totalRevenueForABC ? (aRev / totalRevenueForABC) * 100 : 0,
                        marginShare: (aMar / totalMarginABC) * 100
                    },
                    {
                        classLabel: 'B' as const,
                        productCount: bCount,
                        revenueShare: totalRevenueForABC ? (bRev / totalRevenueForABC) * 100 : 0,
                        marginShare: (bMar / totalMarginABC) * 100
                    },
                    {
                        classLabel: 'C' as const,
                        productCount: cCount,
                        revenueShare: totalRevenueForABC ? (cRev / totalRevenueForABC) * 100 : 0,
                        marginShare: (cMar / totalMarginABC) * 100
                    }
                ];

                // --- 6: Reorder Recommendations ---
                const daysInPeriod = Math.max(1, Math.round((end.getTime() - start.getTime()) / MS_PER_DAY) + 1);
                const qtyByProduct = new Map<string, number>();
                combinedSales.forEach(sale => {
                    sale.products.forEach(p => {
                        const existing = qtyByProduct.get(p.name) || 0;
                        qtyByProduct.set(p.name, existing + p.quantity);
                    });
                });

                const stockByProductName = new Map<string, number>();
                allInventory.forEach((inv: any) => {
                    const product = allProducts.find(p => p.id === inv.productId || (p as any).product_id === inv.productId);
                    if (!product) return;
                    const existing = stockByProductName.get(product.name) || 0;
                    stockByProductName.set(product.name, existing + (inv.quantity || 0));
                });

                const reorderRecommendations: ReorderRow[] = [];
                const coverageTargetDays = 30;

                qtyByProduct.forEach((qty, name) => {
                    const dailyAvg = qty / daysInPeriod;
                    const currentStock = stockByProductName.get(name) || 0;
                    const coverageDays = dailyAvg > 0 ? currentStock / dailyAvg : Infinity;
                    const targetQty = dailyAvg * coverageTargetDays;
                    const recommendedQty = Math.max(0, Math.round(targetQty - currentStock));
                    if (recommendedQty > 0) {
                        reorderRecommendations.push({
                            productName: name,
                            currentStock,
                            coverageDays: isFinite(coverageDays) ? coverageDays : 0,
                            recommendedQty
                        });
                    }
                });

                reorderRecommendations.sort((a, b) => b.recommendedQty - a.recommendedQty);

                // --- 7: Customer Profitability ---
                const customerMap = new Map<string, CustomerProfitRow>();

                const ensureCustomer = (name: string): CustomerProfitRow => {
                    let row = customerMap.get(name);
                    if (!row) {
                        row = { customerName: name, revenue: 0, returns: 0, netRevenue: 0, orderCount: 0 };
                        customerMap.set(name, row);
                    }
                    return row;
                };

                filteredSales.forEach(s => {
                    const row = ensureCustomer(s.customerName);
                    row.revenue += s.totalAmount;
                    row.orderCount += 1;
                });

                filteredWholesale.forEach(s => {
                    const row = ensureCustomer(s.shopName);
                    row.revenue += s.totalAmount;
                    row.orderCount += 1;
                });

                filteredReturns.forEach(r => {
                    const row = ensureCustomer(r.customerName || 'Unknown');
                    row.returns += r.totalRefundAmount;
                });

                customerMap.forEach(row => {
                    row.netRevenue = row.revenue - row.returns;
                });

                const customerProfitability = Array.from(customerMap.values())
                    .sort((a, b) => b.netRevenue - a.netRevenue)
                    .slice(0, 30);

                // --- 8: Credit Risk & Aging (inside advanced) ---
                const unpaidRetail = filteredSales.filter(s => s.status === 'Unpaid');
                const unpaidWholesale = filteredWholesale.filter(s => s.status === 'Unpaid');
                const unpaidCombined = [
                    ...unpaidRetail.map(s => ({ amount: s.totalAmount, date: s.date })),
                    ...unpaidWholesale.map(s => ({ amount: s.totalAmount, date: s.date }))
                ];

                const agingBuckets: CreditAgingBucket[] = [
                    { label: '0–30 days', amount: 0 },
                    { label: '31–60 days', amount: 0 },
                    { label: '61–90 days', amount: 0 },
                    { label: '90+ days', amount: 0 },
                ];
                let totalUnpaid = 0;
                let weightedDaysSum = 0;

                unpaidCombined.forEach(item => {
                    const saleDate = new Date(item.date);
                    const days = Math.max(0, Math.round((end.getTime() - saleDate.getTime()) / MS_PER_DAY));
                    totalUnpaid += item.amount;
                    weightedDaysSum += days * item.amount;

                    if (days <= 30) agingBuckets[0].amount += item.amount;
                    else if (days <= 60) agingBuckets[1].amount += item.amount;
                    else if (days <= 90) agingBuckets[2].amount += item.amount;
                    else agingBuckets[3].amount += item.amount;
                });

                const avgDaysOutstanding = totalUnpaid > 0 ? weightedDaysSum / totalUnpaid : 0;
                const creditAging: CreditAgingData = {
                    totalUnpaid,
                    avgDaysOutstanding,
                    buckets: agingBuckets
                };

                // --- 10: Returns Reason Analysis ---
                const reasonMap = new Map<string, { count: number; amount: number }>();
                filteredReturns.forEach(r => {
                    const reason = (r as any).reason || (r as any).description || 'Unknown';
                    const existing = reasonMap.get(reason) || { count: 0, amount: 0 };
                    existing.count += 1;
                    existing.amount += r.totalRefundAmount;
                    reasonMap.set(reason, existing);
                });

                const returnsByReason: ReturnsReasonRow[] = Array.from(reasonMap.entries())
                    .map(([reason, data]) => ({ reason, ...data }))
                    .sort((a, b) => b.amount - a.amount);

                // --- 12: Period Comparison (current vs previous period) ---
                const periodMs = end.getTime() - start.getTime();
                const prevEnd = new Date(start.getTime() - MS_PER_DAY);
                const prevStart = new Date(prevEnd.getTime() - periodMs);

                const prevSales = allSales.filter(s => {
                    const d = new Date(s.date);
                    return d >= prevStart && d <= prevEnd;
                });
                const prevWholesale = allWholesale.filter(s => {
                    const d = new Date(s.date);
                    return d >= prevStart && d <= prevEnd;
                });
                const prevExpenses = allExpenses.filter(e => {
                    const d = new Date(e.date);
                    return d >= prevStart && d <= prevEnd;
                });
                const prevReturns = allReturns.filter(r => {
                    const d = new Date(r.date);
                    return d >= prevStart && d <= prevEnd;
                });

                const currentRevenue =
                    filteredSales.reduce((sum, s) => sum + s.totalAmount, 0) +
                    filteredWholesale.reduce((sum, s) => sum + s.totalAmount, 0);
                const currentExpenses = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
                const currentReturns = filteredReturns.reduce((sum, r) => sum + r.totalRefundAmount, 0);
                const currentNetProfit = currentRevenue - currentExpenses - currentReturns;

                const prevRevenue =
                    prevSales.reduce((sum, s) => sum + s.totalAmount, 0) +
                    prevWholesale.reduce((sum, s) => sum + s.totalAmount, 0);
                const prevExpensesTotal = prevExpenses.reduce((sum, e) => sum + e.amount, 0);
                const prevReturnsTotal = prevReturns.reduce((sum, r) => sum + r.totalRefundAmount, 0);
                const prevNetProfit = prevRevenue - prevExpensesTotal - prevReturnsTotal;

                const periodComparison: PeriodComparisonData = {
                    current: { revenue: currentRevenue, netProfit: currentNetProfit, expenses: currentExpenses, returns: currentReturns },
                    previous: { revenue: prevRevenue, netProfit: prevNetProfit, expenses: prevExpensesTotal, returns: prevReturnsTotal },
                };

                // --- 14: Simple Forecast (moving average) ---
                const forecastHorizonDays = 30;
                const lastNdaysStart = new Date(end.getTime() - forecastHorizonDays * MS_PER_DAY);

                const recentSales = [...allSales, ...allWholesale].filter(s => {
                    const d = new Date(s.date);
                    return d >= lastNdaysStart && d <= end;
                });

                const qtyRecentMap = new Map<string, number>();
                recentSales.forEach(sale => {
                    sale.products.forEach(p => {
                        const existing = qtyRecentMap.get(p.name) || 0;
                        qtyRecentMap.set(p.name, existing + p.quantity);
                    });
                });

                const forecast: ForecastRow[] = [];
                qtyRecentMap.forEach((qty, name) => {
                    const dailyAvgQty = qty / forecastHorizonDays;
                    const forecast30dQty = dailyAvgQty * 30;
                    forecast.push({ productName: name, dailyAvgQty, forecast30dQty });
                });

                forecast.sort((a, b) => b.forecast30dQty - a.forecast30dQty);
                const topForecast = forecast.slice(0, 20);

                // --- 16: Expense KPI Dashboard (fixed vs variable) ---
                const fixedCategories = ['RENT', 'SALARY', 'UTILITIES', 'INSURANCE'];
                let fixed = 0;
                let variable = 0;
                filteredExpenses.forEach(e => {
                    const cat = String(e.category || '').toUpperCase();
                    if (fixedCategories.includes(cat)) fixed += e.amount;
                    else variable += e.amount;
                });
                const totalExp = fixed + variable || 1;
                const expenseKpis: ExpenseKpiData = {
                    totalExpenses: fixed + variable,
                    fixed,
                    variable,
                    fixedPct: (fixed / totalExp) * 100,
                    variablePct: (variable / totalExp) * 100,
                };

                // --- 20: Capital ROI Panel ---
                const inventoryCapital = allInventory.reduce((sum, inv: any) => {
                    return sum + (inv.quantity || 0) * (inv.costPerUnit || 0);
                }, 0);
                const capitalRoi: CapitalRoiData = {
                    netProfit: currentNetProfit,
                    inventoryCapital,
                    roiPercent: inventoryCapital > 0 ? (currentNetProfit / inventoryCapital) * 100 : 0,
                };

                const advancedData: AdvancedReportingData = {
                    type: 'advanced',
                    productMargins,
                    abcSummary,
                    reorderRecommendations,
                    customerProfitability,
                    creditAging,
                    returnsByReason,
                    periodComparison,
                    forecast: topForecast,
                    expenseKpis,
                    capitalRoi,
                };

                setReportData(advancedData);
            }
        } catch (err) {
            console.error("Error generating report:", err);
            setReportData(null);
        } finally {
            setGenerating(false);
        }
    };

    const handleExportCSV = () => {
        if (!reportData) return;
        const start = new Date(startDate);
        const end = new Date(endDate);

        if (reportData && reportData.type === 'sales') {
            const filteredSales = allSales.filter(s => new Date(s.date) >= start && new Date(s.date) <= end);
            const filteredWholesale = allWholesale.filter(s => new Date(s.date) >= start && new Date(s.date) <= end);
            exportToCSV([...filteredSales, ...filteredWholesale], `sales_report_${startDate}_to_${endDate}.csv`);
        } else if (reportData && reportData.type === 'pnl') {
            const filteredExpenses = allExpenses.filter(e => new Date(e.date) >= start && new Date(e.date) <= end);
            exportToCSV(filteredExpenses, `pnl_expenses_${startDate}_to_${endDate}.csv`);
        }
    };
    
    const formatCurrency = (value: number) => 
        new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(value);
    
    const PIE_COLORS = ['#10b981', '#34d399', '#6ee7b7', '#a7f3d0', '#d1fae5', '#fde047', '#facc15'];

    if (loading) return <LoadingSpinner />;
    if (error) return <ApiError onRetry={fetchData} />;

    return (
        <div>
            <h1 className="text-3xl font-bold mb-6 text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-green-500">
                Advanced Reporting
            </h1>
            
            <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-xl shadow-lg p-4 mb-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Report Type</label>
                        <select 
                            value={reportType} 
                            onChange={e => setReportType(e.target.value as ReportType)} 
                            className="w-full bg-gray-800/50 border border-white/20 rounded-md p-2 text-gray-200"
                        >
                            <option value="sales">Sales Analysis</option>
                            <option value="pnl">Profit & Loss Summary</option>
                            <option value="returns">Returns Analysis</option>
                            <option value="warehouse">Warehouse Overview</option>
                            <option value="credits">Credits & Unpaid Sales</option>
                            <option value="advanced">Advanced ROI / Strategy View</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Start Date</label>
                        <input 
                            type="date" 
                            value={startDate} 
                            onChange={e => setStartDate(e.target.value)} 
                            className="w-full bg-gray-800/50 border border-white/20 rounded-md p-2 text-gray-200"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">End Date</label>
                        <input 
                            type="date" 
                            value={endDate} 
                            onChange={e => setEndDate(e.target.value)} 
                            className="w-full bg-gray-800/50 border border-white/20 rounded-md p-2 text-gray-200"
                        />
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
                        {(reportData.type === 'sales' || reportData.type === 'pnl') && (
                            <Button onClick={handleExportCSV} variant="secondary">
                                Export as CSV
                            </Button>
                        )}
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
                                            <YAxis stroke="#9ca3af" tickFormatter={(val) => `₹${(val as number)/1000}k`} />
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
                                <ReportCard 
                                    title="Net Profit" 
                                    value={formatCurrency(reportData.netProfit)} 
                                    description={reportData.netProfit >= 0 ? 'Profit' : 'Loss'}
                                />
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
                                            <Pie 
                                                data={reportData.expenseBreakdown} 
                                                dataKey="value" 
                                                nameKey="name" 
                                                cx="50%" 
                                                cy="50%" 
                                                outerRadius={100}
                                            >
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
                <div className="space-y-8 animate-fade-in mt-8">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <ReportCard title="Total Returns" value={reportData.totalReturns.toString()} />
                        <ReportCard title="Total Refund Amount" value={formatCurrency(reportData.totalRefundAmount)} />
                        <ReportCard title="Avg. Return Value" value={formatCurrency(reportData.avgReturnValue)} />
                    </div>

                    <div className="bg-black/20 border border-white/10 rounded-xl shadow-lg p-6">
                        <h2 className="text-xl font-bold mb-4 text-white">Warehouse-wise Returns</h2>
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={reportData.warehouseReturns}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" />
                                <XAxis dataKey="warehouseName" stroke="#9ca3af" tick={{ fontSize: 12 }} />
                                <YAxis stroke="#9ca3af" tickFormatter={(val) => `₹${(val as number) / 1000}k`} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: 'rgba(30, 41, 59, 0.8)', border: '1px solid rgba(255,255,255,0.2)' }}
                                />
                                <Legend />
                                <Bar dataKey="count" fill="#ef4444" name="Return Count" />
                                <Bar dataKey="amount" fill="#f87171" name="Refund Amount" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="bg-black/20 border border-white/10 rounded-xl shadow-lg p-6">
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
                                    {reportData.topReturnedProducts.map((p) => (
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
            )}

            {/* Warehouse Overview Report */}
            {reportData && reportData.type === 'warehouse' && (
                <div className="space-y-8 animate-fade-in mt-8">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                        <ReportCard 
                            title="Total Sales" 
                            value={formatCurrency(reportData.warehouses.reduce((acc, w) => acc + w.totalSales, 0))} 
                        />
                        <ReportCard 
                            title="Total Expenses" 
                            value={formatCurrency(reportData.warehouses.reduce((acc, w) => acc + w.totalExpenses, 0))} 
                        />
                        <ReportCard 
                            title="Total Inventory" 
                            value={formatCurrency(reportData.warehouses.reduce((acc, w) => acc + w.totalInventory, 0))} 
                        />
                        <ReportCard 
                            title="Net Profit" 
                            value={formatCurrency(reportData.warehouses.reduce((acc, w) => acc + w.netProfit, 0))} 
                        />
                    </div>

                    <div className="bg-black/20 border border-white/10 rounded-xl shadow-lg overflow-hidden">
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
                                    {reportData.warehouses.map((w) => (
                                        <tr key={w.name} className="border-b border-white/10 hover:bg-white/5 transition-colors">
                                            <td className="px-6 py-4 font-medium text-white">{w.name}</td>
                                            <td className="px-6 py-4 text-right">{w.salesCount}</td>
                                            <td className="px-6 py-4 text-right">{formatCurrency(w.totalSales)}</td>
                                            <td className="px-6 py-4 text-right">{formatCurrency(w.totalExpenses)}</td>
                                            <td className="px-6 py-4 text-right">{formatCurrency(w.totalInventory)}</td>
                                            <td
                                                className={`px-6 py-4 text-right font-semibold ${
                                                    w.netProfit >= 0 ? 'text-green-400' : 'text-red-400'
                                                }`}
                                            >
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
                <div className="space-y-8 animate-fade-in mt-8">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <ReportCard title="Total Unpaid" value={formatCurrency(reportData.totalUnpaid)} description="Outstanding Amount" />
                        <ReportCard title="Retail Unpaid" value={formatCurrency(reportData.retailUnpaid)} />
                        <ReportCard title="Wholesale Unpaid" value={formatCurrency(reportData.wholesaleUnpaid)} />
                    </div>

                    <div className="bg-black/20 border border-white/10 rounded-xl shadow-lg overflow-hidden">
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
                                    {reportData.unpaidSales.map((sale) => (
                                        <tr key={sale.invoiceNumber} className="border-b border-white/10 hover:bg-white/5 transition-colors">
                                            <td className="px-6 py-4 font-mono text-xs">{sale.invoiceNumber}</td>
                                            <td className="px-6 py-4 font-medium text-white">{sale.customerName}</td>
                                            <td className="px-6 py-4">
                                                <span
                                                    className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                                                        sale.type === 'Retail' ? 'bg-blue-500/20 text-blue-300' : 'bg-purple-500/20 text-purple-300'
                                                    }`}
                                                >
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

            {/* ADVANCED ROI / STRATEGY VIEW */}
            {reportData && reportData.type === 'advanced' && (
                <div className="space-y-10 animate-fade-in mt-8">
                    {/* Top-level ROI Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <ReportCard 
                            title="Current Period Revenue" 
                            value={formatCurrency(reportData.periodComparison.current.revenue)} 
                        />
                        <ReportCard 
                            title="Current Net Profit" 
                            value={formatCurrency(reportData.periodComparison.current.netProfit)} 
                            description={reportData.periodComparison.current.netProfit >= 0 ? 'Profit' : 'Loss'}
                        />
                        <ReportCard 
                            title="Capital Deployed (Inventory)" 
                            value={formatCurrency(reportData.capitalRoi.inventoryCapital)} 
                        />
                        <ReportCard 
                            title="ROI on Inventory" 
                            value={`${reportData.capitalRoi.roiPercent.toFixed(2)} %`} 
                            description="Net Profit / Inventory Value" 
                        />
                    </div>

                    {/* Period Comparison + Expense KPIs */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <div className="bg-black/20 border border-white/10 rounded-xl shadow-lg p-6">
                            <h2 className="text-xl font-bold mb-4 text-white">Period Comparison</h2>
                            <table className="min-w-full text-sm text-left text-gray-300">
                                <thead className="bg-white/5 uppercase text-xs">
                                    <tr>
                                        <th className="px-4 py-2"></th>
                                        <th className="px-4 py-2 text-right">Revenue</th>
                                        <th className="px-4 py-2 text-right">Net Profit</th>
                                        <th className="px-4 py-2 text-right">Expenses</th>
                                        <th className="px-4 py-2 text-right">Returns</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr className="border-b border-white/10">
                                        <td className="px-4 py-2 font-medium text-white">Current Period</td>
                                        <td className="px-4 py-2 text-right">{formatCurrency(reportData.periodComparison.current.revenue)}</td>
                                        <td className="px-4 py-2 text-right">{formatCurrency(reportData.periodComparison.current.netProfit)}</td>
                                        <td className="px-4 py-2 text-right">{formatCurrency(reportData.periodComparison.current.expenses)}</td>
                                        <td className="px-4 py-2 text-right">{formatCurrency(reportData.periodComparison.current.returns)}</td>
                                    </tr>
                                    <tr>
                                        <td className="px-4 py-2 font-medium text-white">Previous Period</td>
                                        <td className="px-4 py-2 text-right">{formatCurrency(reportData.periodComparison.previous.revenue)}</td>
                                        <td className="px-4 py-2 text-right">{formatCurrency(reportData.periodComparison.previous.netProfit)}</td>
                                        <td className="px-4 py-2 text-right">{formatCurrency(reportData.periodComparison.previous.expenses)}</td>
                                        <td className="px-4 py-2 text-right">{formatCurrency(reportData.periodComparison.previous.returns)}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        <div className="bg-black/20 border border-white/10 rounded-xl shadow-lg p-6">
                            <h2 className="text-xl font-bold mb-4 text-white">Expense KPIs</h2>
                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <ReportCard 
                                    title="Total Expenses" 
                                    value={formatCurrency(reportData.expenseKpis.totalExpenses)} 
                                />
                                <ReportCard 
                                    title="Fixed vs Variable" 
                                    value={`${reportData.expenseKpis.fixedPct.toFixed(1)}% / ${reportData.expenseKpis.variablePct.toFixed(1)}%`} 
                                    description="Fixed / Variable Expense Mix" 
                                />
                            </div>
                            <p className="text-xs text-gray-400">
                                Fixed categories are treated as Rent, Salary, Utilities, Insurance. Everything else is considered variable.
                            </p>
                        </div>
                    </div>

                    {/* Product Margin & ABC */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <div className="lg:col-span-2 bg-black/20 border border-white/10 rounded-xl shadow-lg p-6">
                            <h2 className="text-xl font-bold mb-4 text-white">Top Products by Net Margin & ROI</h2>
                            <div className="overflow-x-auto">
                                <table className="min-w-full text-xs text-left text-gray-300">
                                    <thead className="bg-white/5 uppercase">
                                        <tr>
                                            <th className="px-3 py-2">Product</th>
                                            <th className="px-3 py-2 text-right">Qty</th>
                                            <th className="px-3 py-2 text-right">Revenue</th>
                                            <th className="px-3 py-2 text-right">Net Margin</th>
                                            <th className="px-3 py-2 text-right">Margin %</th>
                                            <th className="px-3 py-2 text-right">ROI %</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {reportData.productMargins.slice(0, 20).map((p) => (
                                            <tr key={p.productName} className="border-b border-white/10">
                                                <td className="px-3 py-2 font-medium">{p.productName}</td>
                                                <td className="px-3 py-2 text-right">{p.totalQty}</td>
                                                <td className="px-3 py-2 text-right">{formatCurrency(p.revenue)}</td>
                                                <td className="px-3 py-2 text-right">{formatCurrency(p.netMargin)}</td>
                                                <td className="px-3 py-2 text-right">{p.netMarginPct.toFixed(1)}%</td>
                                                <td className="px-3 py-2 text-right">{p.roiPercent.toFixed(1)}%</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="bg-black/20 border border-white/10 rounded-xl shadow-lg p-6">
                            <h2 className="text-xl font-bold mb-4 text-white">ABC Analysis (80/20)</h2>
                            <table className="min-w-full text-xs text-left text-gray-300">
                                <thead className="bg-white/5 uppercase">
                                    <tr>
                                        <th className="px-3 py-2">Class</th>
                                        <th className="px-3 py-2 text-right">Products</th>
                                        <th className="px-3 py-2 text-right">Revenue %</th>
                                        <th className="px-3 py-2 text-right">Margin %</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {reportData.abcSummary.map(row => (
                                        <tr key={row.classLabel} className="border-b border-white/10">
                                            <td className="px-3 py-2 font-semibold text-white">{row.classLabel}</td>
                                            <td className="px-3 py-2 text-right">{row.productCount}</td>
                                            <td className="px-3 py-2 text-right">{row.revenueShare.toFixed(1)}%</td>
                                            <td className="px-3 py-2 text-right">{row.marginShare.toFixed(1)}%</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <p className="text-xs text-gray-400 mt-3">
                                A = heavy hitters (top revenue), B = important support, C = long tail / low impact.
                            </p>
                        </div>
                    </div>

                    {/* Reorder Recommendations + Forecast */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <div className="bg-black/20 border border-white/10 rounded-xl shadow-lg p-6">
                            <h2 className="text-xl font-bold mb-4 text-white">Reorder Recommendations (Coverage 30 Days)</h2>
                            <div className="overflow-x-auto">
                                <table className="min-w-full text-xs text-left text-gray-300">
                                    <thead className="bg-white/5 uppercase">
                                        <tr>
                                            <th className="px-3 py-2">Product</th>
                                            <th className="px-3 py-2 text-right">Stock</th>
                                            <th className="px-3 py-2 text-right">Coverage Days</th>
                                            <th className="px-3 py-2 text-right">Reorder Qty</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {reportData.reorderRecommendations.slice(0, 20).map(row => (
                                            <tr key={row.productName} className="border-b border-white/10">
                                                <td className="px-3 py-2 font-medium">{row.productName}</td>
                                                <td className="px-3 py-2 text-right">{row.currentStock}</td>
                                                <td className="px-3 py-2 text-right">
                                                    {row.coverageDays === 0 ? '-' : row.coverageDays.toFixed(1)}
                                                </td>
                                                <td className="px-3 py-2 text-right text-yellow-300 font-semibold">
                                                    {row.recommendedQty}
                                                </td>
                                            </tr>
                                        ))}
                                        {reportData.reorderRecommendations.length === 0 && (
                                            <tr>
                                                <td className="px-3 py-4 text-center text-gray-500" colSpan={4}>
                                                    No reorder needs detected for this period based on sales & coverage target.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="bg-black/20 border border-white/10 rounded-xl shadow-lg p-6">
                            <h2 className="text-xl font-bold mb-4 text-white">30-Day Demand Forecast (Top Products)</h2>
                            <div className="overflow-x-auto">
                                <table className="min-w-full text-xs text-left text-gray-300">
                                    <thead className="bg-white/5 uppercase">
                                        <tr>
                                            <th className="px-3 py-2">Product</th>
                                            <th className="px-3 py-2 text-right">Daily Avg Qty</th>
                                            <th className="px-3 py-2 text-right">Forecast Next 30 Days</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {reportData.forecast.map(row => (
                                            <tr key={row.productName} className="border-b border-white/10">
                                                <td className="px-3 py-2 font-medium">{row.productName}</td>
                                                <td className="px-3 py-2 text-right">{row.dailyAvgQty.toFixed(2)}</td>
                                                <td className="px-3 py-2 text-right text-emerald-300 font-semibold">
                                                    {row.forecast30dQty.toFixed(0)}
                                                </td>
                                            </tr>
                                        ))}
                                        {reportData.forecast.length === 0 && (
                                            <tr>
                                                <td className="px-3 py-4 text-center text-gray-500" colSpan={3}>
                                                    Not enough recent data to build a forecast.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    {/* Customer Profitability + Credit Aging + Returns Reason */}
                    <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                        <div className="xl:col-span-1 bg-black/20 border border-white/10 rounded-xl shadow-lg p-6">
                            <h2 className="text-xl font-bold mb-4 text-white">Top Customers by Net Revenue</h2>
                            <div className="overflow-x-auto">
                                <table className="min-w-full text-xs text-left text-gray-300">
                                    <thead className="bg-white/5 uppercase">
                                        <tr>
                                            <th className="px-3 py-2">Customer</th>
                                            <th className="px-3 py-2 text-right">Orders</th>
                                            <th className="px-3 py-2 text-right">Revenue</th>
                                            <th className="px-3 py-2 text-right">Returns</th>
                                            <th className="px-3 py-2 text-right">Net</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {reportData.customerProfitability.map(c => (
                                            <tr key={c.customerName} className="border-b border-white/10">
                                                <td className="px-3 py-2 font-medium">{c.customerName}</td>
                                                <td className="px-3 py-2 text-right">{c.orderCount}</td>
                                                <td className="px-3 py-2 text-right">{formatCurrency(c.revenue)}</td>
                                                <td className="px-3 py-2 text-right text-red-300">{formatCurrency(c.returns)}</td>
                                                <td className="px-3 py-2 text-right text-emerald-300 font-semibold">
                                                    {formatCurrency(c.netRevenue)}
                                                </td>
                                            </tr>
                                        ))}
                                        {reportData.customerProfitability.length === 0 && (
                                            <tr>
                                                <td className="px-3 py-4 text-center text-gray-500" colSpan={5}>
                                                    No customer data for this period.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="bg-black/20 border border-white/10 rounded-xl shadow-lg p-6">
                            <h2 className="text-xl font-bold mb-4 text-white">Credit Risk & Aging</h2>
                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <ReportCard 
                                    title="Total Unpaid" 
                                    value={formatCurrency(reportData.creditAging.totalUnpaid)} 
                                    description="Outstanding this period" 
                                />
                                <ReportCard 
                                    title="Avg. Days Outstanding" 
                                    value={reportData.creditAging.avgDaysOutstanding.toFixed(1)} 
                                    description="Weighted by amount" 
                                />
                            </div>
                            <table className="min-w-full text-xs text-left text-gray-300">
                                <thead className="bg-white/5 uppercase">
                                    <tr>
                                        <th className="px-3 py-2">Bucket</th>
                                        <th className="px-3 py-2 text-right">Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {reportData.creditAging.buckets.map(b => (
                                        <tr key={b.label} className="border-b border-white/10">
                                            <td className="px-3 py-2">{b.label}</td>
                                            <td className="px-3 py-2 text-right">{formatCurrency(b.amount)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="bg-black/20 border border-white/10 rounded-xl shadow-lg p-6">
                            <h2 className="text-xl font-bold mb-4 text-white">Returns Reason Analysis</h2>
                            <table className="min-w-full text-xs text-left text-gray-300">
                                <thead className="bg-white/5 uppercase">
                                    <tr>
                                        <th className="px-3 py-2">Reason</th>
                                        <th className="px-3 py-2 text-right">Count</th>
                                        <th className="px-3 py-2 text-right">Refund Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {reportData.returnsByReason.map(r => (
                                        <tr key={r.reason} className="border-b border-white/10">
                                            <td className="px-3 py-2 font-medium">{r.reason}</td>
                                            <td className="px-3 py-2 text-right">{r.count}</td>
                                            <td className="px-3 py-2 text-right text-red-300">{formatCurrency(r.amount)}</td>
                                        </tr>
                                    ))}
                                    {reportData.returnsByReason.length === 0 && (
                                        <tr>
                                            <td className="px-3 py-4 text-center text-gray-500" colSpan={3}>
                                                No returns recorded in this period.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Simple "Alert-style" summary for management (supports your point 18 conceptually) */}
                    <div className="bg-amber-500/10 border border-amber-500/40 rounded-xl p-4 text-sm text-amber-100">
                        <h3 className="font-semibold mb-1">Management Insight Snapshot</h3>
                        <ul className="list-disc pl-5 space-y-1">
                            <li>
                                Top A-class products are driving 
                                {' '}{reportData.abcSummary.find(a => a.classLabel === 'A')?.revenueShare.toFixed(1)}% of revenue —
                                focus production, marketing and stock on these.
                            </li>
                            <li>
                                Current ROI on inventory is {reportData.capitalRoi.roiPercent.toFixed(2)}%. 
                                Track this monthly to measure overall business performance on capital.
                            </li>
                            <li>
                                Returns reasons show 
                                {' '}{reportData.returnsByReason.slice(0,1).map(r => `"${r.reason}"`)} 
                                as the largest loss contributor — root-cause and fix here for direct profit impact.
                            </li>
                            <li>
                                Average credit days of {reportData.creditAging.avgDaysOutstanding.toFixed(1)} suggests 
                                you can tighten credit policy or collections to speed up cash flow.
                            </li>
                        </ul>
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
