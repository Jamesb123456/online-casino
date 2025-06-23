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
  variant = 'default'
}) => {
  // Define variant styles
  const variants = {
    default: {
      wrapper: 'bg-bg-card',
      header: 'bg-bg-elevated',
      row: 'bg-bg-card',
      rowAlt: 'bg-bg-elevated bg-opacity-50',
      hover: 'bg-primary bg-opacity-10',
      border: 'border-gray-800'
    },
    primary: {
      wrapper: 'bg-bg-card',
      header: 'bg-primary bg-opacity-20',
      row: 'bg-bg-card',
      rowAlt: 'bg-primary bg-opacity-5',
      hover: 'bg-primary bg-opacity-10',
      border: 'border-primary border-opacity-20'
    },
    accent: {
      wrapper: 'bg-bg-card',
      header: 'bg-accent bg-opacity-20',
      row: 'bg-bg-card',
      rowAlt: 'bg-accent bg-opacity-5',
      hover: 'bg-accent bg-opacity-10',
      border: 'border-accent border-opacity-20'
    }
  };

  const selectedVariant = variants[variant] || variants.default;

  // Define conditional classes
  const tableClasses = `
    min-w-full text-white
    ${bordered ? `border ${selectedVariant.border}` : ''}
    ${className}
  `;

  const headerClasses = `
    ${selectedVariant.header} text-left
    ${headerClassName}
  `;

  const bodyClasses = `
    ${selectedVariant.row}
    ${bodyClassName}
  `;

  return (
    <div className={`overflow-x-auto rounded-xl shadow-card ${selectedVariant.wrapper}`}>
      <table className={tableClasses}>
        <thead className={headerClasses}>
          <tr>
            {columns.map((column, index) => (
              <th
                key={index}
                className={`
                  py-4 px-6 font-semibold border-b ${selectedVariant.border} text-white
                  ${compact ? 'py-3 px-4 text-sm' : ''}
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
                ${striped && rowIndex % 2 === 0 ? selectedVariant.rowAlt : ''}
                ${hoverable ? `hover:${selectedVariant.hover}` : ''}
                transition-colors
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
                      py-4 px-6 border-b ${selectedVariant.border}
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
                className="py-8 px-6 text-center text-gray-400"
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