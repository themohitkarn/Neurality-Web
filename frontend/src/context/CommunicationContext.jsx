import { createContext, useContext, useState, useCallback } from "react";

/**
 * COMMUNICATION CONTEXT
 * Manages advanced chat states:
 * - Disappearing Messages (Self-destruct timer)
 * - Secret Chat (E2EE status)
 * - Scheduled Messages Queue
 * - Message Edit History
 */

const CommunicationContext = createContext(null);

export function CommunicationProvider({ children }) {
  const [activeChatSettings, setActiveChatSettings] = useState({
    disappearingMode: 0, // 0 = Off, seconds otherwise
    isSecret: false,
    theme: 'classic'
  });

  const [scheduledMessages, setScheduledMessages] = useState([]);

  const setDisappearingMode = useCallback((seconds) => {
    setActiveChatSettings(prev => ({ ...prev, disappearingMode: seconds }));
  }, []);

  const toggleSecretChat = useCallback(() => {
    setActiveChatSettings(prev => ({ ...prev, isSecret: !prev.isSecret }));
  }, []);

  const scheduleMessage = useCallback((message, timestamp) => {
    setScheduledMessages(prev => [...prev, { ...message, scheduledFor: timestamp }]);
  }, []);

  const value = {
    ...activeChatSettings,
    setDisappearingMode,
    toggleSecretChat,
    scheduledMessages,
    scheduleMessage
  };

  return (
    <CommunicationContext.Provider value={value}>
      {children}
    </CommunicationContext.Provider>
  );
}

export function useCommunication() {
  const context = useContext(CommunicationContext);
  if (!context) throw new Error("useCommunication must be used within CommunicationProvider");
  return context;
}
