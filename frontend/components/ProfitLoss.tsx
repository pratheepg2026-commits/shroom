import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { getSales, getExpenses, getWholesaleSales, getSalesReturns } from '../services/api';
import { Sale, Expense, WholesaleSale, SalesReturn } from '../types';
import { exportToCSV } from '../services/csvExporter';
import Button from './common/Button';
import ApiError from './common/ApiError';

const LoadingSpinner = () => (
    <div className="flex justify-center items-center h-64">
      <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-emerald-500"></div>
    </div>
  );

const getLocalDateString = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const ProfitLoss: React.FC = () => {
  const [allSales, setAllSales] = useState<Sale[]>([]);
  const [allWholesaleSales, setAllWholesaleSales] = useState<WholesaleSale[]>([]);
  const [allExpenses, setAllExpenses] = useState<Expense[]>([]);
  const [allSalesReturns, setAllSalesReturns] = useState<SalesReturn[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingCSV, setIsExportingCSV] = useState(false);
  
  const [startDate, setStartDate] = useState<string>(() => {
    const date = new Date();
    date.setDate(1);
    return getLocalDateString(date);
  });
  const [endDate, setEndDate] = useState<string>(getLocalDateString(new Date()));


  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
        const [salesData, wholesaleSalesData, expensesData, returnsData] = await Promise.all([
            getSales(),
            getWholesaleSales(),
            getExpenses(),
            getSalesReturns(),
        ]);
        setAllSales(salesData);
        setAllWholesaleSales(wholesaleSalesData);
        setAllExpenses(expensesData);
        setAllSalesReturns(returnsData);
    } catch (err) {
        console.error(err);
        setError("Failed to fetch financial data.");
    } finally {
        setLoading(false);
    }
  }, []);
  
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredData = useMemo(() => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    const sales = allSales.filter(s => new Date(s.date) >= start && new Date(s.date) <= end);
    const wholesaleSales = allWholesaleSales.filter(ws => new Date(ws.date) >= start && new Date(ws.date) <= end);
    const expenses = allExpenses.filter(e => new Date(e.date) >= start && new Date(e.date) <= end);
    const salesReturns = allSalesReturns.filter(sr => new Date(sr.date) >= start && new Date(sr.date) <= end);

    return { sales, wholesaleSales, expenses, salesReturns };
  }, [startDate, endDate, allSales, allWholesaleSales, allExpenses, allSalesReturns]);


  const totalRetailRevenue = filteredData.sales.reduce((sum, sale) => sum + sale.totalAmount, 0);
  const totalWholesaleRevenue = filteredData.wholesaleSales.reduce((sum, sale) => sum + sale.totalAmount, 0);
  const totalRevenue = totalRetailRevenue + totalWholesaleRevenue;

  const totalExpenses = filteredData.expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const totalReturnsLoss = filteredData.salesReturns.reduce((sum, sReturn) => sum + sReturn.totalRefundAmount, 0);
  const netProfit = totalRevenue - totalExpenses - totalReturnsLoss;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(value);
  };

  const allRevenueItems = [
    ...filteredData.sales.map(s => ({...s, type: 'Retail', name: s.customerName})),
    ...filteredData.wholesaleSales.map(ws => ({...ws, type: 'Wholesale', name: ws.shopName}))
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  
  const handleExportPDF = () => {
    setIsExporting(true);

    const jspdf = (window as any).jspdf;
    const autoTable = (window as any).autoTable;

    if (!jspdf || !autoTable) {
        console.error("PDF generation libraries are not loaded!");
        alert("A problem occurred while loading PDF libraries. Please refresh the page and try again.");
        setIsExporting(false);
        return;
    }
        
    try {
        const { jsPDF } = jspdf;
        const doc = new jsPDF();
        
        doc.setFontSize(18);
        doc.text(`P&L Statement (${startDate} to ${endDate})`, 14, 22);

        doc.setFontSize(11);
        doc.setTextColor(100);
        doc.text(`Total Revenue: ${formatCurrency(totalRevenue)}`, 14, 32);
        doc.text(`Total Expenses: ${formatCurrency(totalExpenses)}`, 14, 38);
        doc.text(`Loss from Returns: ${formatCurrency(totalReturnsLoss)}`, 14, 44);
        doc.setFontSize(12);
        doc.setTextColor(0);
        doc.text(`Net Profit: ${formatCurrency(netProfit)}`, 14, 52);

        autoTable(doc, {
          head: [['Revenue Details']],
          startY: 60,
          theme: 'plain',
          styles: { fontSize: 14, fontStyle: 'bold' },
        });
        autoTable(doc, {
          head: [['Customer/Shop', 'Type', 'Date', 'Amount']],
          body: allRevenueItems.map(item => [
              item.name,
              item.type,
              item.date,
              `+${formatCurrency(item.totalAmount)}`
          ]),
          startY: (doc as any).lastAutoTable.finalY,
        });

        autoTable(doc, {
          head: [['Expense Details']],
          startY: (doc as any).lastAutoTable.finalY + 10,
          theme: 'plain',
          styles: { fontSize: 14, fontStyle: 'bold' },
        });
        autoTable(doc, {
          head: [['Description', 'Category', 'Date', 'Amount']],
          body: filteredData.expenses.map(exp => [
              exp.description,
              exp.category,
              exp.date,
              `-${formatCurrency(exp.amount)}`
          ]),
          startY: (doc as any).lastAutoTable.finalY,
        });

        autoTable(doc, {
            head: [['Returns Details']],
            startY: (doc as any).lastAutoTable.finalY + 10,
            theme: 'plain',
            styles: { fontSize: 14, fontStyle: 'bold' },
        });
        autoTable(doc, {
            head: [['Customer/Shop', 'Original Invoice', 'Date', 'Amount']],
            body: filteredData.salesReturns.map(ret => [
                ret.customerName,
                ret.originalInvoiceNumber,
                ret.date,
                `-${formatCurrency(ret.totalRefundAmount)}`
            ]),
            startY: (doc as any).lastAutoTable.finalY,
        });

        doc.save(`profit-loss_${startDate}_to_${endDate}.pdf`);
    } catch (error) {
        console.error("Failed to generate PDF:", error);
        alert("An error occurred while generating the PDF.");
    } finally {
        setIsExporting(false);
    }
  };

  const handleExportCSV = () => {
    setIsExportingCSV(true);
    try {
        const revenueData = allRevenueItems.map(item => ({
            Date: item.date,
            Type: `Revenue - ${item.type}`,
            Description: item.name,
            Amount: item.totalAmount,
            Category: '',
            'Original Invoice': ''
        }));
        const expenseData = filteredData.expenses.map(item => ({
            Date: item.date,
            Type: 'Expense',
            Description: item.description,
            Amount: -item.amount,
            Category: item.category,
            'Original Invoice': ''
        }));
        const returnData = filteredData.salesReturns.map(item => ({
            Date: item.date,
            Type: 'Return',
            Description: item.customerName,
            Amount: -item.totalRefundAmount,
            Category: 'Sales Return',
            'Original Invoice': item.originalInvoiceNumber
        }));
    
        const combinedData = [...revenueData, ...expenseData, ...returnData]
            .sort((a, b) => new Date(b.Date).getTime() - new Date(a.Date).getTime());
    
        exportToCSV(combinedData, `profit-loss-ledger_${startDate}_to_${endDate}.csv`);
    } catch (error) {
        console.error("Error exporting CSV:", error);
        alert("An error occurred while generating the CSV.");
    } finally {
        setIsExportingCSV(false);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <ApiError onRetry={fetchData} />;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-green-500">Profit & Loss Statement</h1>
        <div className="flex items-center space-x-2">
            <Button onClick={handleExportCSV} variant="secondary" disabled={isExportingCSV}>
                {isExportingCSV ? 'Exporting...' : 'Export as CSV'}
            </Button>
            <Button onClick={handleExportPDF} variant="secondary" disabled={isExporting}>
                {isExporting ? 'Exporting...' : 'Export as PDF'}
            </Button>
        </div>
      </div>

      <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-xl shadow-lg p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
            <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Start Date</label>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full bg-gray-800/50 border border-white/20 rounded-md p-2 text-gray-200"/>
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">End Date</label>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full bg-gray-800/50 border border-white/20 rounded-md p-2 text-gray-200"/>
            </div>
        </div>
      </div>
      
        <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-xl shadow-lg p-6">
                    <h2 className="text-lg font-semibold text-gray-300 uppercase tracking-wider">Total Revenue</h2>
                    <p className="text-3xl font-bold text-emerald-400">{formatCurrency(totalRevenue)}</p>
                </div>
                <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-xl shadow-lg p-6">
                    <h2 className="text-lg font-semibold text-gray-300 uppercase tracking-wider">Total Expenses</h2>
                    <p className="text-3xl font-bold text-red-400">{formatCurrency(totalExpenses)}</p>
                </div>
                <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-xl shadow-lg p-6">
                    <h2 className="text-lg font-semibold text-gray-300 uppercase tracking-wider">Loss from Returns</h2>
                    <p className="text-3xl font-bold text-yellow-400">{formatCurrency(totalReturnsLoss)}</p>
                </div>
                <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-xl shadow-lg p-6">
                    <h2 className="text-lg font-semibold text-gray-300 uppercase tracking-wider">Net Profit</h2>
                    <p className={`text-3xl font-bold ${netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{formatCurrency(netProfit)}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-xl shadow-lg p-6">
                    <h2 className="text-xl font-bold mb-4 text-white">Revenue Breakdown</h2>
                    <ul className="max-h-96 overflow-y-auto pr-2">
                        {allRevenueItems.map(item => (
                            <li key={item.id} className="flex justify-between py-2 border-b border-white/10">
                                <div>
                                    <span className="text-gray-300">{item.name}</span>
                                    <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${item.type === 'Retail' ? 'bg-blue-500/20 text-blue-300' : 'bg-purple-500/20 text-purple-300'}`}>{item.type}</span>
                                </div>
                                <span className="font-semibold text-emerald-400">+{formatCurrency(item.totalAmount)}</span>
                            </li>
                        ))}
                    </ul>
                </div>
                <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-xl shadow-lg p-6">
                    <h2 className="text-xl font-bold mb-4 text-white">Expense Breakdown</h2>
                    <ul className="max-h-96 overflow-y-auto pr-2">
                        {filteredData.expenses.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(expense => (
                            <li key={expense.id} className="flex justify-between py-2 border-b border-white/10">
                                <div>
                                    <p className="text-gray-300">{expense.description}</p>
                                    <p className="text-xs text-gray-400">{expense.date} - {expense.category}</p>
                                </div>
                                <span className="font-semibold text-red-400">-{formatCurrency(expense.amount)}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
             <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-xl shadow-lg p-6">
                <h2 className="text-xl font-bold mb-4 text-white">Returns Breakdown</h2>
                <ul className="max-h-96 overflow-y-auto pr-2">
                    {filteredData.salesReturns.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(ret => (
                        <li key={ret.id} className="flex justify-between py-2 border-b border-white/10">
                            <div>
                                <p className="text-gray-300">{ret.customerName}</p>
                                <p className="text-xs text-gray-400">{ret.date} - Inv: {ret.originalInvoiceNumber}</p>
                            </div>
                            <span className="font-semibold text-yellow-400">-{formatCurrency(ret.totalRefundAmount)}</span>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    </div>
  );
};

export default ProfitLoss;