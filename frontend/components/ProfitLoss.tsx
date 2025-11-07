import React, { useEffect, useState, useCallback } from 'react';
import { getSales, getExpenses, getWholesaleSales } from '../services/api';
import { Sale, Expense, WholesaleSale } from '../types';
import Button from './common/Button';
import ApiError from './common/ApiError';

const LoadingSpinner = () => (
    <div className="flex justify-center items-center h-64">
      <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-emerald-500"></div>
    </div>
  );

const ProfitLoss: React.FC = () => {
  const [sales, setSales] = useState<Sale[]>([]);
  const [wholesaleSales, setWholesaleSales] = useState<WholesaleSale[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
        const [salesData, wholesaleSalesData, expensesData] = await Promise.all([
            getSales(),
            getWholesaleSales(),
            getExpenses(),
        ]);
        setSales(salesData);
        setWholesaleSales(wholesaleSalesData);
        setExpenses(expensesData);
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

  const totalRetailRevenue = sales.reduce((sum, sale) => sum + sale.totalAmount, 0);
  const totalWholesaleRevenue = wholesaleSales.reduce((sum, sale) => sum + sale.totalAmount, 0);
  const totalRevenue = totalRetailRevenue + totalWholesaleRevenue;

  const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const netProfit = totalRevenue - totalExpenses;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(value);
  };

  const allRevenueItems = [
    ...sales.map(s => ({...s, type: 'Retail', name: s.customerName})),
    ...wholesaleSales.map(ws => ({...ws, type: 'Wholesale', name: ws.shopName}))
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
        doc.text("Profit & Loss Statement", 14, 22);

        doc.setFontSize(11);
        doc.setTextColor(100);
        doc.text(`Total Revenue: ${formatCurrency(totalRevenue)}`, 14, 32);
        doc.text(`Total Expenses: ${formatCurrency(totalExpenses)}`, 14, 38);
        doc.setFontSize(12);
        doc.setTextColor(0);
        doc.text(`Net Profit: ${formatCurrency(netProfit)}`, 14, 46);

        autoTable(doc, {
          head: [['Revenue Details']],
          startY: 55,
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
          body: expenses.map(exp => [
              exp.description,
              exp.category,
              exp.date,
              `-${formatCurrency(exp.amount)}`
          ]),
          startY: (doc as any).lastAutoTable.finalY,
        });

        doc.save('profit-loss-statement.pdf');
    } catch (error) {
        console.error("Failed to generate PDF:", error);
        alert("An error occurred while generating the PDF.");
    } finally {
        setIsExporting(false);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <ApiError onRetry={fetchData} />;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-green-500">Profit & Loss Statement</h1>
        <Button onClick={handleExportPDF} variant="secondary" disabled={isExporting}>
            {isExporting ? 'Exporting...' : 'Export as PDF'}
        </Button>
      </div>
      
        <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-xl shadow-lg p-6">
                    <h2 className="text-lg font-semibold text-gray-300 uppercase tracking-wider">Total Revenue</h2>
                    <p className="text-3xl font-bold text-emerald-400">{formatCurrency(totalRevenue)}</p>
                </div>
                <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-xl shadow-lg p-6">
                    <h2 className="text-lg font-semibold text-gray-300 uppercase tracking-wider">Total Expenses</h2>
                    <p className="text-3xl font-bold text-red-400">{formatCurrency(totalExpenses)}</p>
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
                        {expenses.map(expense => (
                            <li key={expense.id} className="flex justify-between py-2 border-b border-white/10">
                                <span className="text-gray-300">{expense.description} ({expense.category}) - {expense.date}</span>
                                <span className="font-semibold text-red-400">-{formatCurrency(expense.amount)}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </div>
    </div>
  );
};

export default ProfitLoss;
