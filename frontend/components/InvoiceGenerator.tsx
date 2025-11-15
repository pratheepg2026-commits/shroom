import React, { useState, useEffect, useCallback, useRef } from 'react';
import { getSales, getWholesaleSales } from '../services/api';
import { Sale, WholesaleSale } from '../types';
import Button from './common/Button';
import ApiError from './common/ApiError';

type CombinedSale = (Sale & { type: 'Retail' }) | (WholesaleSale & { type: 'Wholesale' });

const LoadingSpinner = () => (
  <div className="flex justify-center items-center h-64">
    <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-emerald-500"></div>
  </div>
);

const InvoiceGenerator: React.FC = () => {
  const [allSales, setAllSales] = useState<CombinedSale[]>([]);
  const [filteredSales, setFilteredSales] = useState<CombinedSale[]>([]);
  const [selectedSale, setSelectedSale] = useState<CombinedSale | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchType, setSearchType] = useState<'invoice' | 'customer' | 'date'>('invoice');
  
  const invoiceRef = useRef<HTMLDivElement>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [salesData, wholesaleData] = await Promise.all([
        getSales(),
        getWholesaleSales(),
      ]);
      const combined = [
        ...salesData.map(s => ({ ...s, type: 'Retail' as const })),
        ...wholesaleData.map(w => ({ ...w, type: 'Wholesale' as const })),
      ];
      setAllSales(combined);
      setFilteredSales(combined);
    } catch (err) {
      console.error(err);
      setError('Failed to fetch sales data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTerm) {
      setFilteredSales(allSales);
      return;
    }

    const lowercasedTerm = searchTerm.toLowerCase();
    const results = allSales.filter(sale => {
      switch (searchType) {
        case 'invoice':
          return sale.invoiceNumber.toLowerCase().includes(lowercasedTerm);
        case 'customer':
          const name = 'customerName' in sale ? sale.customerName : sale.shopName;
          return name.toLowerCase().includes(lowercasedTerm);
        case 'date':
          return sale.date.includes(searchTerm);
        default:
          return false;
      }
    });
    setFilteredSales(results);
  };

  const handleSelectSale = (sale: CombinedSale) => {
    setSelectedSale(sale);
  };

  const handlePrint = () => {
    window.print();
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(value);

  if (loading) return <LoadingSpinner />;
  if (error) return <ApiError onRetry={fetchData} />;

  return (
    <div>
      {/* Screen view - hidden during print */}
      <div className="no-print">
        <h1 className="text-3xl font-bold mb-6 text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-green-500">
          Invoice Generator
        </h1>

        {/* Search Section */}
        <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-xl shadow-lg p-4 mb-6">
          <h3 className="text-lg font-semibold text-white mb-2">Search Invoice</h3>
          <form onSubmit={handleSearch} className="flex flex-col md:flex-row items-center gap-2">
            <select
              value={searchType}
              onChange={e => setSearchType(e.target.value as any)}
              className="bg-gray-800/50 border border-white/20 rounded-md p-2 text-gray-200"
            >
              <option value="invoice">Invoice #</option>
              <option value="customer">Customer/Shop</option>
              <option value="date">Date</option>
            </select>
            <input
              type={searchType === 'date' ? 'date' : 'text'}
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder={`Search by ${searchType}...`}
              className="flex-grow w-full bg-gray-800/50 border border-white/20 rounded-md p-2 text-gray-200"
            />
            <Button type="submit">Search</Button>
          </form>
        </div>

     {/* Sales List */}
<div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-xl shadow-lg overflow-hidden mb-6">
  <div className="overflow-x-auto">
    <table className="min-w-full text-sm text-left text-gray-300">
      <thead className="bg-white/5 uppercase text-xs">
        <tr>
          <th scope="col" className="px-6 py-3">Date</th>
          <th scope="col" className="px-6 py-3">Invoice #</th>
          <th scope="col" className="px-6 py-3">Customer/Shop</th>
          <th scope="col" className="px-6 py-3">Type</th>
          <th scope="col" className="px-6 py-3">Amount</th>
          <th scope="col" className="px-6 py-3 text-right">Actions</th>
        </tr>
      </thead>
      <tbody>
  {filteredSales
    .slice()
    .sort((a, b) => {
      const dateCompare = b.date.localeCompare(a.date);
      if (dateCompare !== 0) return dateCompare;
      return b.invoiceNumber.localeCompare(a.invoiceNumber);
    })
    .map(s => (
      <tr
        key={s.id}
        className="border-b border-white/10 hover:bg-white/5 transition-colors"
      >
        <td className="px-6 py-4">{s.date}</td>
        <td className="px-6 py-4 font-mono text-xs">{s.invoiceNumber}</td>
        <td className="px-6 py-4 font-medium text-white">
          {'customerName' in s ? s.customerName : s.shopName}
        </td>
        <td className="px-6 py-4">
          <span
            className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
              s.type === 'Retail'
                ? 'bg-blue-500/20 text-blue-300'
                : 'bg-purple-500/20 text-purple-300'
            }`}
          >
            {s.type}
          </span>
        </td>
        <td className="px-6 py-4">{formatCurrency(s.totalAmount)}</td>
        <td className="px-6 py-4 text-right">
          {/* Single Print Invoice button */}
          <Button 
            variant="primary"
            onClick={() => {
              setSelectedSale(s);
              setTimeout(() => handlePrint(), 100);
            }}
            className="flex items-center gap-2"
          >
            <span>🖨️</span>
            <span>Print Invoice</span>
          </Button>
        </td>
      </tr>
    ))}
</tbody>

    </table>
  </div>
</div>

{/* Remove this entire section - no longer needed */}
{/* 
{selectedSale && (
  <div className="flex justify-end mb-6">
    <Button onClick={handlePrint} variant="primary">
      🖨️ Print Invoice
    </Button>
  </div>
)}
*/}

        {/* Print Button */}
        {selectedSale && (
          <div className="flex justify-end mb-6">
            <Button onClick={handlePrint} variant="primary">
              🖨️ Print Invoice
            </Button>
          </div>
        )}
      </div>

      {/* Invoice Preview & Print View */}
      {selectedSale && (
        <div ref={invoiceRef} className="print-only">
          <div className="invoice-container">
            {/* Header */}
            <div className="invoice-header">
              <div className="company-info">
                <h1>SHROOMMUSH</h1>
                <p>By Amina Organic Farms</p>
                <p>Contact: +91-6282700864</p>
                <p>Email: shroommush@gmail.com</p>
              </div>
              <div className="invoice-details">
                <h2>INVOICE</h2>
                <p><strong>Invoice #:</strong> {selectedSale.invoiceNumber}</p>
                <p><strong>Date:</strong> {selectedSale.date}</p>
                <p><strong>Type:</strong> {selectedSale.type}</p>
              </div>
            </div>

            {/* Bill To */}
            <div className="bill-to">
              <h3>Bill To:</h3>
              <p><strong>{'customerName' in selectedSale ? selectedSale.customerName : selectedSale.shopName}</strong></p>
              {'customerPhone' in selectedSale && selectedSale.customerPhone && (
                <p>Phone: {selectedSale.customerPhone}</p>
              )}
                {/* Address for Retail Sales */}
              {'customerAddress' in selectedSale && selectedSale.customerAddress && (
                <p>Address: {selectedSale.customerAddress}</p>
              )}
    
              {'shopAddress' in selectedSale && selectedSale.shopAddress && (
                <p>Address: {selectedSale.shopAddress}</p>
              )}
            </div>

            {/* Items Table */}
            <table className="invoice-items">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Quantity</th>
                  <th>Price</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {selectedSale.products.map((product, index) => (
                  <tr key={index}>
                    <td>{product.name}</td>
                    <td>{product.quantity}</td>
                    <td>{formatCurrency(product.price)}</td>
                    <td>{formatCurrency(product.price * product.quantity)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Total */}
            <div className="invoice-total">
              <div className="total-row">
                <span>Subtotal:</span>
                <span>{formatCurrency(selectedSale.totalAmount)}</span>
              </div>
              <div className="total-row grand-total">
                <span>Total Amount:</span>
                <span>{formatCurrency(selectedSale.totalAmount)}</span>
              </div>
            </div>

            {/* Footer */}
            <div className="invoice-footer">
              <p>Thank you for your business!</p>
             
             
              <p className="terms" > Terms & Conditions: <br/>
              1. All mushrooms are freshly harvested and must be refrigerated immediately after delivery.<br/>
              2.Customer is responsible for proper handling and storage after delivery. The farm is not liable for spoilage caused by improper storage or delay in refrigeration.<br/> 
              3. Any quality issues must be reported within 6 hours of delivery with proof.<br/> 
              4. Prices are based on weight at packing; slight weight variation may occur.<br/> 
              5. Payment must be cleared as per the mode selected (Cash/UPI/Credit).<br/> 
              6. The farm is not responsible for spoilage caused by improper storage or delay.<br/> 
              </p>

            </div>
          </div>
        </div>
      )}

      {/* Print Styles */}
      <style>{`
        /* Hide screen elements during print */
        @media print {
          .no-print {
            display: none !important;
          }
          
          .print-only {
            display: block !important;
          }
          
          body {
            background: white;
          }
        }

        /* Hide print view on screen */
        .print-only {
          display: none;
        }

        @media print {
          .print-only {
            display: block;
          }
        }

        /* Invoice Styles */
        .invoice-container {
          max-width: 210mm;
          margin: 0 auto;
          padding: 20mm;
          background: white;
          color: black;
          font-family: Arial, sans-serif;
        }

        .invoice-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 30px;
          padding-bottom: 20px;
          border-bottom: 2px solid #10b981;
        }

        .company-info h1 {
          font-size: 28px;
          color: #10b981;
          margin: 0 0 10px 0;
        }

        .company-info p {
          margin: 5px 0;
          color: #666;
        }

        .invoice-details {
          text-align: right;
        }

        .invoice-details h2 {
          font-size: 32px;
          color: #10b981;
          margin: 0 0 10px 0;
        }

        .invoice-details p {
          margin: 5px 0;
        }

        .bill-to {
          margin-bottom: 30px;
        }

        .bill-to h3 {
          color: #10b981;
          margin-bottom: 10px;
        }

        .bill-to p {
          margin: 5px 0;
        }

        .invoice-items {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 30px;
        }

        .invoice-items thead {
          background: #10b981;
          color: white;
        }

        .invoice-items th,
        .invoice-items td {
          padding: 12px;
          text-align: left;
          border-bottom: 1px solid #ddd;
        }

        .invoice-items th:last-child,
        .invoice-items td:last-child {
          text-align: right;
        }

        .invoice-items tbody tr:hover {
          background: #f9f9f9;
        }

        .invoice-total {
          margin-left: auto;
          width: 300px;
          margin-bottom: 30px;
        }

        .total-row {
          display: flex;
          justify-content: space-between;
          padding: 10px;
          border-bottom: 1px solid #ddd;
        }

        .grand-total {
          background: #10b981;
          color: white;
          font-weight: bold;
          font-size: 18px;
          border: none;
        }

        .invoice-footer {
          text-align: center;
          margin-top: 50px;
          padding-top: 20px;
          border-top: 1px solid #ddd;
        }

        .invoice-footer p {
          margin: 10px 0;
        }

        .terms {
          font-size: 12px;
          color: #666;
          text-align: left;
        }
        

        /* Screen preview styles */
        @media screen {
          .invoice-container {
            border: 1px solid #e5e7eb;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
          }
        }
      `}</style>
    </div>
  );
};

export default InvoiceGenerator;
