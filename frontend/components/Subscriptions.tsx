// Fix: Removed extraneous file markers that were causing syntax errors.
import React, { useState, useEffect, useCallback } from 'react';
import { getSubscriptions, addSubscription, updateSubscription, deleteSubscription, getProducts } from '../services/api';
import { Subscription, Status, Product } from '../types';
import Button from './common/Button';
import Modal from './common/Modal';
import ConfirmModal from './common/ConfirmModal';
import ApiError from './common/ApiError';

const LoadingSpinner = () => (
  <div className="flex justify-center items-center h-64">
    <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-emerald-500"></div>
  </div>
);

const SubscriptionForm: React.FC<{
  subscription: Omit<Subscription, 'id' | 'name'> | Subscription | null;
  products: Product[];
  onSave: (subscription: Omit<Subscription, 'id' | 'name'> | Subscription) => void;
  onCancel: () => void;
}> = ({ subscription, products, onSave, onCancel }) => {
  const [formData, setFormData] = useState({
    customerName: '',
    email: '',
    phone: '',
    address: '',
    flatNo: '',
    flatName: '',
    plan: '',
    status: Status.ACTIVE,
    startDate: new Date().toISOString().split('T')[0],
    ...subscription
  });

  useEffect(() => {
    // If we are creating a new subscription and there are subscription products,
    // default the plan to the first one.
    const subscriptionProducts = products.filter(p => p.name.toLowerCase().includes('monthly'));
    if (!subscription && subscriptionProducts.length > 0) {
      setFormData(prev => ({...prev, plan: subscriptionProducts[0].name}));
    }
  }, [subscription, products]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };
  
  const subscriptionProducts = products.filter(p => p.name.toLowerCase().includes('monthly'));

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <input type="text" name="customerName" value={formData.customerName} onChange={handleChange} placeholder="Name" className="w-full bg-gray-800/50 border border-white/20 rounded-md p-2 text-gray-200" required />
        <input type="email" name="email" value={formData.email} onChange={handleChange} placeholder="Email" className="w-full bg-gray-800/50 border border-white/20 rounded-md p-2 text-gray-200" required />
        <input type="tel" name="phone" value={formData.phone} onChange={handleChange} placeholder="Phone" className="w-full bg-gray-800/50 border border-white/20 rounded-md p-2 text-gray-200" required />
         <select name="plan" value={formData.plan} onChange={handleChange} className="w-full bg-gray-800/50 border border-white/20 rounded-md p-2 text-gray-200" required>
            <option value="">Select Subscription Plan</option>
            {subscriptionProducts.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
        </select>
      </div>
      <input type="text" name="address" value={formData.address} onChange={handleChange} placeholder="Address" className="w-full bg-gray-800/50 border border-white/20 rounded-md p-2 text-gray-200" required />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <input type="text" name="flatNo" value={formData.flatNo} onChange={handleChange} placeholder="Flat No (Optional)" className="w-full bg-gray-800/50 border border-white/20 rounded-md p-2 text-gray-200" />
        <input type="text" name="flatName" value={formData.flatName} onChange={handleChange} placeholder="Flat Name (Optional)" className="w-full bg-gray-800/50 border border-white/20 rounded-md p-2 text-gray-200" />
      </div>
       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <select name="status" value={formData.status} onChange={handleChange} className="w-full bg-gray-800/50 border border-white/20 rounded-md p-2 text-gray-200">
          {Object.values(Status).map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <input type="date" name="startDate" value={formData.startDate} onChange={handleChange} className="w-full bg-gray-800/50 border border-white/20 rounded-md p-2 text-gray-200" required />
      </div>
      <div className="flex justify-end space-x-2 pt-4">
        <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button type="submit" variant="primary">Save Subscription</Button>
      </div>
    </form>
  );
};


const Subscriptions: React.FC = () => {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [selectedSubscription, setSelectedSubscription] = useState<Subscription | null>(null);
  const [subscriptionToDelete, setSubscriptionToDelete] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [subsData, prodsData] = await Promise.all([getSubscriptions(), getProducts()]);
      setSubscriptions(subsData.map(s => ({...s, name: (s as any).customerName || s.name}))); // fix for name vs customerName
      setProducts(prodsData);
    } catch (err) {
      console.error(err);
      setError("Failed to load data. Please ensure the backend server is running.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSave = async (subscriptionData: Omit<Subscription, 'id' | 'name'> | Subscription) => {
    try {
      const dataToSave = {...subscriptionData, customerName: (subscriptionData as any).name || (subscriptionData as any).customerName };
      if ('id' in dataToSave && dataToSave.id) {
        await updateSubscription(dataToSave as Subscription);
      } else {
        await addSubscription(dataToSave as Omit<Subscription, 'id'>);
      }
      fetchData();
      setIsModalOpen(false);
      setSelectedSubscription(null);
    } catch (err) {
      console.error(err);
      alert("Failed to save subscription.");
    }
  };
  
  const handleDelete = async () => {
    if (!subscriptionToDelete) return;
    try {
        await deleteSubscription(subscriptionToDelete);
        fetchData();
    } catch (err) {
        console.error("Failed to delete subscription", err);
        alert("Failed to delete subscription.");
    } finally {
        setIsConfirmOpen(false);
        setSubscriptionToDelete(null);
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
      doc.text("SHROOMMUSH - Subscriptions Report", 14, 22);
      doc.setFontSize(11);
      doc.setTextColor(100);
      doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 30);

      autoTable(doc, {
        startY: 40,
        head: [['Customer', 'Contact', 'Plan', 'Status', 'Start Date']],
        body: subscriptions.map(sub => [
          sub.name,
          `${sub.email}\n${sub.phone}`,
          sub.plan,
          sub.status,
          sub.startDate
        ]),
        headStyles: { fillColor: [34, 197, 94] },
      });

      doc.save('subscriptions-report.pdf');
    } catch (error) {
      console.error("Error exporting PDF:", error);
      alert("An error occurred while generating the PDF.");
    } finally {
      setIsExporting(false);
    }
  };

  const openDeleteConfirm = (id: string) => {
    setSubscriptionToDelete(id);
    setIsConfirmOpen(true);
  };

  const statusColor = (status: Status) => {
    switch (status) {
      case Status.ACTIVE: return 'bg-emerald-500/20 text-emerald-300';
      case Status.PAUSED: return 'bg-yellow-500/20 text-yellow-300';
      case Status.CANCELLED: return 'bg-red-500/20 text-red-300';
    }
  };
  
  const getDaysUntilRenewal = (startDate: string) => {
      const start = new Date(startDate);
      const today = new Date();
      start.setHours(0,0,0,0);
      today.setHours(0,0,0,0);
      
      let renewalDate = new Date(start);
      while(renewalDate <= today) {
        renewalDate.setMonth(renewalDate.getMonth() + 1);
      }

      const diffTime = renewalDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays;
  };
  
  const renewalIndicator = (days: number) => {
      if (days <= 7) return 'bg-red-500';
      if (days <= 15) return 'bg-yellow-500';
      return 'bg-green-500';
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <ApiError onRetry={fetchData} />

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-green-500">Subscriptions</h1>
        <div className="flex items-center space-x-2">
            <Button onClick={handleExportPDF} variant="secondary" disabled={isExporting}>
                {isExporting ? 'Exporting...' : 'Export as PDF'}
            </Button>
            <Button onClick={() => { setSelectedSubscription(null); setIsModalOpen(true); }}>Add Subscription</Button>
        </div>
      </div>
      
      <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-xl shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm text-left text-gray-300">
            <thead className="bg-white/5 uppercase text-xs">
              <tr>
                <th scope="col" className="px-6 py-3">Customer</th>
                <th scope="col" className="px-6 py-3">Plan</th>
                <th scope="col" className="px-6 py-3">Status</th>
                <th scope="col" className="px-6 py-3">Renewal In</th>
                <th scope="col" className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {subscriptions.map(sub => {
                  const daysRemaining = getDaysUntilRenewal(sub.startDate);
                  return (
                    <tr key={sub.id} className="border-b border-white/10 hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-medium text-white">{sub.name}</div>
                        <div className="text-xs text-gray-400">{sub.phone}</div>
                      </td>
                      <td className="px-6 py-4">{sub.plan}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${statusColor(sub.status)}`}>{sub.status}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                           <div className={`h-3 w-3 rounded-full mr-2 ${renewalIndicator(daysRemaining)}`}></div>
                           <span>{daysRemaining} days</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right space-x-2">
                        <Button variant="ghost" onClick={() => { setSelectedSubscription(sub); setIsModalOpen(true); }}>Edit</Button>
                        <Button variant="ghost" className="text-red-400 hover:bg-red-500/10" onClick={() => openDeleteConfirm(sub.id)}>Delete</Button>
                      </td>
                    </tr>
                  )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={selectedSubscription ? 'Edit Subscription' : 'Add Subscription'}>
        <SubscriptionForm 
          subscription={selectedSubscription} 
          products={products}
          onSave={handleSave} 
          onCancel={() => { setIsModalOpen(false); setSelectedSubscription(null); }} 
        />
      </Modal>

      <ConfirmModal
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={handleDelete}
        title="Delete Subscription"
        message="Are you sure you want to delete this subscription? This action cannot be undone."
      />

    </div>
  );
};

export default Subscriptions;
