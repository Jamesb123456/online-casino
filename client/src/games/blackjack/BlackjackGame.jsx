import React, { useState, useEffect, useCallback, useContext } from 'react';
import { AuthContext } from '../../contexts/AuthContext';
import BlackjackTable from './BlackjackTable';
import BlackjackBettingPanel from './BlackjackBettingPanel';
import blackjackSocketService from '../../services/socket/blackjackSocketService';

/**
 * Main component for the Blackjack game
 */
const BlackjackGame = () => {
  const { user, updateUserBalance } = useContext(AuthContext);
  
  // Game state
  const [playerHand, setPlayerHand] = useState([]);
  const [dealerHand, setDealerHand] = useState([]);
  const [gamePhase, setGamePhase] = useState('betting'); // betting, playerTurn, dealerTurn, complete
  const [currentBet, setCurrentBet] = useState(0);
  const [balance, setBalance] = useState(user?.balance || 0);
  const [gameResult, setGameResult] = useState(null); // player, dealer, push
  const [winAmount, setWinAmount] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [useMock, setUseMock] = useState(false); // For testing without backend

  // Initialize the game and socket connection
  useEffect(() => {
    if (user) {
      setBalance(user.balance);
    }
    
    // Connect to socket
    blackjackSocketService.connect();
    
    // Event listeners
    blackjackSocketService.onGameStarted(handleGameStarted);
    blackjackSocketService.onCardDealt(handleCardDealt);
    blackjackSocketService.onPlayerTurn(handlePlayerTurn);
    blackjackSocketService.onDealerTurn(handleDealerTurn);
    blackjackSocketService.onGameResult(handleGameResult);
    blackjackSocketService.onBalanceUpdate(handleBalanceUpdate);
    blackjackSocketService.onError(handleError);
    
    return () => {
      // Clean up on component unmount
      blackjackSocketService.disconnect();
    };
  }, [user]);

  // Event handlers
  const handleGameStarted = useCallback((data) => {
    const { playerCards, dealerCards } = data;
    setPlayerHand(playerCards);
    setDealerHand(dealerCards);
    setGamePhase('playerTurn');
    setIsProcessing(false);
  }, []);

  const handleCardDealt = useCallback((data) => {
    const { card, isPlayer } = data;
    
    if (isPlayer) {
      setPlayerHand(prevHand => [...prevHand, card]);
    } else {
      setDealerHand(prevHand => [...prevHand, card]);
    }
  }, []);

  const handlePlayerTurn = useCallback(() => {
    setGamePhase('playerTurn');
    setIsProcessing(false);
  }, []);

  const handleDealerTurn = useCallback(() => {
    setGamePhase('dealerTurn');
  }, []);

  const handleGameResult = useCallback((data) => {
    const { result, playerCards, dealerCards, winnings } = data;
    
    // Update hands if provided
    if (playerCards) setPlayerHand(playerCards);
    if (dealerCards) setDealerHand(dealerCards);
    
    setGameResult(result);
    setWinAmount(winnings);
    setGamePhase('complete');
    setIsProcessing(false);
    
    // Automatically reset after delay
    setTimeout(() => {
      resetGame();
    }, 5000);
  }, []);

  const handleBalanceUpdate = useCallback((data) => {
    const { balance } = data;
    setBalance(balance);
    
    // Update user context balance
    if (updateUserBalance) {
      updateUserBalance(balance);
    }
  }, [updateUserBalance]);

  const handleError = useCallback((error) => {
    console.error('Blackjack error:', error);
    setIsProcessing(false);
  }, []);

  // Game actions
  const placeBet = (amount) => {
    setIsProcessing(true);
    setCurrentBet(amount);
    
    if (useMock) {
      mockStartGame(amount);
      return;
    }
    
    blackjackSocketService.placeBet(amount);
  };

  const hitAction = () => {
    setIsProcessing(true);
    
    if (useMock) {
      mockHit();
      return;
    }
    
    blackjackSocketService.hit();
  };

  const standAction = () => {
    setIsProcessing(true);
    
    if (useMock) {
      mockStand();
      return;
    }
    
    blackjackSocketService.stand();
  };

  const doubleDownAction = () => {
    setIsProcessing(true);
    
    if (useMock) {
      mockDoubleDown();
      return;
    }
    
    blackjackSocketService.doubleDown();
  };

  // Reset to betting phase
  const resetGame = () => {
    setPlayerHand([]);
    setDealerHand([]);
    setGamePhase('betting');
    setCurrentBet(0);
    setGameResult(null);
    setWinAmount(0);
  };

  // Mock functions for testing without backend
  const mockStartGame = (bet) => {
    setTimeout(() => {
      // Simulate dealt cards
      const mockPlayerCards = [
        { suit: 'hearts', rank: '10' },
        { suit: 'clubs', rank: '8' }
      ];
      
      const mockDealerCards = [
        { suit: 'diamonds', rank: 'Q' },
        { suit: 'spades', rank: '4' }
      ];
      
      setPlayerHand(mockPlayerCards);
      setDealerHand(mockDealerCards);
      setGamePhase('playerTurn');
      setIsProcessing(false);
      
      // Update balance
      const newBalance = balance - bet;
      setBalance(newBalance);
      if (updateUserBalance) updateUserBalance(newBalance);
    }, 1000);
  };

  const mockHit = () => {
    setTimeout(() => {
      // Add random card to player's hand
      const suits = ['hearts', 'diamonds', 'clubs', 'spades'];
      const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
      
      const newCard = {
        suit: suits[Math.floor(Math.random() * suits.length)],
        rank: ranks[Math.floor(Math.random() * ranks.length)]
      };
      
      setPlayerHand(prevHand => [...prevHand, newCard]);
      
      // Check if bust and end game if needed
      setTimeout(() => {
        const handValue = playerHand.reduce((total, card) => {
          let value = 0;
          if (['J', 'Q', 'K'].includes(card.rank)) value = 10;
          else if (card.rank === 'A') value = 11;
          else value = parseInt(card.rank);
          return total + value;
        }, 0);
        
        if (handValue + (newCard.rank === 'A' ? 11 : parseInt(newCard.rank) || 10) > 21) {
          mockEndGame('dealer', 0);
        } else {
          setIsProcessing(false);
        }
      }, 500);
    }, 1000);
  };

  const mockStand = () => {
    setTimeout(() => {
      setGamePhase('dealerTurn');
      
      // Simulate dealer drawing cards
      const dealerDraw = () => {
        const suits = ['hearts', 'diamonds', 'clubs', 'spades'];
        const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
        
        const newCard = {
          suit: suits[Math.floor(Math.random() * suits.length)],
          rank: ranks[Math.floor(Math.random() * ranks.length)]
        };
        
        setDealerHand(prevHand => {
          const newHand = [...prevHand, newCard];
          
          // Calculate dealer total
          let dealerValue = newHand.reduce((total, card) => {
            let value = 0;
            if (['J', 'Q', 'K'].includes(card.rank)) value = 10;
            else if (card.rank === 'A') value = 11;
            else value = parseInt(card.rank);
            return total + value;
          }, 0);
          
          // If dealer has less than 17, draw again after a delay
          if (dealerValue < 17) {
            setTimeout(dealerDraw, 1000);
          } else {
            // Determine winner
            let playerValue = playerHand.reduce((total, card) => {
              let value = 0;
              if (['J', 'Q', 'K'].includes(card.rank)) value = 10;
              else if (card.rank === 'A') value = 11;
              else value = parseInt(card.rank);
              return total + value;
            }, 0);
            
            let result = 'dealer';
            let winnings = 0;
            
            if (dealerValue > 21 || playerValue > dealerValue) {
              result = 'player';
              winnings = currentBet * 2;
            } else if (playerValue === dealerValue) {
              result = 'push';
              winnings = currentBet;
            }
            
            setTimeout(() => {
              mockEndGame(result, winnings);
            }, 1000);
          }
          
          return newHand;
        });
      };
      
      // Start dealer drawing
      setTimeout(dealerDraw, 1000);
    }, 1000);
  };

  const mockDoubleDown = () => {
    setTimeout(() => {
      // Double the bet
      const doubleBet = currentBet * 2;
      setCurrentBet(doubleBet);
      
      // Update balance
      const newBalance = balance - currentBet;
      setBalance(newBalance);
      if (updateUserBalance) updateUserBalance(newBalance);
      
      // Add one card to player's hand
      const suits = ['hearts', 'diamonds', 'clubs', 'spades'];
      const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
      
      const newCard = {
        suit: suits[Math.floor(Math.random() * suits.length)],
        rank: ranks[Math.floor(Math.random() * ranks.length)]
      };
      
      setPlayerHand(prevHand => [...prevHand, newCard]);
      
      // Continue to dealer's turn
      setTimeout(() => {
        mockStand();
      }, 1000);
    }, 1000);
  };

  const mockEndGame = (result, winnings) => {
    // Update the game state
    setGameResult(result);
    setWinAmount(winnings);
    setGamePhase('complete');
    
    // Update balance if player won
    if (result !== 'dealer') {
      const newBalance = balance + winnings;
      setBalance(newBalance);
      if (updateUserBalance) updateUserBalance(newBalance);
    }
    
    setIsProcessing(false);
    
    // Auto-reset after delay
    setTimeout(resetGame, 5000);
  };

  // Toggle mock mode for testing
  const toggleMockMode = () => {
    setUseMock(!useMock);
    resetGame();
  };

  return (
    <div className="blackjack-game flex flex-col md:flex-row gap-6">
      <div className="game-board flex-grow">
        <BlackjackTable 
          playerHand={playerHand}
          dealerHand={dealerHand}
          gamePhase={gamePhase}
          result={gameResult}
          winAmount={winAmount}
        />
        
        {/* Mock mode toggle for testing/development */}
        <div className="mt-4 text-right">
          <label className="inline-flex items-center cursor-pointer">
            <input 
              type="checkbox"
              className="sr-only peer"
              checked={useMock}
              onChange={toggleMockMode}
              disabled={gamePhase !== 'betting'}
            />
            <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:bg-blue-600"></div>
            <span className="ml-2 text-sm font-medium text-gray-500">
              {useMock ? 'Mock Mode (On)' : 'Mock Mode (Off)'}
            </span>
          </label>
        </div>
      </div>
      
      <div className="betting-panel w-full md:w-72">
        <BlackjackBettingPanel
          onPlaceBet={placeBet}
          onHit={hitAction}
          onStand={standAction}
          onDoubleDown={doubleDownAction}
          gamePhase={gamePhase}
          userBalance={balance}
          disabled={isProcessing}
        />
      </div>
    </div>
  );
};

export default BlackjackGame;