from flask import Blueprint, g, jsonify, request
from extensions import db
from models import MessageRequest, User
from utils.jwt_helper import token_required
from datetime import datetime

chat_request_bp = Blueprint("chat_requests", __name__)

@chat_request_bp.get("/requests")
@token_required
def get_message_requests():
    incoming = MessageRequest.query.filter_by(receiver_id=g.current_user.id, status="pending").all()
    outgoing = MessageRequest.query.filter_by(sender_id=g.current_user.id, status="pending").all()
    
    return jsonify({
        "incoming": [r.to_dict(current_user_id=g.current_user.id) for r in incoming],
        "outgoing": [r.to_dict(current_user_id=g.current_user.id) for r in outgoing]
    })

@chat_request_bp.post("/request")
@token_required
def create_request():
    data = request.get_json(silent=True) or {}
    receiver_id = data.get("receiver_id")
    
    if not receiver_id:
        return jsonify({"message": "receiver_id is required"}), 400
        
    if receiver_id == g.current_user.id:
        return jsonify({"message": "Cannot request yourself"}), 400

    existing = MessageRequest.query.filter_by(
        sender_id=g.current_user.id, 
        receiver_id=receiver_id
    ).first()
    
    if existing:
        return jsonify({"message": "Request already exists", "request": existing.to_dict()}), 200

    new_request = MessageRequest(
        sender_id=g.current_user.id,
        receiver_id=receiver_id,
        status="pending"
    )
    db.session.add(new_request)
    db.session.commit()
    
    return jsonify({"message": "Request sent", "request": new_request.to_dict()}), 201

@chat_request_bp.post("/accept")
@token_required
def accept_request():
    data = request.get_json(silent=True) or {}
    request_id = data.get("request_id")
    
    req = db.session.get(MessageRequest, request_id)
    if not req or req.receiver_id != g.current_user.id:
        return jsonify({"message": "Request not found"}), 404
        
    req.status = "accepted"
    req.responded_at = datetime.utcnow()
    db.session.commit()
    
    return jsonify({"message": "Request accepted", "request": req.to_dict()})

@chat_request_bp.post("/reject")
@token_required
def reject_request():
    data = request.get_json(silent=True) or {}
    request_id = data.get("request_id")
    
    req = db.session.get(MessageRequest, request_id)
    if not req or req.receiver_id != g.current_user.id:
        return jsonify({"message": "Request not found"}), 404
        
    req.status = "rejected"
    req.responded_at = datetime.utcnow()
    db.session.commit()
    
    return jsonify({"message": "Request rejected", "request": req.to_dict()})
@chat_request_bp.post("/upload")
@token_required
def upload_chat_media():
    if "file" not in request.files:
        return jsonify({"message": "No file part"}), 400
    file = request.files["file"]

    from utils.image_handler import save_image, build_media_url
    try:
        # Save with 'posts' category which is already set up in image_handler
        path = save_image(file, category="posts")
        url = build_media_url(path)
        return jsonify({"url": url, "path": path}), 201
    except Exception as e:
        return jsonify({"message": str(e)}), 400
