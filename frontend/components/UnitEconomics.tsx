import React, { useState, useEffect, useCallback } from 'react';
import { getProducts } from '../services/api';
import { Product } from '../types';
import Button from './common/Button';
import ApiError from './common/ApiError';

const LoadingSpinner = () => (
    <div className="flex justify-center items-center h-64">
      <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-emerald-500"></div>
    </div>
);

interface Costs {
    [key: string]: number;
    substrate: number;
    spawn: number;
    packaging: number;
    other: number;
}

interface Results {
    sellingPrice: number;
    totalVariableCost: number;
    contributionMargin: number;
    contributionMarginRatio: number;
}

const UnitEconomics: React.FC = () => {
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedProductId, setSelectedProductId] = useState<string>('');
    const [costs, setCosts] = useState<Costs>({ substrate: 0, spawn: 0, packaging: 0, other: 0 });
    const [results, setResults] = useState<Results | null>(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const productsData = await getProducts();
            setProducts(productsData);
            if (productsData.length > 0) {
                setSelectedProductId(productsData[0].id);
            }
        } catch (err) {
            console.error(err);
            setError("Failed to fetch products for calculation.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleCostChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setCosts(prev => ({ ...prev, [name]: parseFloat(value) || 0 }));
    };

    const handleCalculate = (e: React.FormEvent) => {
        e.preventDefault();
        const product = products.find(p => p.id === selectedProductId);
        if (!product) return;
        
        const totalVariableCost = Object.values(costs).reduce((sum, cost) => sum + cost, 0);
        const sellingPrice = product.defaultPrice;
        const contributionMargin = sellingPrice - totalVariableCost;
        const contributionMarginRatio = sellingPrice > 0 ? (contributionMargin / sellingPrice) * 100 : 0;

        setResults({
            sellingPrice,
            totalVariableCost,
            contributionMargin,
            contributionMarginRatio,
        });
    };

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(value);
    };

    if (loading) return <LoadingSpinner />;
    if (error) return <ApiError onRetry={fetchData} />;

    return (
        <div>
            <h1 className="text-3xl font-bold mb-6 text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-green-500">Unit Economics Calculator</h1>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-xl shadow-lg p-6">
                    <form onSubmit={handleCalculate} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-1 text-gray-400">Select Product</label>
                            <select 
                                value={selectedProductId} 
                                onChange={(e) => {
                                    setSelectedProductId(e.target.value);
                                    setResults(null);
                                }} 
                                className="w-full bg-gray-800/50 border border-white/20 rounded-md p-2 text-gray-200 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                            >
                                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                        </div>
                        <div className="border-t border-white/10 pt-4">
                            <h3 className="text-lg font-semibold text-white mb-2">Costs per Unit</h3>
                            <div className="space-y-3">
                                <CostInput name="substrate" label="Substrate Cost" value={costs.substrate} onChange={handleCostChange} />
                                <CostInput name="spawn" label="Spawn/Seed Cost" value={costs.spawn} onChange={handleCostChange} />
                                <CostInput name="packaging" label="Packaging Cost" value={costs.packaging} onChange={handleCostChange} />
                                <CostInput name="other" label="Other Variable Costs" value={costs.other} onChange={handleCostChange} />
                            </div>
                        </div>
                        <div className="pt-2">
                           <Button type="submit" className="w-full">Calculate</Button>
                        </div>
                    </form>
                </div>
                
                {results && (
                    <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-xl shadow-lg p-6 flex flex-col justify-center animate-fade-in">
                       <h2 className="text-xl font-bold mb-4 text-white text-center">Profitability Analysis</h2>
                       <div className="space-y-4">
                           <ResultRow label="Selling Price" value={formatCurrency(results.sellingPrice)} color="text-gray-300" />
                           <ResultRow label="Total Variable Cost" value={formatCurrency(results.totalVariableCost)} color="text-red-400" isNegative={true} />
                           <div className="border-b border-white/20 my-2"></div>
                           <ResultRow label="Contribution Margin per Unit" value={formatCurrency(results.contributionMargin)} color="text-emerald-400" isLarge={true} />
                           <ResultRow label="Contribution Margin Ratio" value={`${results.contributionMarginRatio.toFixed(2)}%`} color="text-emerald-400" isLarge={true} />
                       </div>
                       <p className="text-xs text-gray-400 mt-6 text-center">This shows the profit from one unit before fixed costs are considered.</p>
                    </div>
                )}
            </div>
            <style>{`
                @keyframes fade-in {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0px); }
                }
                .animate-fade-in { animation: fade-in 0.5s ease-out forwards; }
            `}</style>
        </div>
    );
};

const CostInput: React.FC<{name: string, label: string, value: number, onChange: (e: React.ChangeEvent<HTMLInputElement>) => void}> = ({name, label, value, onChange}) => (
    <div>
        <label className="block text-sm font-medium mb-1 text-gray-400">{label}</label>
        <div className="relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">₹</span>
            <input 
                type="number" 
                step="0.01" 
                min="0" 
                name={name} 
                value={value} 
                onChange={onChange} 
                className="w-full bg-gray-800/50 border border-white/20 rounded-md p-2 pl-7 text-gray-200 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-all" 
                required 
            />
        </div>
    </div>
);

const ResultRow: React.FC<{label: string, value: string, color: string, isNegative?: boolean, isLarge?: boolean}> = ({ label, value, color, isNegative, isLarge }) => (
    <div className="flex justify-between items-baseline">
        <p className="text-gray-300">{label}</p>
        <p className={`font-bold ${color} ${isLarge ? 'text-2xl' : 'text-lg'}`}>
            {isNegative && '- '}{value}
        </p>
    </div>
);


export default UnitEconomics;
