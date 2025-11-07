import React, { useState, useEffect, useCallback } from 'react';
import { getWholesaleSales, addWholesaleSale, updateWholesaleSale, deleteWholesaleSale, getProducts } from '../services/api';
import { WholesaleSale, Product, SaleProduct } from '../types';
import Button from './common/Button';
import Modal from './common/Modal';
import ConfirmModal from './common/ConfirmModal';
import ApiError from './common/ApiError';

const LoadingSpinner = () => (
    <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-emerald-500"></div>
    </div>
);

const WholesaleSaleForm: React.FC<{
  sale: Omit<WholesaleSale, 'id'> | WholesaleSale | null;
  products: Product[];
  onSave: (sale: Omit<WholesaleSale, 'id'> | WholesaleSale) => void;
  onCancel: () => void;
}> = ({ sale, products, onSave, onCancel }) => {
  const [formData, setFormData] = useState({
    shopName: '',
    contact: '',
    address: '',
    products: [] as SaleProduct[],
    totalAmount: 0,
    date: new Date().toISOString().split('T')[0],
    status: 'Paid' as 'Paid' | 'Unpaid',
    ...sale
  });
  const [currentProduct, setCurrentProduct] = useState('');
  const [currentQty, setCurrentQty] = useState(1);
  const [currentPrice, setCurrentPrice] = useState(0);

  useEffect(() => {
    const total = formData.products.reduce((sum, p) => sum + p.price * p.quantity, 0);
    setFormData(prev => ({ ...prev, totalAmount: total }));
  }, [formData.products]);
  
  const handleProductSelect = (productId: string) => {
    setCurrentProduct(productId);
    const product = products.find(p => p.id === productId);
    if(product) setCurrentPrice(product.defaultPrice * 0.8);
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleAddProduct = () => {
    const product = products.find(p => p.id === currentProduct);
    if (!product || currentQty <= 0 || currentPrice <= 0) return;

    setFormData(prev => ({
      ...prev,
      products: [...prev.products, { name: product.name, quantity: currentQty, price: currentPrice }]
    }));
    setCurrentProduct('');
    setCurrentQty(1);
    setCurrentPrice(0);
  };

  const handleRemoveProduct = (index: number) => {
    setFormData(prev => ({
      ...prev,
      products: prev.products.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if(formData.products.length === 0) {
        alert("Please add at least one product to the sale.");
        return;
    }
    onSave(formData);
  };
  
  const retailProducts = products.filter(p => !p.name.toLowerCase().includes('monthly'));

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input type="text" name="shopName" value={formData.shopName} onChange={handleChange} placeholder="Shop Name" className="w-full bg-gray-800/50 border border-white/20 rounded-md p-2 text-gray-200" required />
            <input type="tel" name="contact" value={formData.contact} onChange={handleChange} placeholder="Contact Number" className="w-full bg-gray-800/50 border border-white/20 rounded-md p-2 text-gray-200" required />
        </div>
        <input type="text" name="address" value={formData.address} onChange={handleChange} placeholder="Address" className="w-full bg-gray-800/50 border border-white/20 rounded-md p-2 text-gray-200" required />
        
        <div className="border-t border-b border-white/10 py-4">
            <h4 className="font-semibold text-gray-200 mb-2">Products</h4>
            <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
                {formData.products.map((p, index) => (
                    <div key={index} className="flex justify-between items-center bg-gray-800/50 p-2 rounded">
                        <span>{p.quantity} x {p.name} @ {p.price}</span>
                        <Button type="button" variant="ghost" className="!p-1 !text-red-400" onClick={() => handleRemoveProduct(index)}>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </Button>
                    </div>
                ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 items-center gap-2 mt-3">
                <select value={currentProduct} onChange={e => handleProductSelect(e.target.value)} className="md:col-span-2 bg-gray-700/50 border border-white/20 rounded-md p-2 text-gray-200">
                    <option value="">Select a product</option>
                    {retailProducts.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <input type="number" value={currentQty} onChange={e => setCurrentQty(parseInt(e.target.value))} min="1" placeholder="Qty" className="w-full bg-gray-700/50 border border-white/20 rounded-md p-2 text-gray-200" />
                <input type="number" value={currentPrice} onChange={e => setCurrentPrice(parseFloat(e.target.value))} min="0" step="0.01" placeholder="Price/Unit" className="w-full bg-gray-700/50 border border-white/20 rounded-md p-2 text-gray-200" />
            </div>
            <Button type="button" variant="secondary" onClick={handleAddProduct} className="w-full mt-2">Add Product</Button>

        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input type="date" name="date" value={formData.date} onChange={handleChange} className="w-full bg-gray-800/50 border border-white/20 rounded-md p-2 text-gray-200" required />
            <select name="status" value={formData.status} onChange={handleChange} className="w-full bg-gray-800/50 border border-white/20 rounded-md p-2 text-gray-200">
                <option value="Paid">Paid</option>
                <option value="Unpaid">Unpaid</option>
            </select>
        </div>
        <div className="text-right text-xl font-bold text-white">
            Total: {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(formData.totalAmount)}
        </div>
        <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
            <Button type="submit" variant="primary">Save Sale</Button>
        </div>
    </form>
  );
};

const Wholesale: React.FC = () => {
    const [sales, setSales] = useState<WholesaleSale[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [selectedSale, setSelectedSale] = useState<WholesaleSale | null>(null);
    const [saleToDelete, setSaleToDelete] = useState<string | null>(null);
    const [isExporting, setIsExporting] = useState(false);

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [salesData, productsData] = await Promise.all([getWholesaleSales(), getProducts()]);
            setSales(salesData);
            setProducts(productsData);
        } catch (err) {
            console.error(err);
            setError("Failed to fetch wholesale data.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleSave = async (saleData: Omit<WholesaleSale, 'id'> | WholesaleSale) => {
        try {
            if ('id' in saleData && saleData.id) {
                await updateWholesaleSale(saleData as WholesaleSale);
            } else {
                await addWholesaleSale(saleData);
            }
            fetchData();
            setIsModalOpen(false);
            setSelectedSale(null);
        } catch (err) {
            console.error(err);
            alert("Failed to save wholesale sale.");
        }
    };

    const handleDelete = async () => {
        if (!saleToDelete) return;
        try {
            await deleteWholesaleSale(saleToDelete);
            fetchData();
        } catch (err) {
            console.error(err);
            alert("Failed to delete wholesale sale.");
        } finally {
            setIsConfirmOpen(false);
            setSaleToDelete(null);
        }
    };
    
    const handleExportPDF = () => {
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
    
          doc.setFontSize(18);
          doc.text("SHROOMMUSH - Wholesale Sales Report", 14, 22);
          doc.setFontSize(11);
          doc.setTextColor(100);
          doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 30);
    
          autoTable(doc, {
            startY: 40,
            head: [['Date', 'Shop', 'Products', 'Total', 'Status']],
            body: sales.map(s => [
                s.date,
                s.shopName,
                s.products.map(p => `${p.quantity}x ${p.name} @ ${p.price}`).join('\n'),
                formatCurrency(s.totalAmount),
                s.status,
            ]),
            headStyles: { fillColor: [34, 197, 94] },
          });
    
          doc.save('wholesale-sales-report.pdf');
        } catch (error) {
          console.error("Error exporting PDF:", error);
          alert("An error occurred while generating the PDF.");
        } finally {
          setIsExporting(false);
        }
      };

    const openDeleteConfirm = (id: string) => {
        setSaleToDelete(id);
        setIsConfirmOpen(true);
    };

    const formatCurrency = (value: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(value);

    if (loading) return <LoadingSpinner />;
    if (error) return <ApiError onRetry={fetchData} />;

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-green-500">Wholesale</h1>
                <div className="flex items-center space-x-2">
                    <Button onClick={handleExportPDF} variant="secondary" disabled={isExporting}>
                        {isExporting ? 'Exporting...' : 'Export as PDF'}
                    </Button>
                    <Button onClick={() => { setSelectedSale(null); setIsModalOpen(true); }}>Add Wholesale Sale</Button>
                </div>
            </div>

            <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-xl shadow-lg overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full text-sm text-left text-gray-300">
                        <thead className="bg-white/5 uppercase text-xs">
                            <tr>
                                <th scope="col" className="px-6 py-3">Date</th>
                                <th scope="col" className="px-6 py-3">Shop Name</th>
                                <th scope="col" className="px-6 py-3">Total Amount</th>
                                <th scope="col" className="px-6 py-3">Status</th>
                                <th scope="col" className="px-6 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sales.map(s => (
                                <tr key={s.id} className="border-b border-white/10 hover:bg-white/5 transition-colors">
                                    <td className="px-6 py-4">{s.date}</td>
                                    <td className="px-6 py-4 font-medium text-white">{s.shopName}</td>
                                    <td className="px-6 py-4">{formatCurrency(s.totalAmount)}</td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${s.status === 'Paid' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-yellow-500/20 text-yellow-300'}`}>{s.status}</span>
                                    </td>
                                    <td className="px-6 py-4 text-right space-x-2">
                                        <Button variant="ghost" onClick={() => { setSelectedSale(s); setIsModalOpen(true); }}>Edit</Button>
                                        <Button variant="ghost" className="text-red-400 hover:bg-red-500/10" onClick={() => openDeleteConfirm(s.id)}>Delete</Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={selectedSale ? 'Edit Wholesale Sale' : 'Add Wholesale Sale'}>
                <WholesaleSaleForm sale={selectedSale} products={products} onSave={handleSave} onCancel={() => { setIsModalOpen(false); setSelectedSale(null); }} />
            </Modal>

            <ConfirmModal isOpen={isConfirmOpen} onClose={() => setIsConfirmOpen(false)} onConfirm={handleDelete} title="Delete Wholesale Sale" message="Are you sure you want to delete this wholesale sale record?" />
        </div>
    );
};

export default Wholesale;
