import React, { useState, useEffect, useCallback } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import api from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import useAuth from '../../hooks/useAuth';

const DURATIONS = [
  { label: '15 minutes', minutes: 15 },
  { label: '1 hour', minutes: 60 },
  { label: '24 hours', minutes: 60 * 24 },
  { label: 'Forever', minutes: -1 },
];

const formatDate = (d) => {
  if (!d) return '';
  try {
    return new Date(d).toLocaleString();
  } catch {
    return String(d);
  }
};

// Dates at or beyond year 2099 are "forever" mutes (server sentinel: 2099-12-31T23:59:59Z).
const FOREVER_YEAR = 2099;
const formatMutedUntil = (d) => {
  if (!d) return '';
  try {
    const date = new Date(d);
    if (date.getUTCFullYear() >= FOREVER_YEAR) return 'Forever';
    return date.toLocaleString();
  } catch {
    return String(d);
  }
};

const isWriteRole = (role) => role === 'admin' || role === 'operator';

const ChatModerationPage = () => {
  const toast = useToast();
  const { user: currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'admin';
  const canWrite = isWriteRole(currentUser?.role);

  const [messages, setMessages] = useState([]);
  const [includeDeleted, setIncludeDeleted] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);

  const [mutes, setMutes] = useState([]);
  const [mutesLoading, setMutesLoading] = useState(false);

  // Mute form state
  const [muteUserId, setMuteUserId] = useState('');
  const [muteDuration, setMuteDuration] = useState(15);
  const [muteReason, setMuteReason] = useState('');
  const [muteSubmitting, setMuteSubmitting] = useState(false);

  // Profanity list
  const [profanityText, setProfanityText] = useState('');
  const [profanitySubmitting, setProfanitySubmitting] = useState(false);

  // Delete-confirm modal state
  const [confirmDelete, setConfirmDelete] = useState(null); // { id, content }
  const [deleteReason, setDeleteReason] = useState('');
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  useEffect(() => {
    document.title = 'Chat Moderation | Platinum Casino';
  }, []);

  const fetchMessages = useCallback(async () => {
    try {
      setMessagesLoading(true);
      const res = await api.get('/admin/chat/messages', {
        params: { limit: 100, includeDeleted: includeDeleted ? 'true' : 'false' },
      });
      setMessages(res.rows || []);
    } catch (error) {
      toast.error(`Failed to load messages: ${error.message}`);
    } finally {
      setMessagesLoading(false);
    }
  }, [includeDeleted, toast]);

  const fetchMutes = useCallback(async () => {
    try {
      setMutesLoading(true);
      const res = await api.get('/admin/chat/mutes');
      setMutes(res.rows || []);
    } catch (error) {
      toast.error(`Failed to load mutes: ${error.message}`);
    } finally {
      setMutesLoading(false);
    }
  }, [toast]);

  const fetchProfanity = useCallback(async () => {
    try {
      const res = await api.get('/admin/chat/profanity-words');
      setProfanityText((res.words || []).join('\n'));
    } catch (error) {
      toast.error(`Failed to load profanity list: ${error.message}`);
    }
  }, [toast]);

  useEffect(() => {
    fetchMessages();
    fetchMutes();
    fetchProfanity();
  }, [fetchMessages, fetchMutes, fetchProfanity]);

  const handleAskDelete = (msg) => {
    setConfirmDelete(msg);
    setDeleteReason('');
  };

  const handleConfirmDelete = async () => {
    if (!confirmDelete) return;
    try {
      setDeleteSubmitting(true);
      await api.delete(`/admin/chat/messages/${confirmDelete.id}`, {
        body: JSON.stringify({ reason: deleteReason || undefined }),
        headers: { 'Content-Type': 'application/json' },
      });
      toast.success('Message deleted');
      setConfirmDelete(null);
      setDeleteReason('');
      await fetchMessages();
    } catch (error) {
      toast.error(`Delete failed: ${error.message}`);
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const handleMute = async (e) => {
    e.preventDefault();
    const userId = Number(muteUserId);
    if (!Number.isFinite(userId) || userId <= 0) {
      toast.error('Enter a valid user ID');
      return;
    }
    try {
      setMuteSubmitting(true);
      await api.post('/admin/chat/mute', {
        userId,
        durationMinutes: muteDuration,
        reason: muteReason || undefined,
      });
      toast.success('User muted');
      setMuteUserId('');
      setMuteReason('');
      await fetchMutes();
    } catch (error) {
      toast.error(`Mute failed: ${error.message}`);
    } finally {
      setMuteSubmitting(false);
    }
  };

  const handleUnmute = async (userId) => {
    try {
      await api.post('/admin/chat/unmute', { userId });
      toast.success('User unmuted');
      await fetchMutes();
    } catch (error) {
      toast.error(`Unmute failed: ${error.message}`);
    }
  };

  const handleSaveProfanity = async () => {
    try {
      setProfanitySubmitting(true);
      const words = profanityText
        .split(/\r?\n/)
        .map((w) => w.trim())
        .filter((w) => w.length > 0);
      const res = await api.put('/admin/chat/profanity-words', { words });
      setProfanityText((res.words || []).join('\n'));
      toast.success('Profanity wordlist saved');
    } catch (error) {
      toast.error(`Save failed: ${error.message}`);
    } finally {
      setProfanitySubmitting(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-text-primary">Chat Moderation</h1>
        </div>

        {/* Recent messages */}
        <section
          className="bg-bg-card rounded-xl p-6 shadow-card border border-border"
          data-testid="chat-messages-card"
        >
          <div className="flex flex-wrap items-center justify-between mb-4 gap-3">
            <h2 className="text-xl font-semibold text-text-primary">Recent messages</h2>
            <label className="flex items-center text-sm text-text-secondary gap-2">
              <input
                type="checkbox"
                checked={includeDeleted}
                onChange={(e) => setIncludeDeleted(e.target.checked)}
                data-testid="include-deleted-toggle"
              />
              Show deleted
            </label>
          </div>
          {messagesLoading ? (
            <div className="flex justify-center py-10">
              <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-accent-gold" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-text-primary">
                <thead className="bg-bg-elevated">
                  <tr>
                    <th className="py-3 px-4 text-left text-text-secondary font-medium">Time</th>
                    <th className="py-3 px-4 text-left text-text-secondary font-medium">Sender</th>
                    <th className="py-3 px-4 text-left text-text-secondary font-medium">Content</th>
                    {canWrite && <th className="py-3 px-4 text-right text-text-secondary font-medium">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {messages.length === 0 ? (
                    <tr>
                      <td colSpan={canWrite ? 4 : 3} className="py-8 px-4 text-center text-text-muted">
                        No messages yet.
                      </td>
                    </tr>
                  ) : (
                    messages.map((m) => (
                      <tr key={m.id} className="border-t border-border hover:bg-bg-elevated/50">
                        <td className="py-3 px-4 text-text-muted text-sm">{formatDate(m.createdAt)}</td>
                        <td className="py-3 px-4 text-text-secondary">{m.username || `#${m.userId}`}</td>
                        <td className="py-3 px-4 text-text-primary text-sm">
                          <span>{m.content}</span>
                          {m.deletedAt && (
                            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-status-error/20 text-status-error">
                              deleted
                            </span>
                          )}
                        </td>
                        {canWrite && (
                          <td className="py-3 px-4 text-right">
                            {!m.deletedAt && (
                              <Button
                                variant="danger"
                                size="sm"
                                onClick={() => handleAskDelete(m)}
                              >
                                Delete
                              </Button>
                            )}
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Active mutes */}
        <section
          className="bg-bg-card rounded-xl p-6 shadow-card border border-border"
          data-testid="chat-mutes-card"
        >
          <h2 className="text-xl font-semibold text-text-primary mb-4">Active mutes</h2>
          {mutesLoading ? (
            <div className="flex justify-center py-10">
              <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-accent-gold" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-text-primary">
                <thead className="bg-bg-elevated">
                  <tr>
                    <th className="py-3 px-4 text-left text-text-secondary font-medium">User</th>
                    <th className="py-3 px-4 text-left text-text-secondary font-medium">Until</th>
                    <th className="py-3 px-4 text-left text-text-secondary font-medium">Reason</th>
                    {canWrite && <th className="py-3 px-4 text-right text-text-secondary font-medium">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {mutes.length === 0 ? (
                    <tr>
                      <td colSpan={canWrite ? 4 : 3} className="py-8 px-4 text-center text-text-muted">
                        No active mutes.
                      </td>
                    </tr>
                  ) : (
                    mutes.map((m) => (
                      <tr key={m.id} className="border-t border-border hover:bg-bg-elevated/50">
                        <td className="py-3 px-4">{m.username || `#${m.userId}`}</td>
                        <td className="py-3 px-4 text-text-muted text-sm">{formatMutedUntil(m.mutedUntil)}</td>
                        <td className="py-3 px-4 text-text-muted text-sm">{m.reason || '—'}</td>
                        {canWrite && (
                          <td className="py-3 px-4 text-right">
                            <Button variant="subtle" size="sm" onClick={() => handleUnmute(m.userId)}>
                              Unmute
                            </Button>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Mute user form */}
        {canWrite && (
          <section
            className="bg-bg-card rounded-xl p-6 shadow-card border border-border"
            data-testid="chat-mute-form-card"
          >
            <h2 className="text-xl font-semibold text-text-primary mb-4">Mute a user</h2>
            <form onSubmit={handleMute} className="space-y-4">
              <Input
                type="number"
                name="mute-user-id"
                label="User ID"
                value={muteUserId}
                onChange={(e) => setMuteUserId(e.target.value)}
                min={1}
                step="1"
                placeholder="e.g. 42"
              />
              <fieldset>
                <legend className="block text-sm font-medium text-text-secondary mb-2">Duration</legend>
                <div className="flex flex-wrap gap-3">
                  {DURATIONS.map((d) => (
                    <label key={d.minutes} className="flex items-center gap-2 text-text-secondary">
                      <input
                        type="radio"
                        name="mute-duration"
                        value={d.minutes}
                        checked={muteDuration === d.minutes}
                        onChange={() => setMuteDuration(d.minutes)}
                      />
                      {d.label}
                    </label>
                  ))}
                </div>
              </fieldset>
              <Input
                type="text"
                name="mute-reason"
                label="Reason (optional)"
                value={muteReason}
                onChange={(e) => setMuteReason(e.target.value)}
                placeholder="e.g. Spam"
              />
              <Button type="submit" variant="primary" disabled={muteSubmitting}>
                {muteSubmitting ? 'Muting…' : 'Mute'}
              </Button>
            </form>
          </section>
        )}

        {/* Profanity wordlist (admin-only) */}
        {isAdmin && (
          <section
            className="bg-bg-card rounded-xl p-6 shadow-card border border-border"
            data-testid="chat-profanity-card"
          >
            <h2 className="text-xl font-semibold text-text-primary mb-4">Profanity wordlist</h2>
            <p className="text-text-muted text-sm mb-3">
              One word per line. Matches are replaced with asterisks (case-insensitive, whole-word match).
            </p>
            <textarea
              value={profanityText}
              onChange={(e) => setProfanityText(e.target.value)}
              rows={8}
              data-testid="profanity-textarea"
              className="w-full rounded-lg bg-bg-elevated border border-border text-text-primary p-3 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-accent-gold"
            />
            <div className="mt-4">
              <Button variant="primary" onClick={handleSaveProfanity} disabled={profanitySubmitting}>
                {profanitySubmitting ? 'Saving…' : 'Save wordlist'}
              </Button>
            </div>
          </section>
        )}
      </div>

      <Modal
        isOpen={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        title="Delete message"
        variant="primary"
        footer={
          <>
            <Button
              variant="subtle"
              onClick={() => setConfirmDelete(null)}
              disabled={deleteSubmitting}
            >
              Cancel
            </Button>
            <Button variant="danger" onClick={handleConfirmDelete} disabled={deleteSubmitting}>
              {deleteSubmitting ? 'Deleting…' : 'Confirm delete'}
            </Button>
          </>
        }
      >
        <p className="text-text-primary">Soft-delete this message?</p>
        {confirmDelete && (
          <p className="text-text-muted text-sm mt-2 italic break-words">
            "{confirmDelete.content}"
          </p>
        )}
        <div className="mt-4">
          <Input
            type="text"
            name="delete-reason"
            label="Reason (optional)"
            value={deleteReason}
            onChange={(e) => setDeleteReason(e.target.value)}
            placeholder="e.g. Harassment"
          />
        </div>
      </Modal>
    </AdminLayout>
  );
};

export default ChatModerationPage;
