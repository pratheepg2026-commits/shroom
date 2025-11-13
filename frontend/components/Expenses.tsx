// Fix: Removed extraneous file markers that were causing syntax errors.
import React, { useState, useEffect, useCallback } from 'react';
import { getExpenses, addExpense, deleteExpense, getWarehouses,updateExpense    } from '../services/api';
import { Expense, ExpenseCategory } from '../types';
import { exportToCSV } from '../services/csvExporter';
import Button from './common/Button';
import Modal from './common/Modal';
import ConfirmModal from './common/ConfirmModal';
import ApiError from './common/ApiError';
// Simple inline edit icon — no external library needed
const EditIcon: React.FC<{ size?: number; className?: string }> = ({ size = 18, className = "" }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={2}
    stroke="currentColor"
    width={size}
    height={size}
    className={className}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M11 4h2m-1 0v16m0 0h2m-2-8h8m-8 0H4"
    />
  </svg>
);


const LoadingSpinner = () => (
  <div className="flex justify-center items-center h-64">
    <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-emerald-500"></div>
  </div>
);

const ExpenseForm: React.FC<{
  onSave: (expense: Omit<Expense, 'id'>) => void;
  onCancel: () => void;
}> = ({ onSave, onCancel }) => {
  const [formData, setFormData] = useState<Omit<Expense, 'id'>>({
    category: ExpenseCategory.MISC,
    description: '',
    amount: 0,
    date: new Date().toISOString().split('T')[0],
    warehouse_id: '',
  });
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);

  useEffect(() => {
    // Fetch warehouses from Supabase or your API
    async function fetchWarehouses() {
      try {
        const response = await getWarehouses(); // Create this API call
        setWarehouses(response);
        if(response.length > 0) {
          setFormData(prev => ({ ...prev, warehouse_id: response[0].id }));
        }
      } catch (error) {
        console.error("Failed to fetch warehouses", error);
      }
    }
    fetchWarehouses();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: name === 'amount' ? parseFloat(value) : value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <select
        name="warehouse_id"
        value={formData.warehouse_id}
        onChange={handleChange}
        className="w-full bg-gray-800/50 border border-white/20 rounded-md p-2 text-gray-200"
        required
      >
        {warehouses.map(w => (
          <option key={w.id} value={w.id}>{w.name}</option>
        ))}
      </select>
      <select name="category" value={formData.category} onChange={handleChange} className="w-full bg-gray-800/50 border border-white/20 rounded-md p-2 text-gray-200" required>
        {Object.values(ExpenseCategory).map(cat => <option key={cat} value={cat}>{cat}</option>)}
      </select>
      <input type="text" name="description" value={formData.description} onChange={handleChange} placeholder="Description" className="w-full bg-gray-800/50 border border-white/20 rounded-md p-2 text-gray-200" required />
      <input type="number" name="amount" value={formData.amount} min="0" step="0.01" onChange={handleChange} placeholder="Amount" className="w-full bg-gray-800/50 border border-white/20 rounded-md p-2 text-gray-200" required />
      <input type="date" name="date" value={formData.date} onChange={handleChange} className="w-full bg-gray-800/50 border border-white/20 rounded-md p-2 text-gray-200" required />
      <div className="flex justify-end space-x-2 pt-4">
        <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button type="submit" variant="primary">Add Expense</Button>
      </div>
    </form>
  );
};


const Expenses: React.FC = () => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingCSV, setIsExportingCSV] = useState(false);

  const formatCurrency = (value: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(value);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getExpenses();
      setExpenses(data);
    } catch (err) {
      console.error(err);
      setError("Failed to fetch expenses.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  useEffect(() => {
    async function fetchWarehouses() {
      try {
        const data = await getWarehouses();
        setWarehouses(data);
      } catch (err) {
        console.error("Failed to fetch warehouses:", err);
      }
    }
    fetchWarehouses();
  }, []);
  const handleEditClick = (expense: any) => {
    setEditingExpense(expense);
    setShowEditModal(true);
  };

  const [editingExpense, setEditingExpense] = useState<any | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);


  const getWarehouseName = (id: string | null) => {
    if (!id) return "Unassigned";
    const w = warehouses.find(w => String(w.id) === String(id));
    return w ? w.name : "Unknown";
  };

  const handleSave = async (expenseData: Omit<Expense, 'id'>) => {
    try {
      await addExpense(expenseData);
      fetchData();
      setIsModalOpen(false);
    } catch (err) {
      console.error(err);
      alert("Failed to save expense.");
    }
  };
  
  const handleDelete = async () => {
    if (!expenseToDelete) return;
    try {
        await deleteExpense(expenseToDelete);
        fetchData();
    } catch (err) {
        console.error("Failed to delete expense", err);
        alert("Failed to delete expense.");
    } finally {
        setIsConfirmOpen(false);
        setExpenseToDelete(null);
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
      doc.text("SHROOMMUSH - Expenses Report", 14, 22);
      doc.setFontSize(11);
      doc.setTextColor(100);
      doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 30);

      autoTable(doc, {
        startY: 40,
        head: [['Date', 'Description', 'Category', 'Amount']],
        body: expenses.map(exp => [
          exp.date,
          exp.description,
          exp.category,
          formatCurrency(exp.amount),
        ]),
        headStyles: { fillColor: [34, 197, 94] },
      });

      doc.save('expenses-report.pdf');
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
        const dataToExport = expenses.map(({ id, ...rest }) => rest);
        exportToCSV(dataToExport, 'expenses.csv');
    } catch (error) {
        console.error("Error exporting CSV:", error);
        alert("An error occurred while generating the CSV.");
    } finally {
        setIsExportingCSV(false);
    }
  };

  const openDeleteConfirm = (id: string) => {
    setExpenseToDelete(id);
    setIsConfirmOpen(true);
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <ApiError onRetry={fetchData} />;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-green-500">Expenses</h1>
        <div className="flex items-center space-x-2">
            <Button onClick={handleExportCSV} variant="secondary" disabled={isExportingCSV}>
                {isExportingCSV ? 'Exporting...' : 'Export as CSV'}
            </Button>
            <Button onClick={handleExportPDF} variant="secondary" disabled={isExporting}>
                {isExporting ? 'Exporting...' : 'Export as PDF'}
            </Button>
            <Button onClick={() => setIsModalOpen(true)}>Add Expense</Button>
        </div>
      </div>
      
      <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-xl shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm text-left text-gray-300">
            <thead className="bg-white/5 uppercase text-xs">
              <tr>
                <th scope="col" className="px-6 py-3">Date</th>
                <th scope="col" className="px-6 py-3">Warehouse</th>
                <th scope="col" className="px-6 py-3">Description</th>
                <th scope="col" className="px-6 py-3">Category</th>
                <th scope="col" className="px-6 py-3">Amount</th>
                <th scope="col" className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {expenses.slice().sort((a, b) => b.date.localeCompare(a.date)).map(expense => (
                <tr key={expense.id} className="border-b border-white/10 hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4">{expense.date}</td>
                  <td>{getWarehouseName(expense.warehouse_id)}</td>
                  <td className="px-6 py-4 font-medium text-white">{expense.description}</td>
                  <td className="px-6 py-4">{expense.category}</td>
                  <td className="px-6 py-4">{formatCurrency(expense.amount)}</td>
                  <td className="text-right">
        <button
          onClick={() => handleEditClick(expense)}
          className="text-emerald-400 hover:text-emerald-300 transition-colors"
          title="Edit Expense"
        >
          <EditIcon size={18} />
        </button>
      </td>
                  <td className="px-6 py-4 text-right">
                    <Button variant="ghost" className="text-red-400 hover:bg-red-500/10" onClick={() => openDeleteConfirm(expense.id)}>Delete</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {showEditModal && editingExpense && (
  <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
    <div className="bg-gray-900 border border-white/10 rounded-xl p-6 w-full max-w-md">
      <h2 className="text-xl font-bold text-white mb-4">Edit Expense</h2>

      <div className="space-y-3">
        <div>
          <label className="text-gray-400 text-sm">Description</label>
          <input
            type="text"
            value={editingExpense.description}
            onChange={(e) =>
              setEditingExpense({ ...editingExpense, description: e.target.value })
            }
            className="w-full bg-gray-800 border border-white/10 rounded-md p-2 text-gray-200"
          />
        </div>
        <div>
          <label className="text-gray-400 text-sm">Amount</label>
          <input
            type="number"
            value={editingExpense.amount}
            onChange={(e) =>
              setEditingExpense({ ...editingExpense, amount: parseFloat(e.target.value) })
            }
            className="w-full bg-gray-800 border border-white/10 rounded-md p-2 text-gray-200"
          />
        </div>
        <div>
          <label className="text-gray-400 text-sm">Warehouse</label>
          <select
            value={editingExpense.warehouse_id || ''}
            onChange={(e) =>
              setEditingExpense({ ...editingExpense, warehouse_id: e.target.value })
            }
            className="w-full bg-gray-800 border border-white/10 rounded-md p-2 text-gray-200"
          >
            <option value="">Unassigned</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex justify-end space-x-2 mt-6">
        <Button
          variant="secondary"
          onClick={() => setShowEditModal(false)}
        >
          Cancel
        </Button>
        <Button
          onClick={async () => {
            try {
              await updateExpense(editingExpense.id, editingExpense);
              setShowEditModal(false);
              fetchData(); // refresh list
            } catch (err) {
              console.error('Failed to update expense:', err);
              alert('Failed to save changes');
            }
          }}
        >
          Save Changes
        </Button>

      </div>
    </div>
  </div>
)}


      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={'Add Expense'}>
        <ExpenseForm 
          onSave={handleSave} 
          onCancel={() => setIsModalOpen(false)}
        />
      </Modal>

      <ConfirmModal
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={handleDelete}
        title="Delete Expense"
        message="Are you sure you want to delete this expense record? This action cannot be undone."
      />

    </div>
  );
};

export default Expenses;
