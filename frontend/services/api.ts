// services/api.ts
import {
  Product,
  Subscription,
  Sale,
  WholesaleSale,
  Expense,
  DashboardStats,
} from '../types';

const BASE_URL = 'https://shroommush.onrender.com/api';

const handleResponse = async (response: Response) => {
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
  }
  return response.json();
};

const apiRequest = async <T>(endpoint: string, options?: RequestInit): Promise<T> => {
  const response = await fetch(`${BASE_URL}${endpoint}`, options);
  return handleResponse(response);
};

// Products API
export const getProducts = (): Promise<Product[]> => apiRequest('/products');
export const addProduct = (productData: Omit<Product, 'id'>): Promise<Product> =>
  apiRequest('/products', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(productData),
  });
export const updateProduct = (updatedProduct: Product): Promise<Product> =>
  apiRequest(`/products/${updatedProduct.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updatedProduct),
  });
export const deleteProduct = (productId: string): Promise<void> =>
  apiRequest(`/products/${productId}`, { method: 'DELETE' });

// Subscriptions API
export const getSubscriptions = (): Promise<Subscription[]> => apiRequest('/subscriptions');
export const addSubscription = (subData: Omit<Subscription, 'id'>): Promise<Subscription> =>
  apiRequest('/subscriptions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(subData),
  });
export const updateSubscription = (updatedSub: Subscription): Promise<Subscription> =>
  apiRequest(`/subscriptions/${updatedSub.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updatedSub),
  });
export const deleteSubscription = (subId: string): Promise<void> =>
  apiRequest(`/subscriptions/${subId}`, { method: 'DELETE' });

// Sales API
export const getSales = (): Promise<Sale[]> => apiRequest('/sales');
export const addSale = (saleData: Omit<Sale, 'id'>): Promise<Sale> =>
  apiRequest('/sales', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(saleData),
  });
export const updateSale = (updatedSale: Sale): Promise<Sale> =>
  apiRequest(`/sales/${updatedSale.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updatedSale),
  });
export const deleteSale = (saleId: string): Promise<void> =>
  apiRequest(`/sales/${saleId}`, { method: 'DELETE' });

// Wholesale Sales API
export const getWholesaleSales = (): Promise<WholesaleSale[]> => apiRequest('/wholesale-sales');
export const addWholesaleSale = (saleData: Omit<WholesaleSale, 'id'>): Promise<WholesaleSale> =>
    apiRequest('/wholesale-sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(saleData),
    });
export const updateWholesaleSale = (updatedSale: WholesaleSale): Promise<WholesaleSale> =>
    apiRequest(`/wholesale-sales/${updatedSale.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedSale),
    });
export const deleteWholesaleSale = (saleId: string): Promise<void> =>
    apiRequest(`/wholesale-sales/${saleId}`, { method: 'DELETE' });

// Expenses API
export const getExpenses = (): Promise<Expense[]> => apiRequest('/expenses');
export const addExpense = (expenseData: Omit<Expense, 'id'>): Promise<Expense> =>
  apiRequest('/expenses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(expenseData),
  });
export const deleteExpense = (expenseId: string): Promise<void> =>
  apiRequest(`/expenses/${expenseId}`, { method: 'DELETE' });

// Dashboard API
export const getDashboardStats = (): Promise<DashboardStats> => apiRequest('/dashboard-stats');
