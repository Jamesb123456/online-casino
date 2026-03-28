import React from 'react';

const LandminesBoard = ({ 
  grid, 
  revealedCells, 
  onCellClick, 
  isGameActive,
  gameOver,
  loading
}) => {
  // Grid size (5x5)
  const gridSize = 5;
  
  // Create an empty grid if none provided
  const displayGrid = grid || Array(gridSize).fill().map(() => Array(gridSize).fill(false));
  
  // Parse revealed cells from string format "row,col" to array of objects
  const parsedRevealedCells = (revealedCells || []).map(cell => {
    const [row, col] = cell.split(',').map(Number);
    return { row, col };
  });
  
  // Check if a cell is revealed
  const isCellRevealed = (row, col) => {
    return parsedRevealedCells.some(cell => cell.row === row && cell.col === col);
  };
  
  // Determine if a revealed cell has a mine or diamond
  const getCellContent = (row, col) => {
    // Only show content if the cell is revealed or game is over
    if (isCellRevealed(row, col) || gameOver) {
      return displayGrid[row][col] ? 
        <span role="img" aria-label="mine" className="text-3xl">💣</span> : 
        <span role="img" aria-label="diamond" className="text-3xl">💎</span>;
    }
    return null;
  };
  
  // Get cell status class: 
  // - revealed-mine: red background
  // - revealed-diamond: green background
  // - hidden: default background
  const getCellClass = (row, col) => {
    if (gameOver && displayGrid[row][col]) {
      return 'bg-status-error/80 hover:bg-status-error';
    }

    if (isCellRevealed(row, col)) {
      return displayGrid[row][col]
        ? 'bg-status-error/80 hover:bg-status-error'
        : 'bg-status-success/80 hover:bg-status-success';
    }

    return 'bg-bg-surface hover:bg-bg-elevated border border-border';
  };
  
  return (
    <div className="flex flex-col items-center justify-center w-full">
      <div className="grid grid-cols-5 gap-2 w-full max-w-md mx-auto">
        {Array(gridSize).fill().map((_, row) => (
          Array(gridSize).fill().map((_, col) => (
            <button
              key={`${row}-${col}`}
              className={`
                aspect-square flex items-center justify-center 
                rounded-md shadow-lg cursor-pointer
                transition duration-150 ease-in-out transform hover:scale-[0.98] active:scale-95
                ${getCellClass(row, col)}
                ${!isGameActive || isCellRevealed(row, col) ? 'cursor-default' : 'cursor-pointer'}
                ${loading ? 'opacity-50' : 'opacity-100'}
              `}
              onClick={() => {
                // Only allow clicking if game is active, cell is not revealed, and not loading
                if (isGameActive && !isCellRevealed(row, col) && !loading) {
                  onCellClick(row, col);
                }
              }}
              disabled={!isGameActive || isCellRevealed(row, col) || loading}
            >
              <div className={`transition-transform duration-200 ${isCellRevealed(row, col) ? 'scale-100' : ''}`}>
                {getCellContent(row, col)}
              </div>
            </button>
          ))
        ))}
      </div>
    </div>
  );
};

export default LandminesBoard;
