import React from 'react';

const Table = ({
  columns = [],
  data = [],
  striped = true,
  hoverable = true,
  bordered = false,
  compact = false,
  className = '',
  headerClassName = '',
  bodyClassName = '',
  rowClassName = '',
}) => {
  // Define conditional classes
  const tableClasses = `
    min-w-full bg-gray-900 text-white
    ${bordered ? 'border border-gray-700' : ''}
    ${className}
  `;

  const headerClasses = `
    bg-gray-800 text-left
    ${headerClassName}
  `;

  const bodyClasses = `
    bg-gray-900
    ${bodyClassName}
  `;

  return (
    <div className="overflow-x-auto rounded-lg shadow">
      <table className={tableClasses}>
        <thead className={headerClasses}>
          <tr>
            {columns.map((column, index) => (
              <th
                key={index}
                className={`
                  py-3 px-4 font-semibold border-b border-gray-700
                  ${compact ? 'py-2 px-3 text-sm' : ''}
                `}
              >
                {column.header || column.accessor || ''}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className={bodyClasses}>
          {data.map((row, rowIndex) => (
            <tr
              key={rowIndex}
              className={`
                ${striped && rowIndex % 2 === 0 ? 'bg-gray-800' : ''}
                ${hoverable ? 'hover:bg-gray-700' : ''}
                ${rowClassName}
              `}
            >
              {columns.map((column, colIndex) => {
                const cellValue = column.render
                  ? column.render(row)
                  : row[column.accessor] || '';
                  
                return (
                  <td
                    key={colIndex}
                    className={`
                      py-3 px-4 border-b border-gray-700
                      ${compact ? 'py-2 px-3 text-sm' : ''}
                      ${column.className || ''}
                    `}
                  >
                    {cellValue}
                  </td>
                );
              })}
            </tr>
          ))}
          {data.length === 0 && (
            <tr>
              <td
                colSpan={columns.length}
                className="py-6 px-4 text-center text-gray-400"
              >
                No data available
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default Table;