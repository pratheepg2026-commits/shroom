// Sales.tsx - Complete with Warehouse Integration
import React, { useState, useEffect, useCallback } from 'react';
import { getSales, addSale, updateSale, deleteSale, getProducts, getInventory, getWholesaleSales, addWholesaleSale, updateWholesaleSale, deleteWholesaleSale, getWarehouses } from '../services/api';
import { Sale, Product, SaleProduct, InventoryItem, SaleStatus, WholesaleSale, Warehouse } from '../types';
import { exportToCSV } from '../services/csvExporter';
import Button from './common/Button';
import Modal from './common/Modal';
import ConfirmModal from './common/ConfirmModal';
import ApiError from './common/ApiError';

type CombinedSale = (Sale & { type: 'Retail' }) | (WholesaleSale & { type: 'Wholesale' });

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

const SaleForm: React.FC<{
  sale: CombinedSale | null;
  products: Product[];
  inventory: InventoryItem[];
  warehouses: Warehouse[];
  selectedWarehouse: string;
  onWarehouseChange: (warehouseId: string) => void;
  onSave: (saleData: any, saleType: 'Retail' | 'Wholesale') => void;
  onCancel: () => void;
}> = ({ sale, products, inventory, warehouses, selectedWarehouse, onWarehouseChange, onSave, onCancel }) => {
  
  const isEditing = sale !== null;
  const initialType = isEditing ? sale.type : 'Retail';

  const [saleType, setSaleType] = useState<'Retail' | 'Wholesale'>(initialType);

  const [formData, setFormData] = useState({
    customerName: '',
    shopName: '',
    contact: '',
    address: '',
    products: [] as SaleProduct[],
    totalAmount: 0,
    date: getLocalDateString(new Date()),
    status: 'Cash' as SaleStatus,
    ...(sale || {})
  });
  const [currentProduct, setCurrentProduct] = useState('');
  const [currentQty, setCurrentQty] = useState(1);
  const [currentPrice, setCurrentPrice] = useState(0);
  const [saleTiming, setSaleTiming] = useState<'immediate' | 'scheduled'>('immediate');
  
  useEffect(() => {
    if (sale) {
        setSaleType(sale.type);
    }
  }, [sale]);

  useEffect(() => {
    if (saleTiming === 'immediate') {
        setFormData(prev => ({...prev, date: getLocalDateString(new Date())}));
    }
  }, [saleTiming]);

  useEffect(() => {
    const total = formData.products.reduce((sum, p) => sum + p.price * p.quantity, 0);
    setFormData(prev => ({ ...prev, totalAmount: total }));
  }, [formData.products]);
  
  const getAvailableStock = useCallback((productId: string): number => {
    const totalInStock = inventory
        .filter(item => item.productId === productId && item.warehouseId === selectedWarehouse)
        .reduce((sum, item) => sum + item.quantity, 0);

    const productInfo = products.find(p => p.id === productId);
    if (!productInfo) return totalInStock;
    
    const originalQtyInThisSale = isEditing 
        ? sale.products.find(p => p.name === productInfo.name)?.quantity || 0
        : 0;

    const qtyInCart = formData.products
        .filter(p => p.name === productInfo.name)
        .reduce((sum, p) => sum + p.quantity, 0);
    
    return totalInStock + originalQtyInThisSale - qtyInCart;
  }, [inventory, products, formData.products, sale, isEditing, selectedWarehouse]);

  const handleProductSelect = (productId: string) => {
    setCurrentProduct(productId);
    const product = products.find(p => p.id === productId);
    if(product) {
        const price = saleType === 'Wholesale' ? product.defaultPrice * 0.8 : product.defaultPrice;
        setCurrentPrice(price);
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleAddProduct = () => {
    const product = products.find(p => p.id === currentProduct);
    if (!product || currentQty <= 0) return;
    
    const availableStock = getAvailableStock(product.id);
    if (currentQty > availableStock) {
        alert(`Not enough stock for ${product.name}. Only ${availableStock} available in selected warehouse.`);
        return;
    }

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
    if(!selectedWarehouse) {
        alert("Please select a warehouse.");
        return;
    }
    onSave(formData, saleType);
  };
  
  const retailProducts = products.filter(p => !p.name.toLowerCase().includes('monthly'));

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
        <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Warehouse *</label>
            <select 
                value={selectedWarehouse} 
                onChange={(e) => onWarehouseChange(e.target.value)} 
                className="w-full bg-gray-800/50 border border-white/20 rounded-md p-2 text-gray-200"
                required
            >
                <option value="">Select Warehouse</option>
                {warehouses.map(w => (
                    <option key={w.id} value={w.id}>{w.name} - {w.location}</option>
                ))}
            </select>
        </div>

        <div className="flex justify-center p-1 bg-gray-800/50 rounded-lg">
            <Button 
                type="button" 
                onClick={() => setSaleType('Retail')} 
                className={`w-1/2 !shadow-none transition-colors duration-200 ${
                    saleType === 'Retail' 
                    ? 'bg-emerald-600 text-white' 
                    : 'bg-transparent text-gray-300 hover:bg-gray-700'
                }`}
            >
                Retail
            </Button>
            <Button 
                type="button" 
                onClick={() => setSaleType('Wholesale')} 
                className={`w-1/2 !shadow-none transition-colors duration-200 ${
                    saleType === 'Wholesale' 
                    ? 'bg-emerald-600 text-white' 
                    : 'bg-transparent text-gray-300 hover:bg-gray-700'
                }`}
            >
                Wholesale
            </Button>
        </div>

        {saleType === 'Retail' ? (
             <input type="text" name="customerName" value={formData.customerName} onChange={handleChange} placeholder="Customer Name" className="w-full bg-gray-800/50 border border-white/20 rounded-md p-2 text-gray-200" required />
        ) : (
            <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input type="text" name="shopName" value={formData.shopName} onChange={handleChange} placeholder="Shop Name" className="w-full bg-gray-800/50 border border-white/20 rounded-md p-2 text-gray-200" required />
                    <input type="tel" name="contact" value={formData.contact} onChange={handleChange} placeholder="Contact Number" className="w-full bg-gray-800/50 border border-white/20 rounded-md p-2 text-gray-200" required />
                </div>
                <input type="text" name="address" value={formData.address} onChange={handleChange} placeholder="Address" className="w-full bg-gray-800/50 border border-white/20 rounded-md p-2 text-gray-200" required />
            </div>
        )}
        
        <div className="border-t border-b border-white/10 py-4">
            <h4 className="font-semibold text-gray-200 mb-2">Products</h4>
            <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
    {formData.products.map((p, index) => {
        console.log('Product in list:', p); // DEBUG
        const displayName = p.name || 'Unknown Product';
        return (
            <div key={index} className="flex justify-between items-center bg-gray-800/50 p-2 rounded">
                <span>{p.quantity} x {displayName} @ ₹{p.price}</span>
                <Button type="button" variant="ghost" className="!p-1 !text-red-400" onClick={() => handleRemoveProduct(index)}>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </Button>
            </div>
        );
    })}
</div>
            <div className="grid grid-cols-1 md:grid-cols-6 items-end gap-2 mt-3">
                 <div className="md:col-span-3">
                    <label className="text-xs text-gray-400">Product</label>
                    <select value={currentProduct} onChange={e => handleProductSelect(e.target.value)} className="w-full bg-gray-700/50 border border-white/20 rounded-md p-2 text-gray-200" disabled={!selectedWarehouse}>
                        <option value="">Select a product</option>
                        {retailProducts.map(p => <option key={p.id} value={p.id}>{p.name} ({getAvailableStock(p.id)} available)</option>)}
                    </select>
                 </div>
                <div>
                    <label className="text-xs text-gray-400">Price</label>
                    <input type="number" value={currentPrice} onChange={e => setCurrentPrice(parseFloat(e.target.value))} min="0" step="0.01" className="w-full bg-gray-700/50 border border-white/20 rounded-md p-2 text-gray-200" />
                </div>
                 <div>
                    <label className="text-xs text-gray-400">Qty</label>
                    <input type="number" value={currentQty} onChange={e => setCurrentQty(parseInt(e.target.value))} min="1" className="w-full bg-gray-700/50 border border-white/20 rounded-md p-2 text-gray-200" />
                </div>
                 <Button type="button" variant="secondary" onClick={handleAddProduct} className="w-full h-10" disabled={!selectedWarehouse}>Add</Button>
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Sale Timing</label>
                <select value={saleTiming} onChange={(e) => setSaleTiming(e.target.value as any)} className="w-full bg-gray-800/50 border border-white/20 rounded-md p-2 text-gray-200">
                    <option value="immediate">Immediate Sale</option>
                    <option value="scheduled">Scheduled Sale</option>
                </select>
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Date</label>
                <input type="date" name="date" value={formData.date} onChange={handleChange} disabled={saleTiming === 'immediate'} className="w-full bg-gray-800/50 border border-white/20 rounded-md p-2 text-gray-200 disabled:opacity-50" required />
            </div>
        </div>

        <div className="grid grid-cols-1">
             <select name="status" value={formData.status} onChange={handleChange} className="w-full bg-gray-800/50 border border-white/20 rounded-md p-2 text-gray-200">
                <option value="Cash">Cash</option>
                <option value="GPay">GPay</option>
                <option value="Paid">Paid (Bank/Other)</option>
                <option value="Unpaid">Unpaid</option>
                <option value="Free">Free Sample</option>
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

const Sales: React.FC = () => {
    const [sales, setSales] = useState<CombinedSale[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [inventory, setInventory] = useState<InventoryItem[]>([]);
    const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
    const [selectedWarehouse, setSelectedWarehouse] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [selectedSale, setSelectedSale] = useState<CombinedSale | null>(null);
    const [saleToDelete, setSaleToDelete] = useState<{id: string, type: 'Retail' | 'Wholesale'} | null>(null);
    const [isExporting, setIsExporting] = useState(false);
    const [isExportingCSV, setIsExportingCSV] = useState(false);

     
    const EditIcon = () => (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L15.232 5.232z" />
        </svg>
    );
    const DeleteIcon = () => (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
    );

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [salesData, wholesaleData, productsData, inventoryData, warehousesData] = await Promise.all([
                getSales(), 
                getWholesaleSales(), 
                getProducts(), 
                getInventory(), 
                getWarehouses()
            ]);
            const combined = [
                ...salesData.map(s => ({ ...s, type: 'Retail' as const })),
                ...wholesaleData.map(w => ({ ...w, type: 'Wholesale' as const }))
            ];
            setSales(combined.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
            setProducts(productsData);
            setInventory(inventoryData);
            setWarehouses(warehousesData);
            
            if (!selectedWarehouse && warehousesData.length > 0) {
                setSelectedWarehouse(warehousesData[0].id);
            }
        } catch (err) {
            console.error(err);
            setError("Failed to fetch sales data.");
        } finally {
            setLoading(false);
        }
    }, [selectedWarehouse]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

   const handleSave = async (saleData: any, saleType: 'Retail' | 'Wholesale') => {
     if (!selectedWarehouse) {
        alert("Please select a warehouse before saving.");
        return; // Prevent proceeding without valid warehouse
      }

    console.log('==========================================');
    console.log('handleSave CALLED');
    console.log('saleData:', JSON.stringify(saleData, null, 2));
    console.log('saleType:', saleType);
    console.log('selectedWarehouse:', selectedWarehouse);
    console.log('==========================================');
    
    try {
        const isEditing = !!saleData.id;
        console.log('isEditing:', isEditing);
      
      
        
        const payload = {
            ...(isEditing ? { id: saleData.id } : {}),
            customerName: saleData.customerName,
            shopName: saleData.shopName,
            contact: saleData.contact,
            address: saleData.address,
            date: saleData.date,
            status: saleData.status,
            totalAmount: saleData.totalAmount,
            warehouseId: selectedWarehouse,
            products: saleData.products.map((p: SaleProduct) => {
                const product = products.find(prod => prod.name === p.name);
                console.log(`Mapping product: ${p.name} -> productId: ${product?.id}`);
                return { 
                    productId: product ? product.id : null, 
                    quantity: p.quantity, 
                    price: p.price 
                };
            }).filter((p: { productId: string | null}) => p.productId)
        };

        console.log('Final payload:', JSON.stringify(payload, null, 2));
        console.log('Calling API...');

        if (saleType === 'Retail') {
            if (isEditing) {
                console.log('Calling updateSale...');
                const result = await updateSale(payload);
                console.log('updateSale result:', result);
            } else {
                console.log('Calling addSale...');
                const result = await addSale(payload);
                console.log('addSale result:', result);
            }
        } else {
            if (isEditing) {
                console.log('Calling updateWholesaleSale...');
                const result = await updateWholesaleSale(payload);
                console.log('updateWholesaleSale result:', result);
            } else {
                console.log('Calling addWholesaleSale...');
                const result = await addWholesaleSale(payload);
                console.log('addWholesaleSale result:', result);
            }
        }

        console.log('API call successful, refreshing data...');
        await fetchData();
        console.log('Data refreshed');
        
        setIsModalOpen(false);
        setSelectedSale(null);
        console.log('Modal closed, sale cleared');
        
    } catch (err: any) {
        console.error('==========================================');
        console.error('ERROR in handleSave:');
        console.error('Error object:', err);
        console.error('Error message:', err.message);
        console.error('==========================================');
        alert(`Failed to save sale: ${err.message || 'Unknown error'}`);
    }
};



    const handleDelete = async () => {
        if (!saleToDelete) return;
        try {
            if (saleToDelete.type === 'Retail') {
                await deleteSale(saleToDelete.id);
            } else {
                await deleteWholesaleSale(saleToDelete.id);
            }
            fetchData();
        } catch (err) {
            console.error(err);
            alert("Failed to delete sale.");
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
            alert("PDF generation libraries not loaded.");
            setIsExporting(false);
            return;
        }
    
        try {
          const { jsPDF } = jspdf;
          const doc = new jsPDF();
    
          doc.setFontSize(18);
          doc.text("SHROOMMUSH - Sales Report", 14, 22);
    
          autoTable(doc, {
            startY: 40,
            head: [['Date', 'Type', 'Invoice #', 'Customer/Shop', 'Total', 'Status']],
            body: sales.map(s => [
                s.date,
                s.type,
                s.invoiceNumber,
                s.type === 'Retail' ? s.customerName : s.shopName,
                formatCurrency(s.totalAmount),
                s.status,
            ]),
            headStyles: { fillColor: [34, 197, 94] },
          });
    
          doc.save('sales-report.pdf');
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
            const flattenedData = sales.flatMap(sale => 
                sale.products.map(product => ({
                    date: sale.date,
                    type: sale.type,
                    invoiceNumber: sale.invoiceNumber,
                    customerOrShop: sale.type === 'Retail' ? sale.customerName : sale.shopName,
                    status: sale.status,
                    productName: product.name,
                    quantity: product.quantity,
                    pricePerUnit: product.price,
                    lineTotal: product.quantity * product.price
                }))
            );
            exportToCSV(flattenedData, 'all-sales.csv');
        } catch (error) {
            console.error("Error exporting CSV:", error);
            alert("An error occurred while generating the CSV.");
        } finally {
            setIsExportingCSV(false);
        }
    };

    const openDeleteConfirm = (id: string, type: 'Retail' | 'Wholesale') => {
        setSaleToDelete({id, type});
        setIsConfirmOpen(true);
    };

    const formatCurrency = (value: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(value);
    
    const getStatusBadge = (status: SaleStatus) => {
        switch (status) {
          case 'Paid': case 'GPay': case 'Cash': return 'bg-emerald-500/20 text-emerald-300';
          case 'Unpaid': return 'bg-yellow-500/20 text-yellow-300';
          case 'Free': return 'bg-blue-500/20 text-blue-300';
          default: return 'bg-gray-500/20 text-gray-300';
        }
    };

    if (loading) return <LoadingSpinner />;
    if (error) return <ApiError onRetry={fetchData} message={error} />;

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-green-500">All Sales</h1>
                <div className="flex items-center space-x-2">
                    <Button onClick={handleExportCSV} variant="secondary" disabled={isExportingCSV}>
                        {isExportingCSV ? 'Exporting...' : 'Export as CSV'}
                    </Button>
                    <Button onClick={handleExportPDF} variant="secondary" disabled={isExporting}>
                        {isExporting ? 'Exporting...' : 'Export as PDF'}
                    </Button>
                    <Button onClick={() => { setSelectedSale(null); setIsModalOpen(true); }}>Add Sale</Button>
                </div>
            </div>

            <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-xl shadow-lg overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full text-sm text-left text-gray-300">
    <thead className="bg-white/5 uppercase text-xs">
        <tr>
            <th scope="col" className="px-6 py-3">Date</th>
            <th scope="col" className="px-6 py-3">Invoice #</th>
            <th scope="col" className="px-6 py-3">Customer/Shop</th>
            <th scope="col" className="px-6 py-3">Products</th> {/* NEW */}
            <th scope="col" className="px-6 py-3">Type</th>
            <th scope="col" className="px-6 py-3">Total</th>
            <th scope="col" className="px-6 py-3">Status</th>
            <th scope="col" className="px-6 py-3 text-right">Actions</th>
        </tr>
    </thead>
    <tbody>
        {sales.map(s => (
            <tr key={s.id} className="border-b border-white/10 hover:bg-white/5 transition-colors">
                <td className="px-6 py-4">{s.date}</td>
                <td className="px-6 py-4 font-mono text-xs">{s.invoiceNumber}</td>
                <td className="px-6 py-4 font-medium text-white">
                    {s.type === 'Retail' ? s.customerName : s.shopName}
                </td>
                <td className="px-6 py-4"> {/* NEW */}
                    <div className="text-xs text-gray-400 max-w-xs">
                        {s.products && s.products.length > 0 
                            ? s.products.map((p, i) => (
                                <span key={i}>
                                    {p.quantity}x {p.name}
                                    {i < s.products.length - 1 && ', '}
                                </span>
                            ))
                            : 'N/A'}
                    </div>
                </td>
                <td className="px-6 py-4">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                        s.type === 'Retail' 
                            ? 'bg-blue-500/20 text-blue-300' 
                            : 'bg-purple-500/20 text-purple-300'
                    }`}>
                        {s.type}
                    </span>
                </td>
                <td className="px-6 py-4">{formatCurrency(s.totalAmount)}</td>
                <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusBadge(s.status)}`}>
                        {s.status}
                    </span>
                </td>
                <td className="px-6 py-4 text-right space-x-2">
                    <Button variant="ghost" className="!p-2" onClick={() => { setSelectedSale(s); setIsModalOpen(true); }}>
                        <EditIcon />
                    </Button>
                    <Button
  variant="ghost"
  className="!p-2"
  onClick={() => {
    setSelectedSale(s);
    setSelectedWarehouse(s.warehouseId || ''); // Set warehouseId here, fallback to empty string if null
    setIsModalOpen(true);
  }}
>

                        <DeleteIcon />
                    </Button>
                </td>
            </tr>
        ))}
    </tbody>
</table>

                </div>
            </div>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={selectedSale ? `Edit ${selectedSale.type} Sale` : 'Add Sale'}>
                <SaleForm 
                    sale={selectedSale} 
                    products={products} 
                    inventory={inventory} 
                    warehouses={warehouses}
                    selectedWarehouse={selectedWarehouse}
                    onWarehouseChange={setSelectedWarehouse}
                    onSave={handleSave} 
                    onCancel={() => { setIsModalOpen(false); setSelectedSale(null); }} 
                />
            </Modal>

            <ConfirmModal isOpen={isConfirmOpen} onClose={() => setIsConfirmOpen(false)} onConfirm={handleDelete} title="Delete Sale" message="Are you sure you want to delete this sale record?" />
        </div>
    );
};

export default Sales;
