
import React from 'react';

interface CardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  description?: string;
}

const Card: React.FC<CardProps> = ({ title, value, icon, description }) => {
  return (
    <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-xl shadow-lg p-6">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-gray-300 uppercase tracking-wider">{title}</p>
          <p className="text-3xl font-bold text-white">{value}</p>
          {description && <p className="text-xs text-gray-400">{description}</p>}
        </div>
        <div className="bg-emerald-500/10 rounded-full p-3 text-emerald-400">
          {icon}
        </div>
      </div>
    </div>
  );
};

export default Card;