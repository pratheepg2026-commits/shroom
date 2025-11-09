import React, { useState, useEffect, useCallback } from 'react';
import { getSales, addSale, updateSale, deleteSale, getProducts, getInventory, getWholesaleSales, addWholesaleSale, updateWholesaleSale, deleteWholesaleSale, getWarehouses } from '../services/api';
import { Sale, Product, SaleProduct, InventoryItem, SaleStatus, WholesaleSale } from '../types';
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
  warehouses: { id: string; name: string }[];
  onSave: (saleData: any, saleType: 'Retail' | 'Wholesale') => void;
  onCancel: () => void;
}> = ({ sale, products, inventory, warehouses, onSave, onCancel }) => {
  const isEditing = sale !== null;
  const initialType = isEditing ? sale.type : 'Retail';

  const [saleType, setSaleType] = useState<'Retail' | 'Wholesale'>(initialType);

  const [formData, setFormData] = useState({
    customerName: '',
    shopName: '',
    contact: '',
    address: '',
    warehouseId: warehouses.length > 0 ? warehouses[0].id : '',
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
      setFormData(prev => ({ ...prev, date: getLocalDateString(new Date()) }));
    }
  }, [saleTiming]);

  useEffect(() => {
    const total = formData.products.reduce((sum, p) => sum + p.price * p.quantity, 0);
    setFormData(prev => ({ ...prev, totalAmount: total }));
  }, [formData.products]);

  const getAvailableStock = useCallback((productId: string): number => {
    const totalInStock = inventory
      .filter(item => item.productId === productId)
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
  }, [inventory, products, formData.products, sale, isEditing]);

  const handleProductSelect = (productId: string) => {
    setCurrentProduct(productId);
    const product = products.find(p => p.id === productId);
    if (product) {
      const price = saleType === 'Wholesale' ? product.defaultPrice * 0.8 : product.defaultPrice;
      setCurrentPrice(price);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleAddProduct = () => {
    const product = products.find(p => p.id === currentProduct);
    if (!product || currentQty <= 0) return;

    const availableStock = getAvailableStock(product.id);
    if (currentQty > availableStock) {
      alert(`Not enough stock for ${product.name}. Only ${availableStock} available.`);
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
    if (formData.products.length === 0) {
      alert("Please add at least one product to the sale.");
      return;
    }
    if (!formData.warehouseId) {
      alert("Please select a warehouse.");
      return;
    }
    onSave(formData, saleType);
  };

  const retailProducts = products.filter(p => !p.name.toLowerCase().includes('monthly'));

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex justify-center p-1 bg-gray-800/50 rounded-lg">
        <Button
          type="button"
          onClick={() => setSaleType('Retail')}
          className={`w-1/2 !shadow-none transition-colors duration-200 ${
            saleType === 'Retail' ? 'bg-emerald-600 text-white' : 'bg-transparent text-gray-300 hover:bg-gray-700'
          }`}
        >
          Retail
        </Button>
        <Button
          type="button"
          onClick={() => setSaleType('Wholesale')}
          className={`w-1/2 !shadow-none transition-colors duration-200 ${
            saleType === 'Wholesale' ? 'bg-emerald-600 text-white' : 'bg-transparent text-gray-300 hover:bg-gray-700'
          }`}
        >
          Wholesale
        </Button>
      </div>

      {saleType === 'Retail' ? (
        <input
          type="text"
          name="customerName"
          value={formData.customerName}
          onChange={handleChange}
          placeholder="Customer Name"
          className="w-full bg-gray-800/50 border border-white/20 rounded-md p-2 text-gray-200"
          required
        />
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              type="text"
              name="shopName"
              value={formData.shopName}
              onChange={handleChange}
              placeholder="Shop Name"
              className="w-full bg-gray-800/50 border border-white/20 rounded-md p-2 text-gray-200"
              required
            />
            <input
              type="tel"
              name="contact"
              value={formData.contact}
              onChange={handleChange}
              placeholder="Contact Number"
              className="w-full bg-gray-800/50 border border-white/20 rounded-md p-2 text-gray-200"
              required
            />
          </div>
          <input
            type="text"
            name="address"
            value={formData.address}
            onChange={handleChange}
            placeholder="Address"
            className="w-full bg-gray-800/50 border border-white/20 rounded-md p-2 text-gray-200"
            required
          />
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-400 mb-1">Warehouse *</label>
        <select
          name="warehouseId"
          value={formData.warehouseId}
          onChange={handleChange}
          className="w-full bg-gray-800/50 border border-white/20 rounded-md p-2 text-gray-200"
          required
        >
          <option value="">Select Warehouse</option>
          {warehouses.map(w => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
      </div>

      <div className="border-t border-b border-white/10 py-4">
        <h4 className="font-semibold text-gray-200 mb-2">Products</h4>
        <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
          {formData.products.map((p, index) => (
            <div key={index} className="flex justify-between items-center bg-gray-800/50 p-2 rounded">
              <span>
                {p.quantity} x {p.name} @ {p.price}
              </span>
              <Button type="button" variant="ghost" className="!p-1 !text-red-400" onClick={() => handleRemoveProduct(index)}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </Button>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-6 items-end gap-2 mt-3">
          <div className="md:col-span-3">
            <label className="text-xs text-gray-400">Product</label>
            <select value={currentProduct} onChange={e => handleProductSelect(e.target.value)} className="w-full bg-gray-700/50 border border-white/20 rounded-md p-2 text-gray-200">
              <option value="">Select a product</option>
              {retailProducts.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} ({getAvailableStock(p.id)} available)
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-400">Price</label>
            <input
              type="number"
              value={currentPrice}
              onChange={e => setCurrentPrice(parseFloat(e.target.value))}
              min="0"
              step="0.01"
              className="w-full bg-gray-700/50 border border-white/20 rounded-md p-2 text-gray-200"
            />
          </div>
          <div>
            <label className="text-xs text-gray-400">Qty</label>
            <input
              type="number"
              value={currentQty}
              onChange={e => setCurrentQty(parseInt(e.target.value))}
              min="1"
              className="w-full bg-gray-700/50 border border-white/20 rounded-md p-2 text-gray-200"
            />
          </div>
          <Button type="button" variant="secondary" onClick={handleAddProduct} className="w-full h-10">
            Add
          </Button>
        </div>
      </div>

      {/* other form fields like saleTiming, date and status */}

      <div className="text-right text-xl font-bold text-white">
        Total: {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(formData.totalAmount)}
      </div>
      <div className="flex justify-end space-x-2 pt-4">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="primary">
          Save Sale
        </Button>
      </div>
    </form>
  );
};

const Sales: React.FC = () => {
  console.log('Sales component rendered');  // Add this temporarily
  const [sales, setSales] = useState<CombinedSale[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [warehouses, setWarehouses] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [selectedSale, setSelectedSale] = useState<CombinedSale | null>(null);
  const [saleToDelete, setSaleToDelete] = useState<{ id: string; type: 'Retail' | 'Wholesale' } | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingCSV, setIsExportingCSV] = useState(false);

  const fetchData = useCallback(async () => {
    console.log('fetchData called');
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
    } catch (err) {
      console.error(err);
      setError("Failed to fetch sales data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    console.log('useEffect triggered fetchData');
    fetchData();
  }, [fetchData]);

  const handleSave = async (saleData: any, saleType: 'Retail' | 'Wholesale') => {
    try {
      const payload = {
        ...saleData,
        products: saleData.products
          .map((p: SaleProduct) => {
            const product = products.find(prod => prod.name === p.name);
            return { productId: product ? product.id : null, quantity: p.quantity, price: p.price };
          })
          .filter((p: { productId: string | null }) => p.productId)
      };

      const isEditing = saleData.id;

      if (saleType === 'Retail') {
        if (isEditing) await updateSale(payload);
        else await addSale(payload);
      } else {
        if (isEditing) await updateWholesaleSale(payload);
        else await addWholesaleSale(payload);
      }

      fetchData();
      setIsModalOpen(false);
      setSelectedSale(null);
    } catch (err) {
      console.error(err);
      alert("Failed to save sale.");
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

  // Other handlers omitted for brevity (export, openDeleteConfirm, etc.)

  if (loading) return <LoadingSpinner />;
  if (error) return <ApiError onRetry={fetchData} />;

  return (
    <div>
      {/* Header and action buttons */}

      {/* Sales Table */}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={selectedSale ? `Edit ${selectedSale.type} Sale` : 'Add Sale'}>
        <SaleForm
          sale={selectedSale}
          products={products}
          inventory={inventory}
          warehouses={warehouses}
          onSave={handleSave}
          onCancel={() => {
            setIsModalOpen(false);
            setSelectedSale(null);
          }}
        />
      </Modal>

      <ConfirmModal
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={handleDelete}
        title="Delete Sale"
        message="Are you sure you want to delete this sale record?"
      />
    </div>
  );
};

export default Sales;
