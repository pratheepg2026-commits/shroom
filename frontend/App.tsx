
import React, { useState } from 'react';
import Navbar from './components/Navbar';
import Dashboard from './components/Dashboard';
import Subscriptions from './components/Subscriptions';
import Sales from './components/Sales';
import Products from './components/Products';
import ProfitLoss from './components/ProfitLoss';
import Expenses from './components/Expenses';
import UnitEconomics from './components/UnitEconomics';
import Wholesale from './components/Wholesale';
import { View } from './types';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>('dashboard');

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard />;
      case 'subscriptions':
        return <Subscriptions />;
      case 'sales':
        return <Sales />;
      case 'wholesale':
        return <Wholesale />;
      case 'products':
        return <Products />;
      case 'pnl':
        return <ProfitLoss />;
      case 'expenses':
        return <Expenses />;
      case 'unitEconomics':
        return <UnitEconomics />;
      default:
        return <Dashboard />;
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