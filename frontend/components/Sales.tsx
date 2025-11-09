import React, { useState, useEffect, useCallback } from 'react';
import { getSales, addSale, updateSale, deleteSale, getProducts, getWholesaleSales, addWholesaleSale, updateWholesaleSale, deleteWholesaleSale, getWarehouses } from '../services/api';
import { Sale, Product, SaleProduct, SaleStatus, WholesaleSale, Warehouse } from '../types';
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

const Sales: React.FC = () => {
  const [sales, setSales] = useState<CombinedSale[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSale, setEditingSale] = useState<CombinedSale | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [saleToDelete, setSaleToDelete] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'retail' | 'wholesale'>('retail');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [retailSales, wholesaleSales, productsData, warehousesData] = await Promise.all([
        getSales(),
        getWholesaleSales(),
        getProducts(),
        getWarehouses()
      ]);
      
      const combinedSales: CombinedSale[] = [
        ...retailSales.map(s => ({ ...s, type: 'Retail' as const })),
        ...wholesaleSales.map(s => ({ ...s, type: 'Wholesale' as const }))
      ];
      
      setSales(combinedSales);
      setProducts(productsData);
      setWarehouses(warehousesData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAddSale = () => {
    setEditingSale(null);
    setModalOpen(true);
  };

  const handleEditSale = (sale: CombinedSale) => {
    setEditingSale(sale);
    setModalOpen(true);
  };

  const handleDeleteClick = (id: string) => {
    setSaleToDelete(id);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!saleToDelete) return;
    
    try {
      const sale = sales.find(s => s.id === saleToDelete);
      if (!sale) return;

      if (sale.type === 'Retail') {
        await deleteSale(saleToDelete);
      } else {
        await deleteWholesaleSale(saleToDelete);
      }
      
      await fetchData();
      setDeleteConfirmOpen(false);
      setSaleToDelete(null);
    } catch (err) {
      alert(`Failed to delete sale: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleExport = () => {
    const filteredSales = sales.filter(s => s.type === (activeTab === 'retail' ? 'Retail' : 'Wholesale'));
    const csvData = filteredSales.map(s => ({
      'Date': s.date,
      'Invoice': s.invoiceNumber,
      'Customer/Shop': s.type === 'Retail' ? (s as Sale).customerName : (s as WholesaleSale).shopName,
      'Type': s.type,
      'Total': s.totalAmount,
      'Status': s.status
    }));
    exportToCSV(csvData, `${activeTab}-sales-${new Date().toISOString().split('T')[0]}.csv`);
  };

  const formatCurrency = (amount: number): string => {
    return `₹${amount.toFixed(2)}`;
  };

  const filteredSales = sales.filter(s => s.type === (activeTab === 'retail' ? 'Retail' : 'Wholesale'));

  if (loading) return <LoadingSpinner />;
  if (error) return <ApiError message={error} onRetry={fetchData} />;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Sales Management</h1>
        <div className="flex gap-2">
          <Button onClick={handleExport} variant="secondary">Export CSV</Button>
          <Button onClick={handleAddSale}>Add Sale</Button>
        </div>
      </div>

      <div className="flex gap-4 mb-6">
        <button
          onClick={() => setActiveTab('retail')}
          className={`px-4 py-2 rounded-lg ${activeTab === 'retail' ? 'bg-emerald-600 text-white' : 'bg-gray-200 text-gray-700'}`}
        >
          Retail Sales
        </button>
        <button
          onClick={() => setActiveTab('wholesale')}
          className={`px-4 py-2 rounded-lg ${activeTab === 'wholesale' ? 'bg-emerald-600 text-white' : 'bg-gray-200 text-gray-700'}`}
        >
          Wholesale Sales
        </button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Invoice #</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer/Shop</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredSales.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                  No {activeTab} sales found. Click "Add Sale" to create one.
                </td>
              </tr>
            ) : (
              filteredSales.map(s => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">{s.date}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{s.invoiceNumber}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {s.type === 'Retail' ? (s as Sale).customerName : (s as WholesaleSale).shopName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">{formatCurrency(s.totalAmount)}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      s.status === 'Paid' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {s.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button onClick={() => handleEditSale(s)} className="text-blue-600 hover:text-blue-800 mr-3">Edit</button>
                    <button onClick={() => handleDeleteClick(s.id)} className="text-red-600 hover:text-red-800">Delete</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <SaleFormModal
          sale={editingSale}
          products={products}
          warehouses={warehouses}
          onSave={async (data) => {
            try {
              if (editingSale) {
                if (editingSale.type === 'Retail') {
                  await updateSale({ ...data, id: editingSale.id });
                } else {
                  await updateWholesaleSale({ ...data, id: editingSale.id });
                }
              } else {
                if (activeTab === 'retail') {
                  await addSale(data);
                } else {
                  await addWholesaleSale(data);
                }
              }
              await fetchData();
              setModalOpen(false);
            } catch (err) {
              alert(`Failed to save sale: ${err instanceof Error ? err.message : 'Unknown error'}`);
            }
          }}
          onClose={() => setModalOpen(false)}
          isWholesale={activeTab === 'wholesale'}
        />
      )}

      {deleteConfirmOpen && (
        <ConfirmModal
          message="Are you sure you want to delete this sale?"
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteConfirmOpen(false)}
        />
      )}
    </div>
  );
};

interface SaleFormModalProps {
  sale: CombinedSale | null;
  products: Product[];
  warehouses: Warehouse[];
  onSave: (data: any) => Promise<void>;
  onClose: () => void;
  isWholesale: boolean;
}

const SaleFormModal: React.FC<SaleFormModalProps> = ({ sale, products, warehouses, onSave, onClose, isWholesale }) => {
  const [formData, setFormData] = useState({
    customerName: sale && sale.type === 'Retail' ? (sale as Sale).customerName : '',
    shopName: sale && sale.type === 'Wholesale' ? (sale as WholesaleSale).shopName : '',
    contact: sale && sale.type === 'Wholesale' ? (sale as WholesaleSale).contact : '',
    address: sale && sale.type === 'Wholesale' ? (sale as WholesaleSale).address : '',
    products: sale?.products || [] as SaleProduct[],
    totalAmount: sale?.totalAmount || 0,
    date: sale?.date || getLocalDateString(new Date()),
    status: sale?.status || 'Cash' as SaleStatus,
    warehouseId: warehouses.length > 0 ? warehouses[0].id : ''
  });

  const [currentProduct, setCurrentProduct] = useState('');
  const [currentQty, setCurrentQty] = useState(1);
  const [currentPrice, setCurrentPrice] = useState(0);

  useEffect(() => {
    if (warehouses.length > 0 && !formData.warehouseId) {
      setFormData(prev => ({ ...prev, warehouseId: warehouses[0].id }));
    }
  }, [warehouses, formData.warehouseId]);

  const handleAddProduct = () => {
    if (!currentProduct || currentQty <= 0) return;

    const product = products.find(p => p.id === currentProduct);
    if (!product) return;

    const newProduct: SaleProduct = {
      productId: product.id,
      name: product.name,
      quantity: currentQty,
      price: currentPrice || product.defaultPrice
    };

    setFormData(prev => ({
      ...prev,
      products: [...prev.products, newProduct],
      totalAmount: prev.totalAmount + (newProduct.price * newProduct.quantity)
    }));

    setCurrentProduct('');
    setCurrentQty(1);
    setCurrentPrice(0);
  };

  const handleRemoveProduct = (index: number) => {
    const product = formData.products[index];
    setFormData(prev => ({
      ...prev,
      products: prev.products.filter((_, i) => i !== index),
      totalAmount: prev.totalAmount - (product.price * product.quantity)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('FORM SUBMIT FIRED', formData);
    if (formData.products.length === 0) {
      alert('Please add at least one product');
      return;
    }

    if (!formData.warehouseId) {
      alert('Please select a warehouse');
      return;
    }

    await onSave(formData);
  };

  return (
    <Modal onClose={onClose} title={`${sale ? 'Edit' : 'Add'} ${isWholesale ? 'Wholesale' : 'Retail'} Sale`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {isWholesale ? (
          <>
            <div>
              <label className="block text-sm font-medium mb-1">Shop Name *</label>
              <input
                type="text"
                value={formData.shopName}
                onChange={(e) => setFormData({ ...formData, shopName: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Contact</label>
              <input
                type="text"
                value={formData.contact}
                onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Address</label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
          </>
        ) : (
          <div>
            <label className="block text-sm font-medium mb-1">Customer Name *</label>
            <input
              type="text"
              value={formData.customerName}
              onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
              required
            />
          </div>
        )}

        <div>
          <label className="block text-sm font-medium mb-1">Warehouse *</label>
          <select
            value={formData.warehouseId}
            onChange={(e) => setFormData({ ...formData, warehouseId: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg"
            required
          >
            <option value="">Select Warehouse</option>
            {warehouses.map(wh => (
              <option key={wh.id} value={wh.id}>{wh.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Date *</label>
          <input
            type="date"
            value={formData.date}
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Status *</label>
          <select
            value={formData.status}
            onChange={(e) => setFormData({ ...formData, status: e.target.value as SaleStatus })}
            className="w-full px-3 py-2 border rounded-lg"
            required
          >
            <option value="Cash">Cash</option>
            <option value="GPay">GPay</option>
            <option value="Paid">Paid</option>
            <option value="Unpaid">Unpaid</option>
          </select>
        </div>

        <div className="border-t pt-4">
          <h3 className="font-medium mb-2">Add Products</h3>
          <div className="grid grid-cols-4 gap-2">
            <select
              value={currentProduct}
              onChange={(e) => {
                setCurrentProduct(e.target.value);
                const p = products.find(prod => prod.id === e.target.value);
                if (p) setCurrentPrice(p.defaultPrice);
              }}
              className="px-3 py-2 border rounded-lg"
            >
              <option value="">Select Product</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <input
              type="number"
              value={currentQty}
              onChange={(e) => setCurrentQty(Number(e.target.value))}
              placeholder="Qty"
              className="px-3 py-2 border rounded-lg"
              min="1"
            />
            <input
              type="number"
              value={currentPrice}
              onChange={(e) => setCurrentPrice(Number(e.target.value))}
              placeholder="Price"
              className="px-3 py-2 border rounded-lg"
              min="0"
              step="0.01"
            />
            <Button type="button" onClick={handleAddProduct}>Add</Button>
          </div>
        </div>

        {formData.products.length > 0 && (
          <div className="border-t pt-4">
            <h3 className="font-medium mb-2">Products</h3>
            <ul className="space-y-2">
              {formData.products.map((p, i) => (
                <li key={i} className="flex justify-between items-center bg-gray-50 p-2 rounded">
                  <span>{p.name} - {p.quantity} × ₹{p.price}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveProduct(i)}
                    className="text-red-600"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-2 text-right font-bold">
              Total: ₹{formData.totalAmount.toFixed(2)}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit">Save Sale</Button>
        </div>
      </form>
    </Modal>
  );
};

export default Sales;
