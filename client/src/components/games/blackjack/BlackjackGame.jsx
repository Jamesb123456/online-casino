import React, { useState, useEffect } from 'react';
import BlackjackTable from './BlackjackTable';
import BlackjackBettingPanel from './BlackjackBettingPanel';
import {
  createDeck,
  shuffleArray,
  calculateHandValue,
  isBlackjack,
  isBusted,
  shouldDealerHit,
  determineWinner,
  calculatePayout
} from './blackjackUtils';

/**
 * BlackjackGame Component
 * Main component that integrates all blackjack components and manages game logic
 */
const BlackjackGame = ({ 
  initialBalance = 1000, 
  useMock = true, 
  socketService = null 
}) => {
  // Game state
  const [balance, setBalance] = useState(initialBalance);
  const [betAmount, setBetAmount] = useState(0);
  const [deck, setDeck] = useState([]);
  const [playerHands, setPlayerHands] = useState([[]]);
  const [dealerHand, setDealerHand] = useState([]);
  const [currentHandIndex, setCurrentHandIndex] = useState(0);
  const [gameState, setGameState] = useState('betting'); // betting, playing, dealerTurn, gameOver
  const [result, setResult] = useState(null); // player, dealer, push, blackjack
  const [payout, setPayout] = useState(0);
  
  // Initialize deck
  useEffect(() => {
    const newDeck = createDeck();
    setDeck(shuffleArray(newDeck));
  }, []);
  
  // Socket connection effect
  useEffect(() => {
    if (!useMock && socketService) {
      // Connect to socket
      socketService.connect();
      
      // Listen for game state updates
      socketService.onGameState((data) => {
        setBalance(data.balance);
        setBetAmount(data.betAmount);
        setPlayerHands(data.playerHands);
        setDealerHand(data.dealerHand);
        setCurrentHandIndex(data.currentHandIndex);
        setGameState(data.gameState);
        setResult(data.result);
        setPayout(data.payout);
      });
      
      // Clean up on unmount
      return () => {
        socketService.disconnect();
      };
    }
  }, [useMock, socketService]);
  
  // Draw a card from the deck
  const drawCard = () => {
    if (useMock) {
      // In mock mode, draw from local deck
      if (deck.length === 0) {
        const newDeck = createDeck();
        setDeck(shuffleArray(newDeck));
        return newDeck[0];
      }
      
      const newDeck = [...deck];
      const card = newDeck.pop();
      setDeck(newDeck);
      return card;
    } else {
      // In real mode, request card from server
      return socketService.requestCard();
    }
  };
  
  // Start a new game
  const handlePlaceBet = (amount) => {
    if (useMock) {
      // Set bet amount and update balance
      setBetAmount(amount);
      setBalance(balance - amount);
      
      // Deal initial cards
      const newDealerHand = [drawCard(), drawCard()];
      const newPlayerHand = [drawCard(), drawCard()];
      
      setDealerHand(newDealerHand);
      setPlayerHands([newPlayerHand]);
      setCurrentHandIndex(0);
      
      // Check for blackjack
      if (isBlackjack(newPlayerHand)) {
        handleDealerTurn(newPlayerHand, newDealerHand);
      } else {
        setGameState('playing');
      }
    } else {
      socketService.placeBet(amount);
    }
  };
  
  // Hit - draw another card
  const handleHit = () => {
    if (useMock) {
      const currentHand = [...playerHands[currentHandIndex]];
      currentHand.push(drawCard());
      
      const newPlayerHands = [...playerHands];
      newPlayerHands[currentHandIndex] = currentHand;
      
      setPlayerHands(newPlayerHands);
      
      // Check if busted
      if (isBusted(currentHand)) {
        if (currentHandIndex < playerHands.length - 1) {
          // Move to next hand if available
          setCurrentHandIndex(currentHandIndex + 1);
        } else {
          // All hands complete, dealer's turn
          handleDealerTurn(currentHand, dealerHand);
        }
      }
    } else {
      socketService.hit();
    }
  };
  
  // Stand - end current hand
  const handleStand = () => {
    if (useMock) {
      if (currentHandIndex < playerHands.length - 1) {
        // Move to next hand if available
        setCurrentHandIndex(currentHandIndex + 1);
      } else {
        // All hands complete, dealer's turn
        handleDealerTurn(playerHands[currentHandIndex], dealerHand);
      }
    } else {
      socketService.stand();
    }
  };
  
  // Double down - double bet, get one card, then stand
  const handleDouble = () => {
    if (useMock) {
      if (balance >= betAmount) {
        // Double bet
        setBalance(balance - betAmount);
        setBetAmount(betAmount * 2);
        
        // Draw one card
        const currentHand = [...playerHands[currentHandIndex]];
        currentHand.push(drawCard());
        
        const newPlayerHands = [...playerHands];
        newPlayerHands[currentHandIndex] = currentHand;
        
        setPlayerHands(newPlayerHands);
        
        // Dealer's turn
        handleDealerTurn(currentHand, dealerHand);
      }
    } else {
      socketService.double();
    }
  };
  
  // Dealer's turn
  const handleDealerTurn = (playerHand, dealerHand) => {
    setGameState('dealerTurn');
    
    if (useMock) {
      // In mock mode, simulate dealer's play
      setTimeout(() => {
        let currentDealerHand = [...dealerHand];
        
        // Dealer draws cards until reaching at least 17
        while (shouldDealerHit(currentDealerHand)) {
          currentDealerHand.push(drawCard());
        }
        
        setDealerHand(currentDealerHand);
        
        // Determine winner
        const gameResult = determineWinner(playerHand, currentDealerHand);
        setResult(gameResult);
        
        // Calculate payout
        const gamePayout = calculatePayout(betAmount, gameResult);
        setPayout(gamePayout);
        setBalance(balance + betAmount + gamePayout);
        
        setGameState('gameOver');
      }, 1500);
    }
  };
  
  // Start a new game
  const handleNewGame = () => {
    setPlayerHands([[]]);
    setDealerHand([]);
    setGameState('betting');
    setResult(null);
    setPayout(0);
    setBetAmount(0);
  };
  
  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <div className="lg:w-3/4">
        <BlackjackTable 
          playerHands={playerHands}
          dealerHand={dealerHand}
          currentHandIndex={currentHandIndex}
          gameState={gameState}
          result={result}
          payout={payout}
        />
      </div>
      
      <div className="lg:w-1/4">
        <BlackjackBettingPanel 
          balance={balance}
          gameState={gameState}
          onPlaceBet={handlePlaceBet}
          onHit={handleHit}
          onStand={handleStand}
          onDouble={handleDouble}
          onNewGame={handleNewGame}
        />
      </div>
    </div>
  );
};

export default BlackjackGame;