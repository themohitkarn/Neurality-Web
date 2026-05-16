import { useEffect, useState, useRef } from "react";
import { Bookmark, Grid3x3, ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import { socialApi, getErrorMessage } from "../services/api";

export default function Saved() {
  const navigate = useNavigate();
  const [drops, setDrops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  
  const dropsRef = useRef(null);
  const beatsRef = useRef(null);

  const fetchSaved = async (pageNum = 1, append = false) => {
    try {
      const { data } = await socialApi.getSaved(pageNum);
      setDrops(prev => append ? [...prev, ...data.posts] : data.posts);
      setHasNext(data.has_next);
      setPage(pageNum);
      setError("");
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSaved();
  }, []);

  const scrollContainer = (ref, direction) => {
    if (ref.current) {
      const scrollAmount = direction === "left" ? -300 : 300;
      ref.current.scrollBy({ left: scrollAmount, behavior: "smooth" });
    }
  };

  return (
    <div className="h-[100vh] w-full overflow-y-auto overflow-x-hidden bg-[color:var(--bg)]">
      <div className="w-full max-w-[935px] mx-auto px-4">
        {/* Header */}
        <div className="flex items-center gap-4 py-6">
          <button onClick={() => navigate(-1)} className="btn-icon">
            <ArrowLeft size={20} />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "var(--accent-soft)" }}>
              <Bookmark size={18} className="text-[color:var(--accent)]" />
            </div>
            <div>
              <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>Saved</h1>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>{drops.length} items saved</p>
            </div>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="grid grid-cols-3 gap-1 sm:gap-4 mt-6">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => (
              <div key={i} className="aspect-square skeleton rounded-xl" />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-2xl px-6 py-4 text-sm text-red-400 mt-6 bg-red-500/10 border border-red-500/20 animate-in fade-in">
            {error}
          </div>
        ) : (
          <div className="space-y-12 pb-20">
            {/* Saved Drops Section */}
            <div>
              <div className="flex items-center justify-between mb-6 px-1">
                <h2 className="text-sm font-black uppercase tracking-widest text-[color:var(--text-muted)]">Saved Drops</h2>
                <div className="h-[1px] flex-1 bg-[color:var(--border)] mx-4" />
                <Grid3x3 size={16} className="text-[color:var(--text-muted)]" />
              </div>
              
              {drops.length === 0 ? (
                <div className="py-20 text-center rounded-[32px] bg-[color:var(--surface)] border-2 border-dashed border-[color:var(--border)]">
                  <p className="text-sm font-bold text-[color:var(--text-muted)]">No saved drops yet</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-1 sm:gap-4">
                  {drops.map(drop => (
                    <Link
                      key={drop.id}
                      to={`/post/${drop.id}`}
                      className="relative aspect-square rounded-xl sm:rounded-2xl overflow-hidden group bg-[color:var(--surface)]"
                    >
                      <img src={drop.image_url} alt="" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                      
                      {drop.media_type === "video" && (
                        <div className="absolute top-2 right-2 p-1 bg-black/40 backdrop-blur-md rounded-lg">
                          <Video size={14} className="text-white" />
                        </div>
                      )}
                      
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4 text-white text-sm font-bold">
                        <span className="flex items-center gap-1">❤️ {drop.likes_count}</span>
                        <span className="flex items-center gap-1">💬 {drop.comments_count || 0}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Saved Beats Section */}
            <div>
              <div className="flex items-center justify-between mb-6 px-1">
                <h2 className="text-sm font-black uppercase tracking-widest text-[color:var(--text-muted)]">Saved Beats</h2>
                <div className="h-[1px] flex-1 bg-[color:var(--border)] mx-4" />
                <Video size={16} className="text-[color:var(--text-muted)]" />
              </div>
              
              <div className="py-20 text-center rounded-[32px] bg-[color:var(--surface)] border-2 border-dashed border-[color:var(--border)]">
                <p className="text-sm font-bold text-[color:var(--text-muted)]">No saved beats yet</p>
                <p className="text-xs text-[color:var(--text-muted)] opacity-60 mt-1">Beats you save will appear here.</p>
              </div>
            </div>
          </div>
        )}

        <div className="pb-safe" />
      </div>
    </div>
  );
}
