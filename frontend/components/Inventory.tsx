// Fix: Removed extraneous file markers that were causing syntax errors.
import React, { useState, useEffect, useCallback } from 'react';
import { getInventory, addStock, getWarehouses, addWarehouse, deleteWarehouse, getProducts, updateWarehouse } from '../services/api';
import { InventoryItem, Warehouse, Product } from '../types';
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

const AddStockForm: React.FC<{
    warehouses: Warehouse[];
    products: Product[];
    onSave: (data: { productId: string; warehouseId: string; quantity: number }) => void;
    onCancel: () => void;
}> = ({ warehouses, products, onSave, onCancel }) => {
    const [productId, setProductId] = useState('');
    const [warehouseId, setWarehouseId] = useState('');
    const [quantity, setQuantity] = useState(1);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!productId || !warehouseId || quantity <= 0) {
            alert("Please fill all fields and enter a valid quantity.");
            return;
        }
        onSave({ productId, warehouseId, quantity });
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <select value={productId} onChange={e => setProductId(e.target.value)} className="w-full bg-gray-800/50 border border-white/20 rounded-md p-2 text-gray-200" required>
                <option value="">Select Product</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select value={warehouseId} onChange={e => setWarehouseId(e.target.value)} className="w-full bg-gray-800/50 border border-white/20 rounded-md p-2 text-gray-200" required>
                <option value="">Select Warehouse</option>
                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
            <input type="number" min="1" value={quantity} onChange={e => setQuantity(parseInt(e.target.value))} placeholder="Quantity" className="w-full bg-gray-800/50 border border-white/20 rounded-md p-2 text-gray-200" required />
            <div className="flex justify-end space-x-2 pt-4">
                <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
                <Button type="submit">Add Stock</Button>
            </div>
        </form>
    );
};

const [isEditModalOpen, setIsEditModalOpen] = useState(false);
const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

const handleEdit = (item: InventoryItem) => {
  setSelectedItem(item);
  setIsEditModalOpen(true);
};

const handleDelete = async (id: string) => {
  try {
    await deleteInventory(id);
    fetchData(); // Refresh list
  } catch (err) {
    alert('Failed to delete inventory item');
  }
};

// In your table:
<td className="px-6 py-4 text-right space-x-2">
  <Button 
    variant="ghost" 
    className="!p-2" 
    onClick={() => handleEdit(item)}
  >
    ✏️ Edit
  </Button>
  <Button 
    variant="ghost" 
    className="!p-2 text-red-400" 
    onClick={() => {
      setSelectedItem(item);
      setIsDeleteModalOpen(true);
    }}
  >
    🗑️ Delete
  </Button>
</td>

const WarehouseForm: React.FC<{
    warehouse?: Warehouse | null;
    onSave: (warehouse: Warehouse | Omit<Warehouse, 'id'>) => void;
    onCancel: () => void;
}> = ({ warehouse, onSave, onCancel }) => {
    const [name, setName] = useState(warehouse ? warehouse.name : '');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) {
            alert("Warehouse name cannot be empty.");
            return;
        }
        if (warehouse) {
            onSave({ ...warehouse, name: name.trim() });
        } else {
            onSave({ name: name.trim() });
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Warehouse Name" className="w-full bg-gray-800/50 border border-white/20 rounded-md p-2 text-gray-200" required />
            <div className="flex justify-end space-x-2 pt-4">
                <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
                <Button type="submit">Save Warehouse</Button>
            </div>
        </form>
    );
};

const Inventory: React.FC = () => {
    const [inventory, setInventory] = useState<InventoryItem[]>([]);
    const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [isStockModalOpen, setStockModalOpen] = useState(false);
    const [isWarehouseModalOpen, setWarehouseModalOpen] = useState(false);
    const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(null);
    const [isConfirmOpen, setConfirmOpen] = useState(false);
    const [warehouseToDelete, setWarehouseToDelete] = useState<string | null>(null);
    const [isExportingCSV, setIsExportingCSV] = useState(false);

    const EditIcon = () => (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L15.232 5.232z" />
        </svg>
    );

    const DeleteIcon = () => (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
    );


    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [invData, whData, prodData] = await Promise.all([getInventory(), getWarehouses(), getProducts()]);
            setInventory(invData);
            setWarehouses(whData);
            setProducts(prodData);
        } catch (err) {
            console.error(err);
            setError("Failed to fetch inventory data.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

   const handleAddStock = async (data: { productId: string; warehouseId: string; quantity: number }) => {
  try {
    await addStock(data); // ✅ Changed function name
    await fetchData();
    setStockModalOpen(false);
  } catch (err) {
    console.error(err);
    alert('Failed to add stock.');
  }
};
    const handleSaveWarehouse = async (warehouse: Warehouse | Omit<Warehouse, 'id'>) => {
        try {
            if ('id' in warehouse) {
                await updateWarehouse(warehouse);
            } else {
                await addWarehouse(warehouse);
            }
            fetchData();
            setWarehouseModalOpen(false);
            setEditingWarehouse(null);
        } catch (err) {
            console.error(err);
            alert("Failed to save warehouse.");
        }
    };
    
    const handleDeleteWarehouse = async () => {
        if (!warehouseToDelete) return;
        try {
            await deleteWarehouse(warehouseToDelete);
            fetchData();
        } catch (err) {
            const error = err as Error;
            console.error("Failed to delete warehouse", error);
            alert(`Failed to delete warehouse: ${error.message}`);
        } finally {
            setConfirmOpen(false);
            setWarehouseToDelete(null);
        }
    };
    
    const handleExportCSV = () => {
        setIsExportingCSV(true);
        try {
            const dataToExport = inventory.map(item => ({
                productName: item.productName,
                warehouseName: item.warehouseName,
                quantity: item.quantity
            }));
            exportToCSV(dataToExport, 'inventory-stock.csv');
        } catch (error) {
            console.error("Error exporting CSV:", error);
            alert("An error occurred while generating the CSV.");
        } finally {
            setIsExportingCSV(false);
        }
    };

    const openDeleteConfirm = (id: string) => {
        setWarehouseToDelete(id);
        setConfirmOpen(true);
    };

    const openWarehouseModal = (warehouse: Warehouse | null) => {
        setEditingWarehouse(warehouse);
        setWarehouseModalOpen(true);
    };
    
    const isWarehouseEmpty = (warehouseId: string): boolean => {
        return !inventory.some(item => item.warehouseId === warehouseId && item.quantity > 0);
    }

    if (loading) return <LoadingSpinner />;
    if (error) return <ApiError onRetry={fetchData} />;

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-green-500">Inventory Management</h1>
                <Button onClick={() => setStockModalOpen(true)}>Add Stock</Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2 bg-black/20 backdrop-blur-md border border-white/10 rounded-xl shadow-lg overflow-hidden">
                    <div className="flex justify-between items-center p-4 border-b border-white/10">
                        <h2 className="text-xl font-bold text-white">Current Stock</h2>
                        <Button onClick={handleExportCSV} variant="secondary" disabled={isExportingCSV}>
                            {isExportingCSV ? 'Exporting...' : 'Export as CSV'}
                        </Button>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm text-left text-gray-300">
                            <thead className="bg-white/5 uppercase text-xs">
                                <tr>
                                    <th scope="col" className="px-6 py-3">Product</th>
                                    <th scope="col" className="px-6 py-3">Warehouse</th>
                                    <th scope="col" className="px-6 py-3 text-right">Quantity</th>
                                </tr>
                            </thead>
                            <tbody>
                                {inventory.map(item => (
                                    <tr key={item.id} className="border-b border-white/10 hover:bg-white/5 transition-colors">
                                        <td className="px-6 py-4 font-medium text-white">{item.productName}</td>
                                        <td className="px-6 py-4">{item.warehouseName}</td>
                                        <td className="px-6 py-4 text-right font-semibold">{item.quantity}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
                <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-xl shadow-lg p-4">
                    <div className="flex justify-between items-center mb-3">
                        <h2 className="text-xl font-bold text-white">Warehouses</h2>
                        <Button variant="secondary" onClick={() => openWarehouseModal(null)}>Add</Button>
                    </div>
                    <ul className="space-y-2">
                        {warehouses.map(w => {
                            const isEmpty = isWarehouseEmpty(w.id);
                            return (
                                <li key={w.id} className="flex justify-between items-center bg-gray-800/50 p-2 rounded">
                                    <span className="text-gray-200">{w.name}</span>
                                    <div className="space-x-1 flex items-center">
                                        <Button variant="ghost" className="!p-1" onClick={() => openWarehouseModal(w)}>
                                            <EditIcon />
                                        </Button>
                                        <div className="relative group">
                                            <Button 
                                                variant="ghost" 
                                                className="!p-1 !text-red-400 disabled:!text-gray-500" 
                                                onClick={() => openDeleteConfirm(w.id)}
                                                disabled={!isEmpty}
                                            >
                                                <DeleteIcon />
                                            </Button>
                                            {!isEmpty && (
                                                <span className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-max px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                                    Warehouse must be empty to delete.
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </li>
                            )
                        })}
                    </ul>
                </div>
            </div>

            <Modal isOpen={isStockModalOpen} onClose={() => setStockModalOpen(false)} title="Add Stock to Inventory">
                <AddStockForm warehouses={warehouses} products={products} onSave={handleAddStock} onCancel={() => setStockModalOpen(false)} />
            </Modal>
            
            <Modal isOpen={isWarehouseModalOpen} onClose={() => setWarehouseModalOpen(false)} title={editingWarehouse ? 'Edit Warehouse' : 'Add New Warehouse'}>
                <WarehouseForm warehouse={editingWarehouse} onSave={handleSaveWarehouse} onCancel={() => {setWarehouseModalOpen(false); setEditingWarehouse(null);}} />
            </Modal>

            <ConfirmModal 
                isOpen={isConfirmOpen} 
                onClose={() => setConfirmOpen(false)}
                onConfirm={handleDeleteWarehouse}
                title="Delete Warehouse"
                message="Are you sure? Deleting a warehouse is permanent. This may fail if the warehouse still contains stock."
            />
        </div>
    );
};

export default Inventory;
