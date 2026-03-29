import { Check, Clock3, MessageCircleMore, X } from "lucide-react";


function gateCopy(contact) {
  if (!contact) {
    return "";
  }

  switch (contact.message_gate_reason) {
    case "pending_outgoing_request":
      return `Message request sent. ${contact.username} needs to accept before chat opens.`;
    case "pending_incoming_request":
      return `${contact.username} requested to message you. Accept it to unlock the thread.`;
    case "private_requires_acceptance":
      return `${contact.username} has a private account. Send a request first, then wait for acceptance.`;
    case "public_account":
      return `${contact.username} can be messaged directly.`;
    default:
      return `Direct chat with ${contact.username} is locked right now.`;
  }
}


export default function ChatAccessNotice({
  contact,
  canSendRequest,
  hasOutgoingPending,
  incomingRequest,
  sendingRequest,
  requestActionKey,
  onSendRequest,
  onRespond,
}) {
  if (!contact) {
    return null;
  }

  return (
    <div className="border-t border-[color:var(--line)] px-6 py-5">
      <div className="rounded-[24px] bg-white/72 px-4 py-4">
        <p className="text-sm leading-6 text-[color:var(--muted)]">{gateCopy(contact)}</p>

        {canSendRequest ? (
          <button
            type="button"
            onClick={() => onSendRequest(contact.id)}
            disabled={sendingRequest}
            className="accent-button mt-4 gap-2"
          >
            <MessageCircleMore size={16} />
            {sendingRequest ? "Sending request..." : "Send message request"}
          </button>
        ) : null}

        {incomingRequest ? (
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => onRespond(incomingRequest, "accepted")}
              disabled={requestActionKey === `accepted-${incomingRequest.id}`}
              className="accent-button gap-2"
            >
              <Check size={16} />
              Accept
            </button>
            <button
              type="button"
              onClick={() => onRespond(incomingRequest, "rejected")}
              disabled={requestActionKey === `rejected-${incomingRequest.id}`}
              className="ghost-button gap-2"
            >
              <X size={16} />
              Reject
            </button>
          </div>
        ) : null}

        {hasOutgoingPending ? (
          <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-[rgba(142,13,115,0.08)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--accent)]">
            <Clock3 size={14} />
            Awaiting approval
          </div>
        ) : null}
      </div>
    </div>
  );
}
