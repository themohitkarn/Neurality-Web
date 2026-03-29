import { Check, X } from "lucide-react";

import Avatar from "./Avatar";


function buildPendingContact(request, direction) {
  const person = direction === "incoming" ? request.sender : request.receiver;
  return {
    ...person,
    can_message: false,
    can_send_message_request: false,
    message_request_status: request.status,
    message_request_direction: direction,
    message_request_id: request.id,
    message_gate_reason: direction === "incoming" ? "pending_incoming_request" : "pending_outgoing_request",
  };
}


export default function MessageRequestsPanel({
  requests,
  loading,
  requestActionKey,
  onSelectContact,
  onRespond,
}) {
  if (requests.incoming.length === 0 && requests.outgoing.length === 0) {
    return null;
  }

  return (
    <div className="border-b border-[color:var(--line)] px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-semibold text-ink">Message requests</p>
          <p className="text-xs text-[color:var(--muted)]">
            Accept or reject who gets access to your inbox.
          </p>
        </div>
        {loading ? <span className="text-xs text-[color:var(--muted)]">Refreshing...</span> : null}
      </div>

      {requests.incoming.length > 0 ? (
        <div className="mt-4 space-y-3">
          {requests.incoming.map((requestItem) => (
            <div key={requestItem.id} className="rounded-[22px] bg-white/84 px-3 py-3">
              <button
                type="button"
                onClick={() => onSelectContact(buildPendingContact(requestItem, "incoming"))}
                className="flex w-full items-center gap-3 text-left"
              >
                <Avatar src={requestItem.sender.profile_pic} name={requestItem.sender.username} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{requestItem.sender.username}</p>
                  <p className="truncate text-xs text-[color:var(--muted)]">Wants to message you</p>
                </div>
              </button>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => onRespond(requestItem, "accepted")}
                  disabled={requestActionKey === `accepted-${requestItem.id}`}
                  className="accent-button flex-1 gap-2 px-4 py-2.5"
                >
                  <Check size={15} />
                  Accept
                </button>
                <button
                  type="button"
                  onClick={() => onRespond(requestItem, "rejected")}
                  disabled={requestActionKey === `rejected-${requestItem.id}`}
                  className="ghost-button flex-1 gap-2 px-4 py-2.5"
                >
                  <X size={15} />
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {requests.outgoing.length > 0 ? (
        <div className="mt-4 space-y-3">
          {requests.outgoing.map((requestItem) => (
            <button
              key={requestItem.id}
              type="button"
              onClick={() => onSelectContact(buildPendingContact(requestItem, "outgoing"))}
              className="flex w-full items-center gap-3 rounded-[22px] bg-[rgba(142,13,115,0.06)] px-3 py-3 text-left"
            >
              <Avatar src={requestItem.receiver.profile_pic} name={requestItem.receiver.username} size="md" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink">{requestItem.receiver.username}</p>
                <p className="truncate text-xs text-[color:var(--muted)]">Request pending</p>
              </div>
              <span className="rounded-full bg-white/86 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--accent)]">
                Pending
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
