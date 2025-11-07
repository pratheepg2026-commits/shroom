import React, { useState, useEffect, useCallback } from 'react';
import { getProducts, addProduct, updateProduct, deleteProduct } from '../services/api';
import { Product } from '../types';
import { exportToCSV } from '../services/csvExporter';
import Button from './common/Button';
import Modal from './common/Modal';
import ConfirmModal from './common/ConfirmModal';
import ApiError from './common/ApiError';

const LoadingSpinner = () => (
  <div className="flex justify-center items-center h-64">
    <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-emerald-500"></div>
  </div>
);

const ProductForm: React.FC<{
  product: Omit<Product, 'id'> | Product | null;
  onSave: (product: Omit<Product, 'id'> | Product) => void;
  onCancel: () => void;
}> = ({ product, onSave, onCancel }) => {
  const [formData, setFormData] = useState({
    name: '',
    defaultPrice: 0,
    unit: 'box',
    ...product
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: name === 'defaultPrice' ? parseFloat(value) : value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <input type="text" name="name" value={formData.name} onChange={handleChange} placeholder="Product Name" className="w-full bg-gray-800/50 border border-white/20 rounded-md p-2 text-gray-200" required />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <input type="number" name="defaultPrice" value={formData.defaultPrice} min="0" step="0.01" onChange={handleChange} placeholder="Default Price" className="w-full bg-gray-800/50 border border-white/20 rounded-md p-2 text-gray-200" required />
        <input type="text" name="unit" value={formData.unit} onChange={handleChange} placeholder="Unit (e.g., kg, piece)" className="w-full bg-gray-800/50 border border-white/20 rounded-md p-2 text-gray-200" required />
      </div>
      <div className="flex justify-end space-x-2 pt-4">
        <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button type="submit" variant="primary">Save Product</Button>
      </div>
    </form>
  );
};


const Products: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productToDelete, setProductToDelete] = useState<string | null>(null);
  const [isExportingCSV, setIsExportingCSV] = useState(false);

  const formatCurrency = (value: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(value);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getProducts();
      setProducts(data);
    } catch (err) {
      console.error(err);
      setError("Failed to fetch products.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSave = async (productData: Omit<Product, 'id'> | Product) => {
    try {
      if ('id' in productData && productData.id) {
        await updateProduct(productData as Product);
      } else {
        await addProduct(productData);
      }
      fetchData();
      setIsModalOpen(false);
      setSelectedProduct(null);
    } catch (err) {
      console.error(err);
      alert("Failed to save product.");
    }
  };
  
  const handleDelete = async () => {
    if (!productToDelete) return;
    try {
        await deleteProduct(productToDelete);
        fetchData();
    } catch (err) {
        console.error("Failed to delete product", err);
        alert("Failed to delete product.");
    } finally {
        setIsConfirmOpen(false);
        setProductToDelete(null);
    }
  };

  const handleExportCSV = () => {
    setIsExportingCSV(true);
    try {
        const dataToExport = products.map(({ id, ...rest }) => rest);
        exportToCSV(dataToExport, 'products.csv');
    } catch (error) {
        console.error("Error exporting CSV:", error);
        alert("An error occurred while generating the CSV.");
    } finally {
        setIsExportingCSV(false);
    }
  };

  const openDeleteConfirm = (id: string) => {
    setProductToDelete(id);
    setIsConfirmOpen(true);
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <ApiError onRetry={fetchData} />;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-green-500">Products</h1>
        <div className="flex items-center space-x-2">
            <Button onClick={handleExportCSV} variant="secondary" disabled={isExportingCSV}>
                {isExportingCSV ? 'Exporting...' : 'Export as CSV'}
            </Button>
            <Button onClick={() => { setSelectedProduct(null); setIsModalOpen(true); }}>Add Product</Button>
        </div>
      </div>
      
      <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-xl shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm text-left text-gray-300">
            <thead className="bg-white/5 uppercase text-xs">
              <tr>
                <th scope="col" className="px-6 py-3">Product Name</th>
                <th scope="col" className="px-6 py-3">Default Price</th>
                <th scope="col" className="px-6 py-3">Unit</th>
                <th scope="col" className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map(product => (
                <tr key={product.id} className="border-b border-white/10 hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4 font-medium text-white">{product.name}</td>
                  <td className="px-6 py-4">{formatCurrency(product.defaultPrice)}</td>
                  <td className="px-6 py-4">{product.unit}</td>
                  <td className="px-6 py-4 text-right space-x-2">
                    <Button variant="ghost" onClick={() => { setSelectedProduct(product); setIsModalOpen(true); }}>Edit</Button>
                    <Button variant="ghost" className="text-red-400 hover:bg-red-500/10" onClick={() => openDeleteConfirm(product.id)}>Delete</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={selectedProduct ? 'Edit Product' : 'Add Product'}>
        <ProductForm 
          product={selectedProduct} 
          onSave={handleSave} 
          onCancel={() => { setIsModalOpen(false); setSelectedProduct(null); }} 
        />
      </Modal>

      <ConfirmModal
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={handleDelete}
        title="Delete Product"
        message="Are you sure you want to delete this product? This will not affect past sales records but may affect new entries."
      />

    </div>
  );
};

export default Products;