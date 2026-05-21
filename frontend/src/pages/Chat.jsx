import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation, useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import { useCall } from "../context/CallContext";
import { chatApi } from "../services/api";

// Modular Neural Components (Refreshed at 2026-05-16 12:31)
import ChatHeader from "../components/chat/ChatHeader"; // Force reload 2
import MessageArea from "../components/chat/MessageArea";
import ChatDock from "../components/chat/ChatDock";
import ChatDetails from "../components/chat/ChatDetails";
import OverlayManager from "../components/chat/OverlayManager";
import InboxList from "../components/chat/InboxList";
import MessageRequestsPanel from "../components/MessageRequestsPanel";
import EmptyState from "../components/EmptyState";
import ThemeSelector from "../components/chat/ThemeSelector";
import DisappearingMessagesSelector from "../components/chat/DisappearingMessagesSelector";
import { useTheme } from "../context/ThemeContext";

import { Settings, Users, Search, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function Chat() {
  const { user } = useAuth();
  const { injectChatTheme } = useTheme();
  const { socket, isConnected, commService } = useSocket();
  const { initiateCall } = useCall();
  const { conversationId: urlConvId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  // ── States ──
  const [contacts, setContacts] = useState([]);
  const [selectedContact, setSelectedContact] = useState(null);
  const [messages, setMessages] = useState([]);
  const [requests, setRequests] = useState({ incoming: [], outgoing: [] });
  const [typingUserId, setTypingUserId] = useState(null);
  const [replyTo, setReplyTo] = useState(null);
  const [reactingTo, setReactingTo] = useState(null);
  const [isVanishMode, setIsVanishMode] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [chatSummary, setChatSummary] = useState(null);
  const [conversationId, setConversationId] = useState(urlConvId || null);
  const [activeTheme, setActiveTheme] = useState("neural-dark");
  const [isMediaTrayOpen, setIsMediaTrayOpen] = useState(false);
  
  // UI States
  const isThreadOpen = !!urlConvId;
  const isDetailsOpen = location.pathname.endsWith("/details");
  const [isThemeOpen, setIsThemeOpen] = useState(false);
  const [isVanishOpen, setIsVanishOpen] = useState(false);
  const [activeVanish, setActiveVanish] = useState(0);
  const [activeSidebarTab, setActiveSidebarTab] = useState("chats");
  const [isGroupCreatorOpen, setIsGroupCreatorOpen] = useState(false);

  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);
  const selectedContactRef = useRef(null);

  useEffect(() => { selectedContactRef.current = selectedContact; }, [selectedContact]);

  // ── Global Shell Fix (Hiding Navbar for entire Chat route) ──
  useEffect(() => {
    document.body.classList.add('chat-active');
    return () => {
      document.body.classList.remove('chat-active');
      document.body.classList.remove('chat-thread-active');
    };
  }, []);

  useEffect(() => {
    if (isThreadOpen) {
      document.body.classList.add('chat-thread-active');
    } else {
      document.body.classList.remove('chat-thread-active');
    }
  }, [isThreadOpen]);

  // ── Logic Core ──
  const refreshSidebar = useCallback(async () => {
    try {
      const [convsRes, reqsRes] = await Promise.all([chatApi.getConversations(), chatApi.getMessageRequests()]);
      const convs = convsRes?.data?.conversations || [];
      const mappedContacts = convs.map(c => {
        if (c.type === "direct") {
          const other = c.members.find(m => m.user_id !== user?.id);
          return { ...other?.user, conversationId: c.id, unread_count: c.unread_count, last_message: c.messages?.[0], is_group: false };
        }
        return { ...c, is_group: true, conversationId: c.id };
      });
      setContacts(mappedContacts);
      setRequests(reqsRes?.data || { incoming: [], outgoing: [] });

      // If we have a URL ID but no selected contact yet, find it in the list
      if (urlConvId && !selectedContact) {
        const match = mappedContacts.find(c => String(c.conversationId) === String(urlConvId));
        if (match) setSelectedContact(match);
      } else if (!urlConvId && location.state?.selectUser) {
        const passedUser = location.state.selectUser;
        const existingConv = mappedContacts.find(c => !c.is_group && String(c.id) === String(passedUser.id));
        if (existingConv) {
          navigate(`/chat/${existingConv.conversationId}`, { replace: true });
        } else {
          setSelectedContact(passedUser);
        }
        // Clear state to prevent infinite loops on reload
        window.history.replaceState({}, document.title);
      }
    } catch (err) { console.error(err); }
  }, [user, urlConvId, selectedContact, location.state, navigate]);

  const loadMessages = useCallback(async (contact) => {
    if (!contact) return;
    try {
      const res = contact.is_group ? await chatApi.getGroupMessages(contact.conversationId || contact.id) : await chatApi.getMessages(contact.id);
      const data = res?.data || {};
      setMessages(data.messages || []);
      setConversationId(data.conversation?.id || contact.conversationId);
      
      // Initialize Settings
      const settings = data.conversation?.settings || {};
      if (settings.theme_id) injectChatTheme(settings.theme_id);
      setActiveVanish(settings.disappearing_timer || 0);

      if (socket?.connected) socket.emit("conversation:join", data.conversation?.id || contact.conversationId);
    } catch (err) { console.error(err); }
  }, [socket, injectChatTheme]);

  useEffect(() => { refreshSidebar(); }, [refreshSidebar]);
  useEffect(() => { if (selectedContact) loadMessages(selectedContact); }, [selectedContact, loadMessages]);

  useEffect(() => {
    if (!socket) return;
    const onReceive = (msg) => {
      const active = selectedContactRef.current;
      const isRelevance = (active && !active.is_group && String(active.id) === String(msg.sender_id)) || 
                          (active && active.is_group && String(active.conversationId) === String(msg.conversation_id)) ||
                          (String(msg.sender_id) === String(user?.id));

      if (isRelevance) {
        setMessages(prev => {
          if (prev.some(m => String(m.id) === String(msg.id))) return prev;
          const tempIndex = prev.findIndex(m => m.is_optimistic && m.content === msg.content);
          if (tempIndex !== -1) {
            const updated = [...prev];
            updated[tempIndex] = msg;
            return updated;
          }
          return [...prev, msg];
        });
      }
      refreshSidebar();
    };
    socket.on("message:received", onReceive);
    socket.on("message:deleted", ({ messageId }) => {
      setMessages(prev => prev.filter(m => String(m.id) !== String(messageId)));
      refreshSidebar();
    });
    socket.on("message:deleted_for_me", ({ messageId }) => {
      setMessages(prev => prev.filter(m => String(m.id) !== String(messageId)));
    });
    socket.on("message:typing", (d) => { if (d.conversationId === conversationId) setTypingUserId(d.isTyping ? d.userId : null); });
    socket.on("ai:suggestions", (d) => { if (selectedContactRef.current && String(d.senderId) === String(selectedContactRef.current.id)) setSuggestions(d.suggestions || []); });
    socket.on("error", (err) => { console.error("[Socket Error]", err); /* removed alert */ });
    socket.on("unread_update", refreshSidebar);
    socket.on("settings:sync", (data) => {
      if (data.conversationId === urlConvId) {
        if (data.key === "theme_id") injectChatTheme(data.value);
        if (data.key === "disappearing_timer") setActiveVanish(data.value);
      }
    });

    socket.on("privacy:blocked", (data) => {
      if (selectedContactRef.current?.id === data.blockerId || selectedContactRef.current?.id === data.blockedId) {
        navigate('/chat');
        refreshSidebar();
      }
    });
    return () => { 
      socket.off("message:received", onReceive); 
      socket.off("message:deleted");
      socket.off("message:typing"); 
      socket.off("ai:suggestions"); 
      socket.off("message:deleted_for_me");
      socket.off("unread_update"); 
      socket.off("privacy:blocked");
    };
  }, [socket, conversationId, refreshSidebar, navigate]);

  const handleSendMessage = async (content, type = "text", metadata = {}) => {
    if (!socket || !content) return; // Don't block if !isConnected, we will queue it

    let finalContent = content;
    let finalType = type;

    try {
      if (type === "image" && metadata.file) {
        const formData = new FormData();
        formData.append("file", metadata.file);
        const res = await chatApi.upload(formData);
        finalContent = res.data.url;
      } else if (type === "voice" && metadata.blob) {
        const formData = new FormData();
        formData.append("file", metadata.blob, "voice.ogg");
        const res = await chatApi.upload(formData);
        finalContent = res.data.url;
      }

      const tempId = `temp-${Date.now()}`;
      setMessages(prev => [...prev, { 
        id: tempId, 
        content: finalContent, 
        sender_id: user.id, 
        is_mine: true, 
        is_optimistic: true, 
        status: "sending",
        reply_to: replyTo,
        type: finalType 
      }]);

      const messageData = {
        tempId,
        conversationId,
        content: finalContent,
        type: finalType,
        receiverId: selectedContact.is_group ? undefined : selectedContact.id,
        groupId: selectedContact.is_group ? selectedContact.id : undefined,
        isVanish: isVanishMode,
        replyToId: replyTo?.id
      };

      const onSuccess = (res) => {
        setMessages(prev => prev.map(m => m.id === tempId ? { ...m, ...res.message, status: "sent", is_optimistic: false } : m));
      };

      const onFail = (err) => {
        setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: "failed" } : m));
      };

      setReplyTo(null);

      // ── Offline Queue / Network Dispatch ──
      if (isConnected && commService) {
         try {
            const res = await commService.emitWithAck("message:send", messageData);
            onSuccess(res);
         } catch(e) {
            onFail(e);
         }
      } else if (commService) {
         commService.queueMessage(messageData, onSuccess, onFail);
      }

    } catch (err) {
      console.error("Signal delivery failed:", err);
    }
  };

  const handleAction = (action, message) => {
    if (action === 'reply') {
      setReplyTo(message);
    } else if (action === 'unsend') {
      socket.emit("message:delete", { messageId: message.id });
      // Optimistic delete
      setMessages(prev => prev.filter(m => String(m.id) !== String(message.id)));
    } else if (action === 'delete') {
      socket.emit("message:delete_for_me", { messageId: message.id });
      // Optimistic delete for me only
      setMessages(prev => prev.filter(m => String(m.id) !== String(message.id)));
    }
  };

  const handleDeleteMessage = (messageId) => handleAction('delete', { id: messageId });

  const scrollToMessage = (messageId) => {
    const el = document.getElementById(`msg-${messageId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('highlight-message');
      setTimeout(() => el.classList.remove('highlight-message'), 2000);
    }
  };

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, typingUserId]);

  return (
    <div className="h-[100dvh] w-full bg-bg-amoled text-white flex items-stretch overflow-hidden relative">
      
      {/* 1. SIDEBAR */}
      <aside className={`
        flex-shrink-0 flex-col h-full border-r border-white/5 bg-bg-amoled z-20
        ${isThreadOpen ? 'hidden lg:flex' : 'flex w-full lg:w-[380px] xl:w-[420px]'}
      `}>
        <header className="px-6 py-5 flex items-center justify-between">
          <h1 className="text-xl font-black tracking-tight text-white uppercase italic">Signals</h1>
          <div className="flex gap-1">
            <button onClick={() => setIsGroupCreatorOpen(true)} className="w-10 h-10 flex items-center justify-center bg-white/5 rounded-xl transition-all"><Users size={18} /></button>
            <button className="w-10 h-10 flex items-center justify-center bg-white/5 rounded-xl transition-all"><Settings size={18} /></button>
          </div>
        </header>
        <div className="px-4 pb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={16} />
            <input placeholder="Search signals..." className="w-full bg-white/5 border border-white/5 rounded-xl py-2.5 pl-10 pr-4 text-sm focus:bg-white/10 outline-none" />
          </div>
        </div>
        <div className="flex p-1 bg-white/5 mx-4 rounded-xl border border-white/5 mb-2">
          {["chats", "requests"].map(t => (
            <button 
              key={t} 
              onClick={() => setActiveSidebarTab(t)} 
              style={{ backgroundColor: activeSidebarTab === t ? "var(--accent)" : "transparent" }}
              className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${activeSidebarTab === t ? "text-white" : "text-white/40"}`}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar">
          {activeSidebarTab === "chats" ? (
            <InboxList 
              contacts={contacts} 
              selectedId={selectedContact?.id} 
              onSelect={(c) => { 
                setSelectedContact(c); 
                navigate(`/chat/${c.conversationId}`);
              }} 
              currentUser={user} 
            />
          ) : (
            <MessageRequestsPanel requests={requests} onRefresh={refreshSidebar} />
          )}
        </div>
      </aside>

      {/* 2. CHAT THREAD / DETAILS */}
      <main className={`
        flex-1 flex flex-col min-h-0 relative h-full
        ${!isThreadOpen ? 'hidden lg:flex' : 'flex'}
      `}>
        {selectedContact ? (
          <>
            {isDetailsOpen ? (
              <ChatDetails 
                contact={selectedContact} 
                settings={{ theme_color: activeTheme, disappearing_timer: activeVanish }} 
                onClose={() => navigate(`/chat/${urlConvId}`)} 
                onUpdateSettings={(id) => {
                  if (id === "theme") setIsThemeOpen(true);
                  if (id === "disappearing") setIsVanishOpen(true);
                }} 
                onBlock={() => {
                  if (window.confirm(`Block ${selectedContact.username}? They will not be able to message you or see your presence.`)) {
                    socket.emit("user:block", { targetId: selectedContact.id });
                    navigate('/chat');
                  }
                }}
                onRestrict={() => {
                  socket.emit("user:restrict", { targetId: selectedContact.id });
                  // Replace alert with console.log
                  console.log("User restricted. Their messages will now appear in Requests.");
                }}
                onReport={() => {
                  const reason = window.prompt("Reason for report (harassment, spam, etc.):");
                  if (reason) {
                    socket.emit("content:report", { 
                      targetType: "user", 
                      targetId: String(selectedContact.id), 
                      reason 
                    });
                  }
                }}
              />
            ) : (
              <>
                <ChatHeader 
                  contact={selectedContact} 
                  typingUserId={typingUserId} 
                  onBack={() => navigate('/chat')} 
                  onDetails={() => navigate(`/chat/${urlConvId}/details`)} 
                  onCall={(type) => initiateCall(selectedContact, type)} 
                />
                
                {/* ── Offline Reconnecting Banner ── */}
                {!isConnected && (
                  <div className="bg-rose-500/10 text-rose-500 text-[11px] font-bold uppercase tracking-widest text-center py-2 border-b border-rose-500/20 flex items-center justify-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
                    Reconnecting to Neural Network...
                  </div>
                )}

                <MessageArea 
                  messages={messages} 
                  user={user} 
                  chatSummary={chatSummary} 
                  onCloseSummary={() => setChatSummary(null)} 
                  setReactingTo={setReactingTo} 
                  onReplyClick={scrollToMessage}
                  messagesEndRef={messagesEndRef} 
                  chatContainerRef={chatContainerRef} 
                />
                <div className={`flex flex-col bg-bg-amoled ${isThemeOpen ? 'hidden lg:flex' : 'flex'}`}>
                  <AnimatePresence>
                    {suggestions.length > 0 && (
                      <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} className="flex gap-2 overflow-x-auto no-scrollbar px-4 pb-3">
                        {suggestions.map((s, i) => <button key={i} onClick={() => handleSendMessage(s)} className="flex-shrink-0 px-4 py-2 bg-white/5 rounded-full text-[11px] font-bold text-white/60">{s}</button>)}
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <ChatDock onSend={handleSendMessage} onCamera={() => {}} onMedia={() => {}} onStickers={() => {}} onTyping={(it) => socket?.emit("message:typing", { conversationId, isTyping: it })} isConnected={isConnected} isMediaTrayOpen={isMediaTrayOpen} setIsMediaTrayOpen={setIsMediaTrayOpen} replyTo={replyTo} onCancelReply={() => setReplyTo(null)} />
                </div>
              </>
            )}
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center p-12 text-center"><EmptyState title="Neural Signal Offline" description="Select a path to begin encrypted communication." /></div>
        )}
      </main>

      {/* 3. MODALS & OVERLAYS */}
      <ThemeSelector 
        isOpen={isThemeOpen} 
        onClose={() => setIsThemeOpen(false)} 
        onSelect={(themeId) => {
          injectChatTheme(themeId);
          socket.emit("settings:update", { conversationId: urlConvId, key: "theme_id", value: themeId });
          setIsThemeOpen(false);
        }}
      />

      <DisappearingMessagesSelector
        isOpen={isVanishOpen}
        activeValue={activeVanish}
        onClose={() => setIsVanishOpen(false)}
        onSelect={(val) => {
          setActiveVanish(val);
          socket.emit("settings:update", { conversationId: urlConvId, key: "disappearing_timer", value: val });
          setIsVanishOpen(false);
        }}
      />

      <OverlayManager 
        isDetailsOpen={isDetailsOpen} selectedContact={selectedContact} activeTheme={activeTheme} 
        onCloseDetails={() => navigate(`/chat/${urlConvId}`)} onOpenTheme={() => { navigate(`/chat/${urlConvId}`); setIsThemeOpen(true); }}
        isThemeOpen={isThemeOpen} setActiveTheme={setActiveTheme} onCloseTheme={() => setIsThemeOpen(false)}
        isGroupCreatorOpen={isGroupCreatorOpen} onCloseGroupCreator={() => setIsGroupCreatorOpen(false)} onGroupCreated={(c) => { setIsGroupCreatorOpen(false); setSelectedContact(c); navigate(`/chat/${c.conversationId}`); }}
        reactingTo={reactingTo} setReactingTo={setReactingTo} 
        onReaction={(e) => { socket.emit("reaction:toggle", { messageId: reactingTo.id, emoji: e }); setReactingTo(null); }}
        onAction={handleAction}
        currentUser={user}
      />
    </div>
  );
}