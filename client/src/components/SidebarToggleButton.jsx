import React from 'react';

export default function SidebarToggleButton({ sidebarVisible, onToggle }) {
  return (
    <button
      onClick={onToggle}
      className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"
      title={sidebarVisible ? 'Hide sidebar' : 'Show sidebar'}
    >
      {sidebarVisible ? (
        <span className="text-xs">Hide</span>
      ) : (
        <span className="text-xs">Show</span>
      )}
    </button>
  );
}


