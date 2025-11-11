const BASE_URL = import.meta.env.VITE_API_URL || 'https://shroommush.onrender.com/api';

const apiRequest = async <T>(endpoint: string, options?: RequestInit): Promise<T> => {
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });

  if (response.status === 204) {
    return undefined as T;
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(`HTTP error! status: ${response.status}, message: ${JSON.stringify(errorData)}`);
  }

  return response.json();
};

export const getProducts = (): Promise<any[]> => apiRequest('/products');
export const addProduct = (product: any): Promise<any> => apiRequest('/products', { method: 'POST', body: JSON.stringify(product) });
export const updateProduct = (product: any): Promise<any> => apiRequest(`/products/${product.id}`, { method: 'PUT', body: JSON.stringify(product) });
export const deleteProduct = (id: string): Promise<void> => apiRequest(`/products/${id}`, { method: 'DELETE' });

export const getSubscriptions = (): Promise<any[]> => apiRequest('/subscriptions');
export const addSubscription = (subscription: any): Promise<any> => apiRequest('/subscriptions', { method: 'POST', body: JSON.stringify(subscription) });
export const updateSubscription = (subscription: any): Promise<any> => apiRequest(`/subscriptions/${subscription.id}`, { method: 'PUT', body: JSON.stringify(subscription) });
export const deleteSubscription = (id: string): Promise<void> => apiRequest(`/subscriptions/${id}`, { method: 'DELETE' });

export const getSales = (): Promise<any[]> => apiRequest('/sales');
export const addSale = (sale: any): Promise<any> => apiRequest('/sales', { method: 'POST', body: JSON.stringify(sale) });
export const updateSale = (sale: any): Promise<any> => apiRequest(`/sales/${sale.id}`, { method: 'PUT', body: JSON.stringify(sale) });
export const deleteSale = (id: string): Promise<void> => apiRequest(`/sales/${id}?warehouseId=default`, { method: 'DELETE' });

export const getWholesaleSales = (): Promise<any[]> => apiRequest('/wholesale-sales');
export const addWholesaleSale = (sale: any): Promise<any> => apiRequest('/wholesale-sales', { method: 'POST', body: JSON.stringify(sale) });
export const updateWholesaleSale = (sale: any): Promise<any> => apiRequest(`/wholesale-sales/${sale.id}`, { method: 'PUT', body: JSON.stringify(sale) });
export const deleteWholesaleSale = (id: string): Promise<void> => apiRequest(`/wholesale-sales/${id}?warehouseId=default`, { method: 'DELETE' });

export const getExpenses = (): Promise<any[]> => apiRequest('/expenses');
export const addExpense = (expense: any): Promise<any> => apiRequest('/expenses', { method: 'POST', body: JSON.stringify(expense) });
export const deleteExpense = (id: string): Promise<void> => apiRequest(`/expenses/${id}`, { method: 'DELETE' });
export const updateInventory = async (item: InventoryItem): Promise<InventoryItem> => {
  const response = await fetch(`${API_BASE_URL}/api/inventory/${item.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(item)
  });
  if (!response.ok) throw new Error('Failed to update inventory');
  return response.json();
};

export const deleteInventory = async (id: string): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/api/inventory/${id}`, {
    method: 'DELETE'
  });
  if (!response.ok) throw new Error('Failed to delete inventory');
};

export const getWarehouses = (): Promise<any[]> => apiRequest('/warehouses');
export const addWarehouse = (warehouse: any): Promise<any> => apiRequest('/warehouses', { method: 'POST', body: JSON.stringify(warehouse) });
export const updateWarehouse = (warehouse: any): Promise<any> => apiRequest(`/warehouses/${warehouse.id}`, { method: 'PUT', body: JSON.stringify(warehouse) });
export const deleteWarehouse = (id: string): Promise<void> => apiRequest(`/warehouses/${id}`, { method: 'DELETE' });

export const getInventory = (): Promise<any[]> => apiRequest('/inventory');
export const addStock = (data: any): Promise<any> => apiRequest('/inventory/stock', { method: 'POST', body: JSON.stringify(data) });
export const addInventoryStock = addStock;

export const getSalesReturns = (): Promise<any[]> => apiRequest('/sales-returns');
export const addSalesReturn = (data: any): Promise<any> => apiRequest('/sales-returns', { method: 'POST', body: JSON.stringify(data) });

export const getDashboardStats = (): Promise<any> => apiRequest('/dashboard-stats');
export const getCustomers = (): Promise<any[]> => apiRequest('/customers');
export const getStockPrep = (): Promise<any[]> => apiRequest('/stock-prep');
// export const getStockPrep = async () => {
//   const response = await fetch(`${API_BASE_URL}/api/stock-prep`);
//   if (!response.ok) {
//     throw new Error(`HTTP error! status: ${response.status}`);
//   }
//   return response.json();
// };
// Add these functions to api.ts

export const updateInventory = async (item: InventoryItem): Promise<InventoryItem> => {
  const response = await fetch(`${API_BASE_URL}/api/inventory/${item.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(item)
  });
  if (!response.ok) throw new Error('Failed to update inventory');
  return response.json();
};

export const deleteInventory = async (id: string): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/api/inventory/${id}`, {
    method: 'DELETE'
  });
  if (!response.ok) throw new Error('Failed to delete inventory');
};

