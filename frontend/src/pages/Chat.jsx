import { useEffect, useRef, useState } from "react";
import { ArrowLeft, MessageCircleMore, Send } from "lucide-react";
import { io } from "socket.io-client";

import Avatar from "../components/Avatar";
import ChatAccessNotice from "../components/ChatAccessNotice";
import EmptyState from "../components/EmptyState";
import MessageRequestsPanel from "../components/MessageRequestsPanel";
import { useAuth } from "../context/AuthContext";
import { SOCKET_BASE_URL, TOKEN_STORAGE_KEY, chatApi, getErrorMessage } from "../services/api";


function upsertMessage(list, message) {
  if (list.some((item) => item.id === message.id)) {
    return list;
  }
  return [...list, message];
}


function updateContactsWithMessage(contacts, message, currentUserId) {
  const otherUser = message.sender_id === currentUserId ? message.receiver : message.sender;
  const existing = contacts.find((item) => item.id === otherUser.id);
  const updated = {
    ...(existing || otherUser),
    ...otherUser,
    last_message_preview: message.content,
    last_message_at: message.created_at,
    has_conversation: true,
    can_message: true,
    can_send_message_request: false,
    message_request_status: "accepted",
    message_request_direction: null,
    message_gate_reason: "accepted_request",
  };

  const remaining = contacts.filter((item) => item.id !== otherUser.id);
  return [updated, ...remaining];
}


export default function Chat() {
  const { user } = useAuth();
  const [contacts, setContacts] = useState([]);
  const [selectedContact, setSelectedContact] = useState(null);
  const [showMobileConversation, setShowMobileConversation] = useState(false);
  const [activeSidebarTab, setActiveSidebarTab] = useState("chats");
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sendingRequest, setSendingRequest] = useState(false);
  const [requestActionKey, setRequestActionKey] = useState("");
  const [requests, setRequests] = useState({ incoming: [], outgoing: [] });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [typingUserId, setTypingUserId] = useState(null);

  const socketRef = useRef(null);
  const selectedContactRef = useRef(null);
  const messageViewportRef = useRef(null);

  useEffect(() => {
    selectedContactRef.current = selectedContact;
  }, [selectedContact]);

  const loadContacts = async () => {
    setLoadingContacts(true);
    try {
      const { data } = await chatApi.users();
      const nextContacts = data.users || [];
      setContacts(nextContacts);
      setSelectedContact((current) => {
        if (current) {
          return nextContacts.find((item) => item.id === current.id) || current;
        }
        return nextContacts[0] || null;
      });
      setError("");
      setNotice("");
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoadingContacts(false);
    }
  };

  const loadRequests = async () => {
    setLoadingRequests(true);
    try {
      const { data } = await chatApi.requests();
      setRequests({
        incoming: data.incoming || [],
        outgoing: data.outgoing || [],
      });
      setError("");
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoadingRequests(false);
    }
  };

  const refreshSidebar = async () => {
    await Promise.all([loadContacts(), loadRequests()]);
  };

  useEffect(() => {
    refreshSidebar();
  }, []);

  useEffect(() => {
    if (!selectedContact?.id) {
      return;
    }
    setShowMobileConversation(true);

    const loadMessages = async () => {
      setLoadingMessages(true);
      try {
        const { data } = await chatApi.messages(selectedContact.id);
        setMessages(data.messages || []);
        setTypingUserId(null);
        setSelectedContact((current) =>
          current && current.id === selectedContact.id ? { ...current, ...(data.user || {}) } : current,
        );
        setError("");
        setNotice("");
      } catch (err) {
        setError(getErrorMessage(err));
      } finally {
        setLoadingMessages(false);
      }
    };

    loadMessages();
  }, [selectedContact?.id]);

  useEffect(() => {
    const viewport = messageViewportRef.current;
    if (!viewport) {
      return;
    }

    viewport.scrollTop = viewport.scrollHeight;
  }, [messages, typingUserId]);

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!token) {
      return undefined;
    }

    const socket = io(SOCKET_BASE_URL, {
      auth: { token },
      transports: ["websocket", "polling"],
    });

    socket.on("receive_message", (message) => {
      setContacts((current) => updateContactsWithMessage(current, message, user.id));
      const activeContact = selectedContactRef.current;
      if (!activeContact) {
        return;
      }

      if (message.sender_id === activeContact.id || message.receiver_id === activeContact.id) {
        setMessages((current) => upsertMessage(current, message));
        setSelectedContact((current) =>
          current
            ? {
                ...current,
                can_message: true,
                can_send_message_request: false,
                message_request_status: "accepted",
                message_request_direction: null,
                message_gate_reason: "accepted_request",
              }
            : current,
        );
      }
    });

    socket.on("typing_indicator", (payload) => {
      const activeContact = selectedContactRef.current;
      if (!activeContact || payload.from_user_id !== activeContact.id) {
        return;
      }
      setTypingUserId(payload.is_typing ? payload.from_user_id : null);
    });

    socket.on("message_error", (payload) => {
      setError(payload?.message || "Something went wrong in chat.");
      setNotice("");
    });

    socket.on("message_request_created", (requestPayload) => {
      refreshSidebar();
      const otherUserId =
        requestPayload.sender_id === user.id ? requestPayload.receiver_id : requestPayload.sender_id;

      setSelectedContact((current) =>
        current && current.id === otherUserId
          ? {
              ...current,
              can_message: false,
              can_send_message_request: false,
              message_request_status: "pending",
              message_request_direction: requestPayload.sender_id === user.id ? "outgoing" : "incoming",
              message_request_id: requestPayload.id,
              message_gate_reason:
                requestPayload.sender_id === user.id
                  ? "pending_outgoing_request"
                  : "pending_incoming_request",
            }
          : current,
      );
      setActiveSidebarTab("requests");
      setNotice(
        requestPayload.sender_id === user.id
          ? "Message request sent."
          : `${requestPayload.sender.username} sent you a message request.`,
      );
      setError("");
    });

    socket.on("message_request_updated", (requestPayload) => {
      refreshSidebar();
      setNotice(
        requestPayload.status === "accepted" ? "Message request accepted." : "Message request rejected.",
      );
      setError("");
    });

    socketRef.current = socket;
    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [user.id]);

  useEffect(() => {
    if (!selectedContact?.id || !socketRef.current || !selectedContact.can_message) {
      return undefined;
    }

    socketRef.current.emit("typing_indicator", {
      receiver_id: selectedContact.id,
      is_typing: Boolean(draft.trim()),
    });

    const timer = window.setTimeout(() => {
      socketRef.current?.emit("typing_indicator", {
        receiver_id: selectedContact.id,
        is_typing: false,
      });
    }, 1200);

    return () => window.clearTimeout(timer);
  }, [draft, selectedContact?.id, selectedContact?.can_message]);

  const handleSendMessage = (event) => {
    event.preventDefault();
    if (!draft.trim() || !selectedContact || !socketRef.current || !selectedContact.can_message) {
      return;
    }

    socketRef.current.emit("send_message", {
      receiver_id: selectedContact.id,
      content: draft.trim(),
    });
    setDraft("");
  };

  const handleSendRequest = async (receiverId = selectedContact?.id) => {
    if (!receiverId) {
      return;
    }

    setSendingRequest(true);
    try {
      await chatApi.createRequest({ receiver_id: receiverId });
      await refreshSidebar();
      setSelectedContact((current) =>
        current && current.id === receiverId
          ? {
              ...current,
              can_message: false,
              can_send_message_request: false,
              message_request_status: "pending",
              message_request_direction: "outgoing",
              message_gate_reason: "pending_outgoing_request",
            }
          : current,
      );
      setError("");
      setNotice("Message request sent.");
      setActiveSidebarTab("requests");
    } catch (err) {
      setError(getErrorMessage(err));
      setNotice("");
    } finally {
      setSendingRequest(false);
    }
  };

  const handleRespondToRequest = async (requestItem, action) => {
    const actionKey = `${action}-${requestItem.id}`;
    setRequestActionKey(actionKey);
    try {
      if (action === "accepted") {
        await chatApi.acceptRequest({ request_id: requestItem.id });
      } else {
        await chatApi.rejectRequest({ request_id: requestItem.id });
      }
      await refreshSidebar();

      if (selectedContact?.id === requestItem.sender.id) {
        const { data } = await chatApi.messages(requestItem.sender.id);
        setMessages(data.messages || []);
        setSelectedContact((current) =>
          current && current.id === requestItem.sender.id ? { ...current, ...(data.user || {}) } : current,
        );
      }

      setError("");
      setNotice(action === "accepted" ? "Message request accepted." : "Message request rejected.");
    } catch (err) {
      setError(getErrorMessage(err));
      setNotice("");
    } finally {
      setRequestActionKey("");
    }
  };

  const canSendToSelectedContact = selectedContact?.can_message === true;
  const canSendRequestToSelectedContact = selectedContact?.can_send_message_request === true;
  const hasOutgoingPending =
    selectedContact?.message_request_status === "pending" &&
    selectedContact?.message_request_direction === "outgoing";
  const incomingRequestForSelected =
    selectedContact &&
    requests.incoming.find(
      (requestItem) =>
        requestItem.sender.id === selectedContact.id && requestItem.status === "pending",
    );

  const conversationPanel = (mobile = false) => (
    <section className="panel soft-ring flex min-h-[calc(100vh-8rem)] flex-col overflow-hidden">
      {!selectedContact ? (
        <div className="flex flex-1 items-center justify-center p-6">
          <EmptyState
            title="Choose a conversation"
            description="Select someone to load message history and start chatting in real time."
          />
        </div>
      ) : (
        <>
          <div className="border-b border-[color:var(--line)] px-6 py-5">
            <div className="flex items-center gap-3">
              {mobile ? (
                <button type="button" onClick={() => setShowMobileConversation(false)} className="ghost-button h-11 w-11 rounded-2xl p-0">
                  <ArrowLeft size={18} />
                </button>
              ) : null}
              <Avatar src={selectedContact.profile_pic} name={selectedContact.username} size="md" />
              <div>
                <p className="font-semibold text-ink">{selectedContact.username}</p>
                <p className="text-sm text-[color:var(--muted)]">
                  {canSendToSelectedContact
                    ? typingUserId === selectedContact.id
                      ? "Typing..."
                      : "Direct chat unlocked"
                    : "Request-based messaging"}
                </p>
              </div>
            </div>
          </div>

          <div ref={messageViewportRef} className="flex-1 space-y-4 overflow-y-auto px-6 py-6">
            {loadingMessages ? (
              <p className="text-sm text-[color:var(--muted)]">Loading messages...</p>
            ) : null}

            {!loadingMessages && messages.length === 0 ? (
              <p className="text-sm text-[color:var(--muted)]">
                {canSendToSelectedContact
                  ? "No messages yet. Send the first one to start the thread."
                  : "Direct chat is locked until the messaging requirements are met."}
              </p>
            ) : null}

            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.is_mine ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[72%] rounded-[24px] px-4 py-3 text-sm leading-6 ${
                    message.is_mine
                      ? "bg-[rgba(142,13,115,0.14)] text-ink"
                      : "bg-white/84 text-[color:var(--muted)]"
                  }`}
                >
                  <p>{message.content}</p>
                  <p className="mt-2 text-[11px] uppercase tracking-[0.2em] text-[color:var(--muted)]">
                    {new Date(message.created_at).toLocaleTimeString([], {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
            ))}

            {typingUserId === selectedContact.id && canSendToSelectedContact ? (
              <p className="text-sm text-[color:var(--muted)]">{selectedContact.username} is typing...</p>
            ) : null}
          </div>

          {!canSendToSelectedContact ? (
            <ChatAccessNotice
              contact={selectedContact}
              canSendRequest={canSendRequestToSelectedContact}
              hasOutgoingPending={hasOutgoingPending}
              incomingRequest={incomingRequestForSelected}
              sendingRequest={sendingRequest}
              requestActionKey={requestActionKey}
              onSendRequest={handleSendRequest}
              onRespond={handleRespondToRequest}
            />
          ) : (
            <form onSubmit={handleSendMessage} className="border-t border-[color:var(--line)] px-6 py-5">
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  className="field flex-1"
                  placeholder={`Message ${selectedContact.username}`}
                  maxLength={1000}
                />
                <button type="submit" className="accent-button gap-2">
                  <Send size={16} />
                  Send
                </button>
              </div>
            </form>
          )}
        </>
      )}
    </section>
  );

  const contactList = (
    <aside className="panel soft-ring overflow-hidden">
      <div className="border-b border-[color:var(--line)] px-5 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[rgba(142,13,115,0.14)]">
            <MessageCircleMore size={20} className="text-[color:var(--accent)]" />
          </div>
          <div>
            <p className="font-display text-2xl text-ink">Chat</p>
            <p className="text-sm text-[color:var(--muted)]">Public accounts chat directly. Private accounts use requests.</p>
          </div>
        </div>
      </div>

      <div className="border-b border-[color:var(--line)] px-4 py-4">
        <div className="grid grid-cols-2 gap-2 rounded-[22px] bg-[rgba(142,13,115,0.06)] p-1">
          <button
            type="button"
            onClick={() => setActiveSidebarTab("chats")}
            className={`rounded-[18px] px-4 py-2.5 text-sm font-semibold transition ${
              activeSidebarTab === "chats"
                ? "bg-white text-ink shadow-sm"
                : "text-[color:var(--muted)]"
            }`}
          >
            Chats
          </button>
          <button
            type="button"
            onClick={() => setActiveSidebarTab("requests")}
            className={`rounded-[18px] px-4 py-2.5 text-sm font-semibold transition ${
              activeSidebarTab === "requests"
                ? "bg-white text-ink shadow-sm"
                : "text-[color:var(--muted)]"
            }`}
          >
            Message Requests
          </button>
        </div>
      </div>

      {activeSidebarTab === "requests" ? (
        <div className="max-h-[calc(100vh-14rem)] overflow-y-auto">
          <MessageRequestsPanel
            requests={requests}
            loading={loadingRequests}
            requestActionKey={requestActionKey}
            onSelectContact={setSelectedContact}
            onRespond={handleRespondToRequest}
          />
          {!loadingRequests &&
          requests.incoming.length === 0 &&
          requests.outgoing.length === 0 ? (
            <div className="px-4 py-6 text-sm text-[color:var(--muted)]">
              No message requests right now.
            </div>
          ) : null}
        </div>
      ) : (
        <div className="max-h-[calc(100vh-14rem)] overflow-y-auto p-3">
          {loadingContacts ? (
            <div className="px-3 py-4 text-sm text-[color:var(--muted)]">Loading conversations...</div>
          ) : null}

          {!loadingContacts && contacts.length === 0 ? (
            <div className="px-3 py-4 text-sm text-[color:var(--muted)]">
              No contacts yet. Public accounts will chat directly once you start talking.
            </div>
          ) : null}

          {contacts.map((contact) => (
            <button
              key={contact.id}
              type="button"
              onClick={() => setSelectedContact(contact)}
              className={`flex w-full items-center gap-3 rounded-[22px] px-3 py-3 text-left transition ${
                selectedContact?.id === contact.id ? "bg-white/88" : "hover:bg-white/68"
              }`}
            >
              <Avatar src={contact.profile_pic} name={contact.username} size="md" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink">{contact.username}</p>
                <p className="truncate text-xs text-[color:var(--muted)]">
                  {contact.last_message_preview ||
                    (contact.can_message
                      ? "Direct chat available"
                      : contact.message_request_status === "pending"
                        ? "Message request pending"
                        : "Private account requires approval")}
                </p>
              </div>
              {!contact.can_message ? (
                <span className="rounded-full bg-[rgba(142,13,115,0.12)] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--accent)]">
                  {contact.message_request_status === "pending" ? "Pending" : "Private"}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      )}
    </aside>
  );

  return (
    <main className="mx-auto max-w-[1440px] px-4 py-4 lg:py-6">
      <section className="space-y-5 lg:hidden">
        {showMobileConversation && selectedContact ? conversationPanel(true) : contactList}
      </section>

      <section className="hidden gap-6 lg:grid xl:grid-cols-[340px_minmax(0,1fr)]">
        {contactList}
        {conversationPanel(false)}
      </section>

      {notice ? (
        <div className="mt-5 rounded-[24px] bg-[rgba(142,13,115,0.08)] px-5 py-4 text-sm text-[color:var(--accent)]">
          {notice}
        </div>
      ) : null}
      {error ? <div className="mt-5 rounded-[24px] bg-red-50 px-5 py-4 text-sm text-red-500">{error}</div> : null}
    </main>
  );
}
