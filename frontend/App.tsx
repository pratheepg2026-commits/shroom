import React, { useState } from 'react';
import Navbar from './components/Navbar';
import Dashboard from './components/Dashboard';
import Subscriptions from './components/Subscriptions';
import Sales from './components/Sales';
import Products from './components/Products';
import ProfitLoss from './components/ProfitLoss';
import Expenses from './components/Expenses';
import UnitEconomics from './components/UnitEconomics';
import SalesReturn from './components/SalesReturn';
import Inventory from './components/Inventory';
import StockPrep from './components/StockPrep';
import Reporting from './components/Reporting';
import Customers from './components/Customers';
import { View, Status } from './types';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [viewState, setViewState] = useState<any>({});

  const navigate = (view: View, state: any = {}) => {
    setCurrentView(view);
    setViewState(state);
  };

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard navigate={navigate} />;
      case 'subscriptions':
        return <Subscriptions initialFilterStatus={viewState.filterStatus} />;
      case 'sales':
        return <Sales />;
      case 'salesReturn':
        return <SalesReturn />;
      case 'products':
        return <Products />;
      case 'pnl':
        return <ProfitLoss />;
      case 'expenses':
        return <Expenses />;
      case 'unitEconomics':
        return <UnitEconomics />;
      case 'inventory':
        return <Inventory />;
      case 'stockPrep':
        return <StockPrep />;
      case 'reporting':
        return <Reporting />;
      case 'customers':
        return <Customers />;
      default:
        return <Dashboard navigate={navigate} />;
    }
  };

  return (
    <div className="relative flex flex-col md:flex-row min-h-screen bg-gradient-to-br from-gray-900 via-black to-emerald-900/50 text-base-content font-sans overflow-hidden">
      {/* Animated background blobs */}
      <div className="absolute top-0 -left-4 w-72 h-72 bg-emerald-500 rounded-full mix-blend-lighten filter blur-xl opacity-20 animate-blob"></div>
      <div className="absolute top-0 -right-4 w-72 h-72 bg-green-500 rounded-full mix-blend-lighten filter blur-xl opacity-20 animate-blob animation-delay-2000"></div>
      <div className="absolute -bottom-8 left-20 w-72 h-72 bg-emerald-400 rounded-full mix-blend-lighten filter blur-xl opacity-20 animate-blob animation-delay-4000"></div>

      <Navbar currentView={currentView} setCurrentView={setCurrentView} />
      <main className="flex-1 p-4 sm:p-6 lg:p-8 z-10">
        {renderView()}
      </main>
    </div>
  );
};

export default App;