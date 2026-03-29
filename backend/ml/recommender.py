from collections import defaultdict

from sklearn.neighbors import NearestNeighbors

from extensions import db
from models.associations import followers, post_likes
from models.comment import Comment
from models.post import Post
from models.user import User


def _popular_posts_for_user(user, limit):
    followed_ids = {followed.id for followed in user.following.all()}

    posts = Post.query.order_by(Post.created_at.desc()).all()
    scored_posts = []
    for post in posts:
        if post.user_id == user.id:
            continue
        if post.author.is_private and post.user_id not in followed_ids:
            continue

        score = (post.liked_by.count() * 2) + post.comments.count()
        if post.user_id in followed_ids:
            score += 3
        scored_posts.append((score, post.created_at.isoformat(), post))

    scored_posts.sort(key=lambda item: (item[0], item[1]), reverse=True)
    return [post for _, _, post in scored_posts[:limit]]


def recommend_posts_for_user(user, limit=8):
    users = User.query.order_by(User.id.asc()).all()
    posts = Post.query.order_by(Post.created_at.desc()).all()

    if len(users) < 2 or not posts:
        return _popular_posts_for_user(user, limit)

    user_index = {item.id: index for index, item in enumerate(users)}
    post_index = {item.id: index for index, item in enumerate(posts)}
    author_post_indices = defaultdict(list)

    interaction_matrix = [[0.0 for _ in posts] for _ in users]
    for post in posts:
        author_post_indices[post.user_id].append(post_index[post.id])

    for like_row in db.session.execute(db.select(post_likes.c.user_id, post_likes.c.post_id)):
        liker_id, liked_post_id = like_row
        if liker_id in user_index and liked_post_id in post_index:
            interaction_matrix[user_index[liker_id]][post_index[liked_post_id]] += 3.0

    comment_rows = (
        db.session.query(Comment.user_id, Comment.post_id, db.func.count(Comment.id))
        .group_by(Comment.user_id, Comment.post_id)
        .all()
    )
    for commenter_id, commented_post_id, count in comment_rows:
        if commenter_id in user_index and commented_post_id in post_index:
            interaction_matrix[user_index[commenter_id]][post_index[commented_post_id]] += min(count, 3) * 2.0

    for follow_row in db.session.execute(db.select(followers.c.follower_id, followers.c.followed_id)):
        follower_id, followed_id = follow_row
        if follower_id not in user_index:
            continue
        for target_post_index in author_post_indices.get(followed_id, []):
            interaction_matrix[user_index[follower_id]][target_post_index] += 1.0

    current_user_vector = interaction_matrix[user_index[user.id]]
    if sum(current_user_vector) == 0:
        return _popular_posts_for_user(user, limit)

    neighbor_count = min(6, len(users))
    model = NearestNeighbors(metric="cosine", algorithm="brute", n_neighbors=neighbor_count)
    model.fit(interaction_matrix)

    distances, indices = model.kneighbors([current_user_vector], n_neighbors=neighbor_count)
    collaborative_scores = defaultdict(float)

    interacted_post_ids = {
        post.id
        for post, score in zip(posts, current_user_vector)
        if score > 0
    }
    followed_ids = {followed.id for followed in user.following.all()}

    for distance, neighbor_index in zip(distances[0], indices[0]):
        neighbor = users[neighbor_index]
        if neighbor.id == user.id:
            continue

        similarity = max(0.0, 1.0 - float(distance))
        if similarity <= 0:
            continue

        neighbor_vector = interaction_matrix[neighbor_index]
        for post in posts:
            if post.id in interacted_post_ids or post.user_id == user.id:
                continue
            if post.author.is_private and post.user_id not in followed_ids:
                continue
            collaborative_scores[post.id] += similarity * neighbor_vector[post_index[post.id]]

    if not collaborative_scores:
        return _popular_posts_for_user(user, limit)

    ranked_posts = []
    for post in posts:
        if post.id not in collaborative_scores or post.user_id == user.id:
            continue
        if post.author.is_private and post.user_id not in followed_ids:
            continue

        score = collaborative_scores[post.id]
        if post.user_id in followed_ids:
            score += 1.5
        score += (post.liked_by.count() * 0.25) + (post.comments.count() * 0.2)
        ranked_posts.append((score, post.created_at.isoformat(), post))

    ranked_posts.sort(key=lambda item: (item[0], item[1]), reverse=True)
    return [post for _, _, post in ranked_posts[:limit]]
