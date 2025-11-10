// Fix: Create types file to define data structures and resolve module resolution errors.
export type View = 'dashboard' | 'subscriptions' | 'sales' | 'salesReturn' | 'products' | 'pnl' | 'expenses' | 'unitEconomics' | 'inventory' | 'stockPrep' | 'reporting' | 'customers';

export enum Status {
  ACTIVE = 'Active',
  PAUSED = 'Paused',
  CANCELLED = 'Cancelled',
}

export enum ExpenseCategory {
  RAW_MATERIALS = 'Raw Materials',
  MARKETING = 'Marketing',
  UTILITIES = 'Utilities',
  RENT = 'Rent',
  SALARIES = 'Salaries',
  MISC = 'Miscellaneous',
}

export type SaleStatus = 'Paid' | 'Unpaid' | 'GPay' | 'Cash' | 'Free';

export interface Product {
  id: string;
  name: string;
  defaultPrice: number;
  unit: string;
}

export interface Subscription {
    id: string;
    invoiceNumber: string;
    name: string;
    email: string;
    phone: string;
    address: string;
    flatNo: string;
    flatName?: string;
    plan: string;
    status: Status;
    startDate: string;
    preferredDeliveryDay?: string;
    boxesPerMonth?: number;  // NEW
}


export interface SaleProduct {
  name: string;
  quantity: number;
  price: number;
}

export interface Sale {
  id: string;
  invoiceNumber: string;
  customerName: string;
  products: SaleProduct[];
  totalAmount: number;
  date: string; // YYYY-MM-DD
  status: SaleStatus;
}

export interface WholesaleSale {
    id: string;
    invoiceNumber: string;
    shopName: string;
    contact: string;
    address: string;
    products: SaleProduct[];
    totalAmount: number;
    date: string; // YYYY-MM-DD
    status: SaleStatus;
}

export interface Expense {
    id: string;
    category: ExpenseCategory;
    description: string;
    amount: number;
    date: string; // YYYY-MM-DD
}

export interface DashboardStats {
    currentMonthSales: number;
    currentMonthRetailSales: number;
    currentMonthWholesaleSales: number;
    activeSubscriptions: number;
    currentMonthExpenses: number;
    currentMonthProfit: number;
    salesByDay: {
        day: number;
        sales: number;
        retailOrders: number;
        wholesaleOrders: number;
    }[];
    expenseBreakdown: {
        name: string;
        value: number;
    }[];
}

export interface Warehouse {
    id: string;
    name: string;
}

export interface InventoryItem {
    id: string;
    productId: string;
    warehouseId: string;
    quantity: number;
    productName?: string;
    warehouseName?: string;
}

export interface SalesReturnProduct {
    productId: string;
    quantity: number;
    
}

export interface SalesReturn {
    id: string;
    SaleId: string;
    originalInvoiceNumber: string;
    customerName: string; // Could be customer or shop name
    returnedProducts: SalesReturnProduct[];
    totalRefundAmount: number;
    date: string; // YYYY-MM-DD
}

// Types for Customer Hub
export type CustomerType = 'Subscription' | 'Retail' | 'Wholesale';

export type Transaction = 
  (Sale & { transactionType: 'Retail' }) | 
  (WholesaleSale & { transactionType: 'Wholesale' }) | 
  (Subscription & { transactionType: 'Subscription' });

export interface Customer {
    id: string; 
    name: string;
    types: Set<CustomerType>; 
    contact: {
        email: string;
        phone: string;
        address: string;
    };
    totalSpent: number;
    firstActivityDate: string;
    lastActivityDate: string;
    lastSaleDate?: string;
    transactionHistory: Transaction[];
}

// Types for Reporting
export interface PnlAnalysisData {
    type: 'pnl';
    totalRevenue: number;
    totalExpenses: number;
    totalReturns: number;
    netProfit: number;
    expenseBreakdown: { name: ExpenseCategory; value: number }[];
    profitTrend: { date: string; profit: number }[];
}
