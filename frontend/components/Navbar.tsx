import React, { useState } from 'react';
import { View } from '../types';

interface NavbarProps {
  currentView: View;
  setCurrentView: (view: View) => void;
}

const NavItem: React.FC<{
  view: View;
  label: string;
  icon: React.ReactNode;
  currentView: View;
  onClick: (view: View) => void;
  isExpanded: boolean;
}> = ({ view, label, icon, currentView, onClick, isExpanded }) => (
  <button
    onClick={() => onClick(view)}
    className={`flex items-center w-full px-4 py-3 my-1 rounded-lg transition-colors duration-200 ${
      currentView === view
        ? 'bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-lg'
        : 'text-gray-300 hover:bg-white/10 hover:text-white'
    }`}
  >
    {icon}
    <span className={`ml-4 transition-opacity duration-300 ${isExpanded ? 'opacity-100' : 'opacity-0 md:opacity-100'}`}>{label}</span>
  </button>
);


const Navbar: React.FC<NavbarProps> = ({ currentView, setCurrentView }) => {
  const [isMobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleNavClick = (view: View) => {
    setCurrentView(view);
    setMobileMenuOpen(false);
  }

  const navContent = (isExpanded: boolean) => (
    <>
      <div className="flex items-center justify-center h-20 border-b border-white/10">
          <MushroomIcon className="h-8 w-8 text-emerald-400" />
          <h1 className={`text-2xl font-bold ml-2 transition-opacity duration-300 text-white ${isExpanded ? 'opacity-100' : 'opacity-0 md:opacity-100'}`}>SHROOMMUSH</h1>
      </div>
      <nav className="flex-grow p-4">
        <NavItem view="dashboard" label="Dashboard" icon={<DashboardIcon />} currentView={currentView} onClick={handleNavClick} isExpanded={isExpanded} />
        <NavItem view="subscriptions" label="Subscriptions" icon={<SubscriptionIcon />} currentView={currentView} onClick={handleNavClick} isExpanded={isExpanded} />
        <NavItem view="sales" label="Sales" icon={<SalesIcon />} currentView={currentView} onClick={handleNavClick} isExpanded={isExpanded} />
        <NavItem view="wholesale" label="Wholesale" icon={<WholesaleIcon />} currentView={currentView} onClick={handleNavClick} isExpanded={isExpanded} />
        <NavItem view="products" label="Products" icon={<ProductsIcon />} currentView={currentView} onClick={handleNavClick} isExpanded={isExpanded} />
        <NavItem view="pnl" label="P&L" icon={<ProfitLossIcon />} currentView={currentView} onClick={handleNavClick} isExpanded={isExpanded} />
        <NavItem view="expenses" label="Expenses" icon={<ExpenseIcon />} currentView={currentView} onClick={handleNavClick} isExpanded={isExpanded} />
        <NavItem view="unitEconomics" label="Unit Economics" icon={<UnitEconomicsIcon />} currentView={currentView} onClick={handleNavClick} isExpanded={isExpanded} />
      </nav>
    </>
  );

  return (
    <>
      {/* Mobile Header */}
      <div className="md:hidden flex justify-between items-center p-4 bg-black/30 backdrop-blur-lg z-20">
        <div className="flex items-center">
            <MushroomIcon className="h-8 w-8 text-emerald-400" />
            <h1 className="text-2xl font-bold ml-2 text-white">SHROOMMUSH</h1>
        </div>
        <button onClick={() => setMobileMenuOpen(!isMobileMenuOpen)} className="text-white">
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
          </svg>
        </button>
      </div>
       
      {/* Mobile Sidebar */}
      <div className={`fixed inset-0 z-40 transform ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} transition-transform duration-300 ease-in-out md:hidden`}>
         <div className="w-64 h-full bg-black/50 shadow-lg backdrop-blur-xl flex flex-col border-r border-white/10">
            {navContent(true)}
         </div>
         <div className="flex-1" onClick={() => setMobileMenuOpen(false)}></div>
      </div>
      
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-black/30 backdrop-blur-lg text-white transition-all duration-300 border-r border-white/10">
        {navContent(true)}
      </aside>
    </>
  );
};

// Icons
const MushroomIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
        <path d="M12 2C9.24 2 7 4.24 7 7c0 1.68.81 3.15 2.05 4.07C6.01 11.53 4 14.49 4 18c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2 0-3.51-2.01-6.47-5.05-6.93C16.19 10.15 17 8.68 17 7c0-2.76-2.24-5-5-5zM10 12.1c-1.14-.6-2-1.78-2-3.1 0-1.65 1.35-3 3-3s3 1.35 3 3c0 1.32-.86 2.5-2 3.1V18h-2v-5.9z"/>
    </svg>
);
const DashboardIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
);
const SubscriptionIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
);
const SalesIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
);
const WholesaleIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m-1 4h1m5-4h1m-1 4h1m-1-4h1m-1 4h1" /></svg>
);
const ProductsIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-14L4 7m0 10l8 4m0 0l8-4m-8 4V7" /></svg>
);
const ProfitLossIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" /></svg>
);
const ExpenseIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
);
const UnitEconomicsIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h3m-3-10h.01M9 17h3m3 0h.01M12 3a1 1 0 00-1 1v1h2V4a1 1 0 00-1-1zM5.05 6.05a1 1 0 00-1.414 1.414l1.414-1.414zM18.95 6.05a1 1 0 001.414 1.414l-1.414-1.414zM5 12a1 1 0 00-1 1v1h2v-1a1 1 0 00-1-1zM19 12a1 1 0 00-1 1v1h2v-1a1 1 0 00-1-1zM5.05 17.95a1 1 0 001.414 1.414l-1.414-1.414zM18.95 17.95a1 1 0 00-1.414 1.414l1.414-1.414z" /></svg>
);

export default Navbar;