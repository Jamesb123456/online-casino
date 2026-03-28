import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Table from '@/components/ui/Table';

const sampleColumns = [
  { header: 'Name', accessor: 'name' },
  { header: 'Email', accessor: 'email' },
  { header: 'Role', accessor: 'role' },
];

const sampleData = [
  { name: 'Alice', email: 'alice@example.com', role: 'Admin' },
  { name: 'Bob', email: 'bob@example.com', role: 'User' },
  { name: 'Charlie', email: 'charlie@example.com', role: 'Moderator' },
];

describe('Table', () => {
  // --- Basic rendering ---

  it('should render a table element', () => {
    render(<Table columns={sampleColumns} data={sampleData} />);
    expect(screen.getByRole('table')).toBeInTheDocument();
  });

  it('should render column headers correctly', () => {
    render(<Table columns={sampleColumns} data={sampleData} />);
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Email')).toBeInTheDocument();
    expect(screen.getByText('Role')).toBeInTheDocument();
  });

  it('should use accessor as header fallback when header is not provided', () => {
    const columns = [{ accessor: 'username' }];
    const data = [{ username: 'testuser' }];
    render(<Table columns={columns} data={data} />);
    expect(screen.getByText('username')).toBeInTheDocument();
  });

  it('should render data rows correctly', () => {
    render(<Table columns={sampleColumns} data={sampleData} />);
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('alice@example.com')).toBeInTheDocument();
    expect(screen.getByText('Admin')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('Charlie')).toBeInTheDocument();
  });

  it('should render the correct number of rows', () => {
    render(<Table columns={sampleColumns} data={sampleData} />);
    const rows = screen.getAllByRole('row');
    // 1 header row + 3 data rows
    expect(rows.length).toBe(4);
  });

  // --- Custom render function ---

  it('should use custom render function for columns', () => {
    const columns = [
      { header: 'Name', accessor: 'name' },
      {
        header: 'Status',
        render: (row) => <span data-testid={`status-${row.name}`}>{row.active ? 'Active' : 'Inactive'}</span>,
      },
    ];
    const data = [
      { name: 'Alice', active: true },
      { name: 'Bob', active: false },
    ];
    render(<Table columns={columns} data={data} />);
    expect(screen.getByTestId('status-Alice').textContent).toBe('Active');
    expect(screen.getByTestId('status-Bob').textContent).toBe('Inactive');
  });

  // --- Empty data ---

  it('should render "No data available" when data is empty', () => {
    render(<Table columns={sampleColumns} data={[]} />);
    expect(screen.getByText('No data available')).toBeInTheDocument();
  });

  it('should render "No data available" with default empty data', () => {
    render(<Table columns={sampleColumns} />);
    expect(screen.getByText('No data available')).toBeInTheDocument();
  });

  it('should span "No data available" across all columns', () => {
    render(<Table columns={sampleColumns} data={[]} />);
    const emptyCell = screen.getByText('No data available');
    expect(emptyCell).toHaveAttribute('colspan', String(sampleColumns.length));
  });

  // --- Striped ---

  it('should apply striped styling by default (striped=true)', () => {
    const { container } = render(<Table columns={sampleColumns} data={sampleData} />);
    const dataRows = container.querySelectorAll('tbody tr');
    // First row (index 0) should have the alt background
    expect(dataRows[0].className).toContain('bg-bg-base');
    // Second row (index 1) should not have the alt background
    expect(dataRows[1].className).not.toContain('bg-bg-base');
  });

  it('should not apply striped styling when striped is false', () => {
    const { container } = render(
      <Table columns={sampleColumns} data={sampleData} striped={false} />
    );
    const dataRows = container.querySelectorAll('tbody tr');
    // No row should have alternating background from striping
    for (const row of dataRows) {
      expect(row.className).not.toContain('bg-bg-base');
    }
  });

  // --- Hoverable ---

  it('should apply hover effect by default (hoverable=true)', () => {
    const { container } = render(<Table columns={sampleColumns} data={sampleData} />);
    const dataRows = container.querySelectorAll('tbody tr');
    expect(dataRows[0].className).toContain('hover:bg-bg-elevated/50');
  });

  it('should not apply hover effect when hoverable is false', () => {
    const { container } = render(
      <Table columns={sampleColumns} data={sampleData} hoverable={false} />
    );
    const dataRows = container.querySelectorAll('tbody tr');
    expect(dataRows[0].className).not.toContain('hover:bg-bg-elevated/50');
  });

  // --- Bordered ---

  it('should apply border classes when bordered is true', () => {
    render(<Table columns={sampleColumns} data={sampleData} bordered />);
    const table = screen.getByRole('table');
    expect(table.className).toContain('border');
  });

  it('should not apply border class by default (bordered=false)', () => {
    render(<Table columns={sampleColumns} data={sampleData} />);
    const table = screen.getByRole('table');
    // The table always has the class string, but 'border' (standalone) should
    // not appear when bordered is false. The table has border-border in cells
    // but the table element itself should not have the 'border' class.
    const classList = table.className.split(/\s+/).filter((c) => c === 'border');
    expect(classList).toHaveLength(0);
  });

  // --- Compact ---

  it('should apply compact classes when compact is true', () => {
    const { container } = render(
      <Table columns={sampleColumns} data={sampleData} compact />
    );
    // Header cells should have compact classes
    const headerCells = container.querySelectorAll('thead th');
    expect(headerCells[0].className).toContain('py-3');
    expect(headerCells[0].className).toContain('px-4');
    expect(headerCells[0].className).toContain('text-xs');

    // Data cells should have compact classes
    const dataCells = container.querySelectorAll('tbody td');
    expect(dataCells[0].className).toContain('py-2');
    expect(dataCells[0].className).toContain('px-3');
    expect(dataCells[0].className).toContain('text-sm');
  });

  it('should use normal padding when compact is false', () => {
    const { container } = render(<Table columns={sampleColumns} data={sampleData} />);
    const headerCells = container.querySelectorAll('thead th');
    expect(headerCells[0].className).toContain('py-4');
    expect(headerCells[0].className).toContain('px-6');
  });

  // --- Custom rowClassName ---

  it('should apply custom rowClassName to data rows', () => {
    const { container } = render(
      <Table columns={sampleColumns} data={sampleData} rowClassName="custom-row" />
    );
    const dataRows = container.querySelectorAll('tbody tr');
    for (const row of dataRows) {
      expect(row.className).toContain('custom-row');
    }
  });

  // --- Variants ---

  const allVariants = ['default', 'primary', 'accent'];

  it.each(allVariants)('should render variant "%s" without errors', (variant) => {
    render(<Table columns={sampleColumns} data={sampleData} variant={variant} />);
    expect(screen.getByRole('table')).toBeInTheDocument();
  });

  it('should apply default variant styles', () => {
    const { container } = render(
      <Table columns={sampleColumns} data={sampleData} variant="default" />
    );
    const wrapper = container.firstChild;
    expect(wrapper.className).toContain('bg-bg-card');
    const thead = container.querySelector('thead');
    expect(thead.className).toContain('bg-bg-elevated');
  });

  it('should apply primary variant styles', () => {
    const { container } = render(
      <Table columns={sampleColumns} data={sampleData} variant="primary" />
    );
    const thead = container.querySelector('thead');
    expect(thead.className).toContain('bg-accent-gold/10');
  });

  it('should apply accent variant styles', () => {
    const { container } = render(
      <Table columns={sampleColumns} data={sampleData} variant="accent" />
    );
    const thead = container.querySelector('thead');
    expect(thead.className).toContain('bg-accent-purple/10');
  });

  // --- Custom className ---

  it('should apply custom className to the table element', () => {
    render(
      <Table columns={sampleColumns} data={sampleData} className="my-table" />
    );
    expect(screen.getByRole('table').className).toContain('my-table');
  });

  // --- Custom headerClassName and bodyClassName ---

  it('should apply headerClassName to the thead', () => {
    const { container } = render(
      <Table columns={sampleColumns} data={sampleData} headerClassName="custom-header" />
    );
    const thead = container.querySelector('thead');
    expect(thead.className).toContain('custom-header');
  });

  it('should apply bodyClassName to the tbody', () => {
    const { container } = render(
      <Table columns={sampleColumns} data={sampleData} bodyClassName="custom-body" />
    );
    const tbody = container.querySelector('tbody');
    expect(tbody.className).toContain('custom-body');
  });

  // --- Wrapper ---

  it('should have an overflow-x-auto wrapper', () => {
    const { container } = render(<Table columns={sampleColumns} data={sampleData} />);
    const wrapper = container.firstChild;
    expect(wrapper.className).toContain('overflow-x-auto');
    expect(wrapper.className).toContain('rounded-xl');
    expect(wrapper.className).toContain('shadow-card');
  });

  // --- Column className ---

  it('should apply column className to data cells', () => {
    const columns = [
      { header: 'Name', accessor: 'name', className: 'font-bold' },
      { header: 'Email', accessor: 'email' },
    ];
    const data = [{ name: 'Alice', email: 'alice@example.com' }];
    const { container } = render(<Table columns={columns} data={data} />);
    const firstCell = container.querySelector('tbody td');
    expect(firstCell.className).toContain('font-bold');
  });

  // --- Default props ---

  it('should render with empty columns and data by default', () => {
    render(<Table />);
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByText('No data available')).toBeInTheDocument();
  });
});
