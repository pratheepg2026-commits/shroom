import React, { useState, useEffect, useCallback } from 'react';
import { getCustomers } from '../services/api';
import { Customer, CustomerType, Transaction } from '../types';
import Modal from './common/Modal';
import ApiError from './common/ApiError';
import Button from './common/Button';

const LoadingSpinner = () => (
    <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-emerald-500"></div>
    </div>
);

const TransactionIcon: React.FC<{ type: CustomerType }> = ({ type }) => {
    const icons = {
        Retail: (
            <div className="bg-purple-500/10 p-2 rounded-full">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
            </div>
        ),
        Wholesale: (
            <div className="bg-pink-500/10 p-2 rounded-full">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-pink-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
            </div>
        ),
        Subscription: (
            <div className="bg-blue-500/10 p-2 rounded-full">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            </div>
        ),
    };
    return icons[type] || null;
};


const CustomerDetailModal: React.FC<{ customer: Customer; onClose: () => void }> = ({ customer, onClose }) => {
    
    const formatCurrency = (value: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(value);

    const getTransactionDescription = (t: Transaction) => {
        switch (t.transactionType) {
            case 'Retail':
            case 'Wholesale':
                return `${t.products.map(p => `${p.quantity}x ${p.name}`).join(', ')}`;
            case 'Subscription':
                return `Subscription: ${t.plan}`;
        }
    };
    
    const getTransactionAmount = (t: Transaction) => {
        if ('totalAmount' in t) return t.totalAmount;
        // In a real scenario, we'd look up product price for subscription, but for this mock we rely on totalSpent
        return 0; 
    }

    return (
        <Modal isOpen={true} onClose={onClose} title={customer.name}>
            <div className="space-y-4">
                <div className="p-4 bg-gray-800/50 rounded-lg border border-white/10">
                    <h3 className="font-semibold text-lg text-white mb-2">Contact Information</h3>
                    <p className="text-sm text-gray-300"><strong>Email:</strong> {customer.contact.email || 'N/A'}</p>
                    <p className="text-sm text-gray-300"><strong>Phone:</strong> {customer.contact.phone || 'N/A'}</p>
                    <p className="text-sm text-gray-300"><strong>Address:</strong> {customer.contact.address || 'N/A'}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <div className="p-4 bg-gray-800/50 rounded-lg border border-white/10">
                        <p className="text-sm text-gray-400">Lifetime Value</p>
                        <p className="text-2xl font-bold text-emerald-400">{formatCurrency(customer.totalSpent)}</p>
                    </div>
                     <div className="p-4 bg-gray-800/50 rounded-lg border border-white/10">
                        <p className="text-sm text-gray-400">Last Activity</p>
                        <p className="text-xl font-bold text-white">{new Date(customer.lastActivityDate).toLocaleDateString()}</p>
                    </div>
                </div>

                <div>
                    <h3 className="font-semibold text-lg text-white mb-2">Transaction History</h3>
                    <div className="max-h-64 overflow-y-auto pr-2 space-y-3">
                        {customer.transactionHistory.map(t => (
                            <div key={t.id} className="flex items-start p-3 bg-gray-800/60 rounded-lg border border-white/10">
                                <TransactionIcon type={t.transactionType} />
                                <div className="flex-grow ml-4">
                                    <div className="flex justify-between items-baseline">
                                        <p className="font-semibold text-white">{t.transactionType}</p>
                                        <p className="font-semibold text-emerald-400">{formatCurrency(getTransactionAmount(t))}</p>
                                    </div>
                                    <p className="text-xs text-gray-400 mb-1">{new Date('date' in t ? t.date : t.startDate).toLocaleDateString()}</p>
                                    <p className="text-sm text-gray-300">{getTransactionDescription(t)}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="flex justify-end pt-4">
                    <Button onClick={onClose} variant="secondary">Close</Button>
                </div>
            </div>
        </Modal>
    );
};

const Customers: React.FC = () => {
    const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
    const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await getCustomers();
            setAllCustomers(data);
            setFilteredCustomers(data);
        } catch (err) {
            console.error(err);
            setError("Failed to fetch customer data.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    useEffect(() => {
        const lowercasedTerm = searchTerm.toLowerCase();
        const results = allCustomers.filter(c => 
            c.name.toLowerCase().includes(lowercasedTerm) ||
            c.contact.email.toLowerCase().includes(lowercasedTerm) ||
            c.contact.phone.toLowerCase().includes(lowercasedTerm)
        );
        setFilteredCustomers(results);
    }, [searchTerm, allCustomers]);
    
    const formatCurrency = (value: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(value);

    const getTypePill = (type: CustomerType) => {
        switch (type) {
            case 'Subscription': return 'bg-blue-500/20 text-blue-300';
            case 'Retail': return 'bg-purple-500/20 text-purple-300';
            case 'Wholesale': return 'bg-pink-500/20 text-pink-300';
        }
    };

    if (loading) return <LoadingSpinner />;
    if (error) return <ApiError onRetry={fetchData} />;

    return (
        <div>
            <div className="flex flex-col md:flex-row justify-between md:items-center mb-6 gap-4">
                <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-green-500">Customer Hub</h1>
                <div className="relative w-full md:w-1/3">
                    <input 
                        type="text"
                        placeholder="Search by name, email, or phone..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full bg-gray-800/50 border border-white/20 rounded-md p-2 pl-10 text-gray-200"
                    />
                    <div className="absolute inset-y-0 left-0 flex items-center pl-3">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    </div>
                </div>
            </div>

            <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-xl shadow-lg overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full text-sm text-left text-gray-300">
                        <thead className="bg-white/5 uppercase text-xs">
                            <tr>
                                <th scope="col" className="px-6 py-3">Name</th>
                                <th scope="col" className="px-6 py-3">Type(s)</th>
                                <th scope="col" className="px-6 py-3">Last Sale Date</th>
                                <th scope="col" className="px-6 py-3 text-right">Lifetime Value</th>
                                <th scope="col" className="px-6 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredCustomers.map(customer => (
                                <tr key={customer.id} className="border-b border-white/10 hover:bg-white/5 transition-colors">
                                    <td className="px-6 py-4 font-medium text-white">{customer.name}</td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-wrap gap-1">
                                            {/* Fix: Explicitly type 't' as CustomerType to resolve type inference issue. */}
                                            {Array.from(customer.types).map((t: CustomerType) => (
                                                <span key={t} className={`px-2 py-0.5 rounded-full text-xs font-semibold ${getTypePill(t)}`}>{t}</span>
                                            ))}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">{customer.lastSaleDate ? new Date(customer.lastSaleDate).toLocaleDateString() : 'N/A'}</td>
                                    <td className="px-6 py-4 text-right font-semibold">{formatCurrency(customer.totalSpent)}</td>
                                    <td className="px-6 py-4 text-right">
                                        <Button variant="ghost" onClick={() => setSelectedCustomer(customer)}>View Details</Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
            
            {selectedCustomer && (
                <CustomerDetailModal customer={selectedCustomer} onClose={() => setSelectedCustomer(null)} />
            )}
        </div>
    );
};

export default Customers;