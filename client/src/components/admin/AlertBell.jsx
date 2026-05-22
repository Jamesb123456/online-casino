import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';

const POLL_INTERVAL_MS = 30_000;

/**
 * AlertBell
 * Small bell icon shown in the admin nav. Polls the alerts endpoint every
 * 30 seconds for the current unread count and renders a red dot badge.
 * Clicking the bell navigates to /admin/alerts.
 */
const AlertBell = () => {
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    const fetchCount = async () => {
      try {
        const res = await api.get('/admin/alerts', { params: { unreadOnly: 'true', limit: 1 } });
        if (mountedRef.current) {
          setUnreadCount(Number(res?.unreadCount) || 0);
        }
      } catch {
        // Ignore polling errors; the badge just stays at the last known count.
      }
    };
    fetchCount();
    const intervalId = setInterval(fetchCount, POLL_INTERVAL_MS);
    return () => {
      mountedRef.current = false;
      clearInterval(intervalId);
    };
  }, []);

  return (
    <button
      type="button"
      onClick={() => navigate('/admin/alerts')}
      aria-label={unreadCount > 0 ? `Alerts (${unreadCount} unread)` : 'Alerts'}
      data-testid="alert-bell"
      className="relative flex items-center justify-center w-10 h-10 rounded-lg hover:bg-bg-elevated text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="w-5 h-5"
        aria-hidden="true"
      >
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
      {unreadCount > 0 && (
        <span
          data-testid="alert-bell-badge"
          className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-status-error text-white text-[10px] font-bold flex items-center justify-center border-2 border-bg-card"
        >
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </button>
  );
};

export default AlertBell;
