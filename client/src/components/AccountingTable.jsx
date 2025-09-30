import React from 'react';
import '../styles/accounting.css';

export default function AccountingTable({ columns, rows, onRowClick }) {
  return (
    <div className="acc-table-wrapper">
      <table className="acc-table">
        <thead>
          <tr>
            {columns.map(col => (
              <th key={col.key} style={{ width: col.width || 'auto' }}>{col.title}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={row.key || idx} onClick={() => onRowClick && onRowClick(row)}>
              {columns.map(col => (
                <td key={col.key} className={col.className || ''}>
                  {typeof col.render === 'function' ? col.render(row[col.key], row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}


