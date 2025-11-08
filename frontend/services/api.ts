// services/api.ts
import {
  Product,
  Subscription,
  Sale,
  WholesaleSale,
  Expense,
  DashboardStats,
  Warehouse,
  InventoryItem,
  SalesReturn,
  Customer,
} from '../types';

const BASE_URL = 'https://shroommush.onrender.com/api'; // Base URL for the new Flask backend

const handleResponse = async (response: Response) => {
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
  }
  return response.json();
};

const apiRequest = async <T>(endpoint: string, options?: RequestInit): Promise<T> => {
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });
  return handleResponse(response);
};


// Products API
export const getProducts = (): Promise<Product[]> => apiRequest('/api/products');
export const addProduct = (productData: Omit<Product, 'id'>): Promise<Product> => apiRequest('/api/products', { method: 'POST', body: JSON.stringify(productData) });
export const updateProduct = (updatedProduct: Product): Promise<Product> => apiRequest(`/api/products/${updatedProduct.id}`, { method: 'PUT', body: JSON.stringify(updatedProduct) });
export const deleteProduct = (productId: string): Promise<void> => apiRequest(`/api/products/${productId}`, { method: 'DELETE' });

// Subscriptions API
export const getSubscriptions = (): Promise<Subscription[]> => apiRequest('/api/subscriptions');
export const addSubscription = (subData: Omit<Subscription, 'id' | 'invoiceNumber'>): Promise<Subscription> => apiRequest('/api/subscriptions', { method: 'POST', body: JSON.stringify(subData) });
export const updateSubscription = (updatedSub: Subscription): Promise<Subscription> => apiRequest(`/api/subscriptions/${updatedSub.id}`, { method: 'PUT', body: JSON.stringify(updatedSub) });
export const deleteSubscription = (subId: string): Promise<void> => apiRequest(`/api/subscriptions/${subId}`, { method: 'DELETE' });

// Sales API
export const getSales = (): Promise<Sale[]> => apiRequest('/api/sales');
export const addSale = (saleData: any): Promise<Sale> => apiRequest('/api/sales', { method: 'POST', body: JSON.stringify(saleData) });
export const updateSale = (updatedSaleData: any): Promise<Sale> => apiRequest(`/api/sales/${updatedSaleData.id}`, { method: 'PUT', body: JSON.stringify(updatedSaleData) });
export const deleteSale = (saleId: string): Promise<void> => apiRequest(`/api/sales/${saleId}`, { method: 'DELETE' });

// Wholesale Sales API
export const getWholesaleSales = (): Promise<WholesaleSale[]> => apiRequest('/api/wholesale-sales');
export const addWholesaleSale = (saleData: any): Promise<WholesaleSale> => apiRequest('/api/wholesale-sales', { method: 'POST', body: JSON.stringify(saleData) });
export const updateWholesaleSale = (updatedSaleData: any): Promise<WholesaleSale> => apiRequest(`/api/wholesale-sales/${updatedSaleData.id}`, { method: 'PUT', body: JSON.stringify(updatedSaleData) });
export const deleteWholesaleSale = (saleId: string): Promise<void> => apiRequest(`/api/wholesale-sales/${saleId}`, { method: 'DELETE' });

// Expenses API
export const getExpenses = (): Promise<Expense[]> => apiRequest('/api/expenses');
export const addExpense = (expenseData: Omit<Expense, 'id'>): Promise<Expense> => apiRequest('/api/expenses', { method: 'POST', body: JSON.stringify(expenseData) });
export const deleteExpense = (expenseId: string): Promise<void> => apiRequest(`/api/expenses/${expenseId}`, { method: 'DELETE' });

// Sales Returns API
export const getSalesReturns = (): Promise<SalesReturn[]> => apiRequest('/api/sales-returns');
export const addSalesReturn = (returnData: Omit<SalesReturn, 'id'>): Promise<SalesReturn> => apiRequest('/api/sales-returns', { method: 'POST', body: JSON.stringify(returnData) });

// Dashboard API
export const getDashboardStats = (): Promise<DashboardStats> => apiRequest('/api/dashboard-stats');

// Warehouse API
export const getWarehouses = (): Promise<Warehouse[]> => apiRequest('/api/warehouses');
export const addWarehouse = (warehouseData: { name: string }): Promise<Warehouse> => apiRequest('/api/warehouses', { method: 'POST', body: JSON.stringify(warehouseData) });
export const updateWarehouse = (updatedWarehouse: Warehouse): Promise<Warehouse> => apiRequest(`/api/warehouses/${updatedWarehouse.id}`, { method: 'PUT', body: JSON.stringify(updatedWarehouse) });
export const deleteWarehouse = (warehouseId: string): Promise<void> => apiRequest(`/api/warehouses/${warehouseId}`, { method: 'DELETE' });

// Inventory API
export const getInventory = (): Promise<InventoryItem[]> => apiRequest('/api/inventory');
export const addInventoryStock = (stockData: { productId: string; warehouseId: string; quantity: number }): Promise<InventoryItem> => apiRequest('/api/inventory/stock', { method: 'POST', body: JSON.stringify(stockData) });

// Customer Hub API
export const getCustomers = (): Promise<Customer[]> => apiRequest('/api/customers');
