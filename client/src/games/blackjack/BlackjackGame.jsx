import React, { useState, useEffect, useCallback, useContext } from 'react';
import { AuthContext } from '../../contexts/AuthContext';
import BlackjackTable from './BlackjackTable';
import BlackjackBettingPanel from './BlackjackBettingPanel';
import blackjackSocketService from '../../services/socket/blackjackSocketService';

/**
 * Main component for the Blackjack game
 */
const BlackjackGame = () => {
  const { user, updateBalance: updateUserBalance } = useContext(AuthContext);
  
  // Game state
  const [playerHand, setPlayerHand] = useState([]);
  const [dealerHand, setDealerHand] = useState([]);
  const [gamePhase, setGamePhase] = useState('betting'); // betting, playerTurn, dealerTurn, complete
  const [currentBet, setCurrentBet] = useState(0);
  const [balance, setBalance] = useState(user?.balance || 0);
  const [gameResult, setGameResult] = useState(null); // player, dealer, push
  const [winAmount, setWinAmount] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);

  // Initialize the game and socket connection
  useEffect(() => {
    const unsubs = [];
    let cancelled = false;

    if (user) {
      setBalance(user.balance);
    }

    // Connect to socket and subscribe to events after connection is ready
    const init = async () => {
      try {
        await blackjackSocketService.connect();
      } catch (err) {
        console.error('Blackjack socket connection failed:', err);
        return;
      }

      // Guard against subscribing after unmount
      if (cancelled) return;

      // Event listeners - collect unsubscribe functions
      unsubs.push(blackjackSocketService.onGameStarted(handleGameStarted));
      unsubs.push(blackjackSocketService.onCardDealt(handleCardDealt));
      unsubs.push(blackjackSocketService.onPlayerTurn(handlePlayerTurn));
      unsubs.push(blackjackSocketService.onDealerTurn(handleDealerTurn));
      unsubs.push(blackjackSocketService.onGameResult(handleGameResult));
      unsubs.push(blackjackSocketService.onBalanceUpdate(handleBalanceUpdate));
      unsubs.push(blackjackSocketService.onError(handleError));
    };

    init();

    return () => {
      // Clean up individual listeners, then disconnect
      cancelled = true;
      unsubs.forEach(unsub => unsub());
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
    blackjackSocketService.placeBet(amount);
  };

  const hitAction = () => {
    setIsProcessing(true);
    blackjackSocketService.hit();
  };

  const standAction = () => {
    setIsProcessing(true);
    blackjackSocketService.stand();
  };

  const doubleDownAction = () => {
    setIsProcessing(true);
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

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <div className="lg:w-8/12 space-y-4">
        <BlackjackTable 
          playerHand={playerHand}
          dealerHand={dealerHand}
          gamePhase={gamePhase}
          result={gameResult}
          winAmount={winAmount}
        />
        
      </div>

      <div className="lg:w-4/12">
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