// Fix: Removed extraneous file markers that were causing syntax errors.
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { getSales, getWholesaleSales, updateSale, updateWholesaleSale, getProducts, addSalesReturn, getSalesReturns } from '../services/api';
import { Sale, WholesaleSale, Product, SalesReturn, SalesReturnProduct } from '../types';
import { exportToCSV } from '../services/csvExporter';
import Button from './common/Button';
import Modal from './common/Modal';
import ApiError from './common/ApiError';

const LoadingSpinner = () => (
    <div className="flex justify-center items-center h-64">
      <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-emerald-500"></div>
    </div>
);

type CombinedSale = (Sale & { type: 'Retail' }) | (WholesaleSale & { type: 'Wholesale' });

interface ReturnFormProps {
    sale: CombinedSale;
    allReturnsForSale: SalesReturn[];
    allProducts: Product[];
    onReturn: (updatedSale: Sale | WholesaleSale, salesReturnData: Omit<SalesReturn, 'id'>) => void;
    onCancel: () => void;
}

const ReturnForm: React.FC<ReturnFormProps> = ({ sale, allReturnsForSale, onReturn,allProducts, onCancel }) => {
    const [returnedProducts, setReturnedProducts] = useState<SalesReturnProduct[]>([]);
    const [selectedProduct, setSelectedProduct] = useState<string>('');
    const [currentQty, setCurrentQty] = useState<number>(1);
    const [currentPrice, setCurrentPrice] = useState<number>(0);
    const [validationError, setValidationError] = useState<string>('');

    const originalProductsList = useMemo(() => {
        const productsOnSale = sale.products;
        const productsPreviouslyReturned = allReturnsForSale.flatMap(r => r.returnedProducts);
        
        const combinedMap = new Map<string, { quantity: number, price: number }>();
        
        productsOnSale.forEach(p => {
            combinedMap.set(p.name, { quantity: p.quantity, price: p.price });
        });
        
        productsPreviouslyReturned.forEach(p => {
            const existing = combinedMap.get(p.name);
            if (existing) {
                existing.quantity += p.quantity;
            } else {
                combinedMap.set(p.name, { quantity: p.quantity, price: p.price });
            }
        });

        return Array.from(combinedMap.entries()).map(([name, data]) => ({ name, ...data }));
    }, [sale.products, allReturnsForSale]);


    useEffect(() => {
        if(originalProductsList.length > 0 && !selectedProduct) {
            const firstProduct = originalProductsList[0];
            setSelectedProduct(firstProduct.name);
            setCurrentPrice(firstProduct.price);
        } else if (originalProductsList.length === 0) {
            setSelectedProduct('');
            setCurrentPrice(0);
        }
    }, [originalProductsList, selectedProduct]);
    
    const getAvailableToReturnQty = useCallback((productName: string): number => {
        if (!productName) return 0;

        const originalProduct = originalProductsList.find(p => p.name === productName);
        const originalQty = originalProduct ? originalProduct.quantity : 0;

        const previouslyReturnedQty = allReturnsForSale
            .flatMap(r => r.returnedProducts)
            .filter(p => p.name === productName)
            .reduce((sum, p) => sum + p.quantity, 0);

        const qtyInCurrentReturnSlip = returnedProducts.find(p => p.name === productName)?.quantity || 0;
        
        return originalQty - previouslyReturnedQty - qtyInCurrentReturnSlip;
    }, [originalProductsList, allReturnsForSale, returnedProducts]);

    
    const handleProductSelect = (productName: string) => {
        setSelectedProduct(productName);
        const product = originalProductsList.find(p => p.name === productName);
        setCurrentPrice(product ? product.price : 0);
        setCurrentQty(1);
        setValidationError('');
    }
    
    const handleQtyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const maxQty = getAvailableToReturnQty(selectedProduct);
        let newQty = parseInt(e.target.value);

        if (isNaN(newQty)) {
            setCurrentQty(1);
        } else {
            if (newQty > maxQty) newQty = maxQty;
            if (newQty < 1) newQty = 1;
            setCurrentQty(newQty);
        }
    };

    const handleAddProductToReturn = () => {
        if (!selectedProduct || currentQty <= 0) return;

        const availableToReturn = getAvailableToReturnQty(selectedProduct);

        if (currentQty > availableToReturn) {
            setValidationError(`Cannot return more than ${availableToReturn} for ${selectedProduct}.`);
            setTimeout(() => setValidationError(''), 4000);
            return;
        }
        setValidationError('');

        const existingIndex = returnedProducts.findIndex(p => p.name === selectedProduct);
        if (existingIndex > -1) {
            const updatedList = [...returnedProducts];
            updatedList[existingIndex].quantity += currentQty;
            setReturnedProducts(updatedList);
        } else {
            setReturnedProducts([...returnedProducts, { name: selectedProduct, quantity: currentQty, price: currentPrice }]);
        }
        
        setCurrentQty(1);
        const nextProduct = originalProductsList.find(p => getAvailableToReturnQty(p.name) > 0 && p.name !== selectedProduct);
        if (nextProduct) {
            handleProductSelect(nextProduct.name);
        } else {
            setSelectedProduct('');
        }
    };
    
    const handleRemoveProductFromReturn = (productName: string) => {
        setReturnedProducts(returnedProducts.filter(p => p.name !== productName));
    }
    
   const handleSubmit = () => {
    if (returnedProducts.length === 0) {
        alert("Please add at least one item to the return slip.");
        return;
    }

    const newProductsForSale = sale.products.map(p => {
        const returnedItem = returnedProducts.find(ret => ret.name === p.name);
        const returnedQty = returnedItem ? returnedItem.quantity : 0;
        return { ...p, quantity: p.quantity - returnedQty };
    }).filter(p => p.quantity > 0);

    const newTotalAmount = newProductsForSale.reduce((sum, p) => sum + p.price * p.quantity, 0);

    const updatedSale = { ...sale, products: newProductsForSale, totalAmount: newTotalAmount };

    const returnedProductsWithIds = returnedProducts.map(p => {
        const product = allProducts.find(prod => prod.name === p.name);
        if (!product) throw new Error(`Product not found: ${p.name}`);
        console.log("All products:", allProducts);
        console.log("Trying lookup for:", p.productId);

        return {
            productId: product.id,
            quantity: p.quantity,
            price: p.price
        };
    });

    // ✅ Correct refund calculation
    const totalRefundAmount = returnedProducts.reduce(
        (sum, p) => sum + p.quantity * p.price,
        0
    );

    const salesReturnData = {
        returnedProducts: returnedProductsWithIds,
        warehouseId: sale.warehouseId || 'default',
        date: new Date().toISOString().split('T')[0],
        totalRefundAmount
    };

    onReturn(updatedSale, salesReturnData);
};


    const totalRefundAmount = returnedProducts.reduce((sum, p) => sum + p.quantity * p.price, 0);
    const maxQtyForSelectedProduct = getAvailableToReturnQty(selectedProduct);

    return (
        <div className="space-y-4">
            <div>
                <h4 className="font-semibold text-white">Returning items for Invoice: {sale.invoiceNumber}</h4>
                <p className="text-sm text-gray-400">Customer: {'customerName' in sale ? sale.customerName : sale.shopName}</p>
            </div>

            <div className="p-3 bg-gray-800/50 rounded-lg space-y-2">
                <div className="space-y-3">
                    <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1">Product</label>
                        <select value={selectedProduct} onChange={e => handleProductSelect(e.target.value)} className="w-full bg-gray-700/50 border border-white/20 rounded-md p-2 text-gray-200">
                            {originalProductsList.map(p => <option key={p.name} value={p.name}>{p.name} (Bought: {p.quantity})</option>)}
                        </select>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-end">
                        <div>
                            <label className="block text-xs font-medium text-gray-400 mb-1">Price</label>
                            <input type="number" readOnly value={currentPrice} className="w-full bg-gray-700/50 border border-white/20 rounded-md p-2 text-gray-200" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-400 mb-1">Return Qty</label>
                            <input 
                                type="number" 
                                value={currentQty} 
                                onChange={handleQtyChange} 
                                min="1" 
                                max={maxQtyForSelectedProduct}
                                disabled={maxQtyForSelectedProduct <= 0}
                                className="w-full bg-gray-700/50 border border-white/20 rounded-md p-2 text-gray-200 text-center disabled:opacity-50" 
                            />
                        </div>
                        <div>
                            <Button type="button" variant="secondary" onClick={handleAddProductToReturn} className="w-full h-full" disabled={maxQtyForSelectedProduct <= 0}>Add to Return</Button>
                        </div>
                    </div>
                </div>
                {validationError && (
                    <p className="text-red-400 text-xs mt-2 text-center animate-pulse">{validationError}</p>
                )}
            </div>

            <div className="border-t border-b border-white/10 py-4 max-h-48 overflow-y-auto">
                <h5 className="font-semibold text-gray-200 mb-2">Products Being Returned:</h5>
                {returnedProducts.length === 0 ? (
                     <p className="text-sm text-gray-400 text-center py-4">No products added yet.</p>
                ) : (
                    <table className="min-w-full text-sm">
                        <thead className="text-xs text-gray-400 uppercase">
                            <tr>
                                <th className="text-left font-medium py-1">Product</th>
                                <th className="text-center font-medium py-1">Details</th>
                                <th className="text-right font-medium py-1">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                        {returnedProducts.map(p => (
                            <tr key={p.name} className="border-t border-white/10">
                                <td className="py-2 font-medium text-white">{p.name}</td>
                                <td className="py-2 text-center text-gray-300">{p.quantity} x {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(p.price)}</td>
                                <td className="py-2 text-right">
                                    <Button type="button" variant="ghost" className="!p-1 !text-red-400" onClick={() => handleRemoveProductFromReturn(p.name)}>
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                    </Button>
                                </td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                )}
            </div>

            <div className="text-right text-lg font-bold text-white">
                Total Refund Amount: <span className="text-yellow-400">{new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(totalRefundAmount)}</span>
            </div>
             <div className="flex justify-end space-x-2 pt-4">
                <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
                <Button type="button" variant="primary" onClick={handleSubmit}>Process Return</Button>
            </div>
        </div>
    )
}

const SalesReturn: React.FC = () => {
    const [allSales, setAllSales] = useState<CombinedSale[]>([]);
    const [allProducts, setAllProducts] = useState<Product[]>([]);
    const [returns, setReturns] = useState<SalesReturn[]>([]);
    const [filteredSales, setFilteredSales] = useState<CombinedSale[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    
    const [searchType, setSearchType] = useState<'invoice' | 'customer' | 'date'>('invoice');
    const [searchTerm, setSearchTerm] = useState('');

    const [selectedSale, setSelectedSale] = useState<CombinedSale | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isExportingCSV, setIsExportingCSV] = useState(false);

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [salesData, wholesaleData, productsData, returnsData] = await Promise.all([
                getSales(), 
                getWholesaleSales(), 
                getProducts(),
                getSalesReturns()
            ]);
            const combined = [
                ...salesData.map(s => ({ ...s, type: 'Retail' as const })),
                ...wholesaleData.map(w => ({ ...w, type: 'Wholesale' as const }))
            ];
            setAllSales(combined);
            setFilteredSales(combined);
            setAllProducts(productsData);
            setReturns(returnsData);
        } catch (err) {
            console.error(err);
            setError("Failed to fetch sales data.");
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
            switch(searchType) {
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

 const handleReturn = async (
    updatedSaleData: Sale | WholesaleSale, 
    salesReturnData: any
) => {
    try {
        const completeReturnData = {
            saleId: updatedSaleData.id,
            warehouseId: updatedSaleData.warehouseId || 'default',
            returnedProducts: salesReturnData.returnedProducts.map((p: any) => ({
                productId: p.productId,
                quantity: p.quantity,
                price: p.price  // ✅ Include price for calculation
            })),
            totalRefundAmount: salesReturnData.totalRefundAmount,  // ✅ Pass this
            date: salesReturnData.date || new Date().toISOString().split('T')[0]
        };
        
        console.log('Submitting return with refund amount:', completeReturnData);
        
        await addSalesReturn(completeReturnData);
        
        // Update the original sale
        const saleUpdatePayload = {
            id: updatedSaleData.id,
            products: updatedSaleData.products,
            totalAmount: updatedSaleData.totalAmount,
            warehouseId: updatedSaleData.warehouseId
        };
        
        if (updatedSaleData.type === 'Retail') {
            await updateSale(saleUpdatePayload);
        } else {
            await updateWholesaleSale(saleUpdatePayload);
        }
        
        await fetchData();
        
        alert("✓ Return processed successfully!");
        
        setIsModalOpen(false);
        setSelectedSale(null);
    } catch (err: any) {
        console.error('Return error:', err);
        alert(`Failed to process return: ${err.message || err}`);
    }
};



    const handleExportCSV = () => {
        setIsExportingCSV(true);
        try {
            const flattenedData = returns.flatMap(ret =>
                ret.returnedProducts.map(product => ({
                    returnDate: ret.date,
                    originalInvoiceNumber: ret.originalInvoiceNumber,
                    customerName: ret.customerName,
                    productName: product.name,
                    returnedQuantity: product.quantity,
                    pricePerUnit: product.price,
                    refundLineTotal: product.quantity * product.price
                }))
            );
            exportToCSV(flattenedData, 'sales-returns-history.csv');
        } catch (error) {
            console.error("Error exporting CSV:", error);
            alert("An error occurred while generating the CSV.");
        } finally {
            setIsExportingCSV(false);
        }
    };

    const openReturnModal = (sale: CombinedSale) => {
        setSelectedSale(sale);
        setIsModalOpen(true);
    };
    
    const formatCurrency = (value: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(value);

    if (loading) return <LoadingSpinner />;
    if (error) return <ApiError onRetry={fetchData} />;

    return (
        <div>
            <h1 className="text-3xl font-bold mb-6 text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-green-500">Sales Return</h1>
            
            <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-xl shadow-lg p-4 mb-6">
                <h3 className="text-lg font-semibold text-white mb-2">Find Sale to Return</h3>
                <form onSubmit={handleSearch} className="flex flex-col md:flex-row items-center gap-2">
                    <select value={searchType} onChange={e => setSearchType(e.target.value as any)} className="bg-gray-800/50 border border-white/20 rounded-md p-2 text-gray-200">
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

            <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-xl shadow-lg overflow-hidden mb-8">
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
                            {filteredSales.map(s => (
                                <tr key={s.id} className="border-b border-white/10 hover:bg-white/5 transition-colors">
                                    <td className="px-6 py-4">{s.date}</td>
                                    <td className="px-6 py-4 font-mono text-xs">{s.invoiceNumber}</td>
                                    <td className="px-6 py-4 font-medium text-white">{'customerName' in s ? s.customerName : s.shopName}</td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${s.type === 'Retail' ? 'bg-blue-500/20 text-blue-300' : 'bg-purple-500/20 text-purple-300'}`}>{s.type}</span>
                                    </td>
                                    <td className="px-6 py-4">{formatCurrency(s.totalAmount)}</td>
                                    <td className="px-6 py-4 text-right">
                                        <Button 
                                            variant="ghost" 
                                            onClick={() => openReturnModal(s)}
                                            disabled={s.products.length === 0}
                                            title={s.products.length === 0 ? 'All items for this invoice have been returned' : 'Process a return for this invoice'}
                                        >
                                            {s.products.length === 0 ? 'Fully Returned' : 'Process Return'}
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                 </div>
            </div>
            
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-green-500">Processed Returns History</h2>
                <Button onClick={handleExportCSV} variant="secondary" disabled={isExportingCSV}>
                    {isExportingCSV ? 'Exporting...' : 'Export as CSV'}
                </Button>
            </div>
            <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-xl shadow-lg overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full text-sm text-left text-gray-300">
                         <thead className="bg-white/5 uppercase text-xs">
                             <tr>
                                <th scope="col" className="px-6 py-3">Return Date</th>
                                <th scope="col" className="px-6 py-3">Original Invoice</th>
                                <th scope="col" className="px-6 py-3">Customer</th>
                                <th scope="col" className="px-6 py-3">Returned Products</th>
                                <th scope="col" className="px-6 py-3 text-center">Refund Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                          {returns.map(r => (
                            <tr key={r.id} className="border-b border-white/10 hover:bg-white/5 transition-colors">
                              <td className="px-6 py-4">{r.date}</td>
                              <td className="px-6 py-4">{r.originalInvoiceNumber}</td>
                              <td className="px-6 py-4">{r.customerName}</td>
                              <td className="px-6 py-4" >{r.returnedProducts.map(p => {
                                  const productName = p.name || p.productId || 'Unknown Product';
                                  return `${p.quantity}x ${productName}`;
                              }).join(', ')}</td>
                              <td className="px-6 py-4 text-center" >{formatCurrency(r.totalRefundAmount)}</td>
                            </tr>
                          ))}
                        </tbody>

                    </table>
                </div>
            </div>

             <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Process Sales Return">
                {selectedSale && <ReturnForm sale={selectedSale} allReturnsForSale={returns.filter(r => r.originalSaleId === selectedSale.id)}  allProducts={allProducts}  onReturn={handleReturn} onCancel={() => setIsModalOpen(false)} />}
            </Modal>
        </div>
    )
}

export default SalesReturn;
