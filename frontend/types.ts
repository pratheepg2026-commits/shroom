// Fix: Create types file to define data structures and resolve module resolution errors.
export type View = 'dashboard' | 'subscriptions' | 'sales' | 'wholesale' | 'products' | 'pnl' | 'expenses' | 'unitEconomics';

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

export interface Product {
  id: string;
  name: string;
  defaultPrice: number;
}

export interface Subscription {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  flatNo?: string;
  flatName?: string;
  plan: string; // Should correspond to a Product name
  status: Status;
  startDate: string; // YYYY-MM-DD
}

export interface SaleProduct {
  name: string;
  quantity: number;
  price: number;
}

export interface Sale {
  id: string;
  customerName: string;
  products: SaleProduct[];
  totalAmount: number;
  date: string; // YYYY-MM-DD
  status: 'Paid' | 'Unpaid';
}

export interface WholesaleSale {
    id: string;
    shopName: string;
    contact: string;
    address: string;
    products: SaleProduct[];
    totalAmount: number;
    date: string; // YYYY-MM-DD
    status: 'Paid' | 'Unpaid';
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