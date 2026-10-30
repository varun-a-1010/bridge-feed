import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export function Carousel({ title, children }: { title: string; children: ReactNode }) {
  const track = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: true });

  const measure = () => {
    const el = track.current;
    if (!el) return;
    setEdges({
      start: el.scrollLeft <= 4,
      end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4,
    });
  };

  useEffect(() => {
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  const move = (direction: 1 | -1) => {
    const el = track.current;
    if (!el) return;
    const card = el.firstElementChild as HTMLElement | null;
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollBy({
      left: direction * ((card?.offsetWidth ?? 260) + 10),
      behavior: still ? 'auto' : 'smooth',
    });
  };

  return (
    <section className="carousel" aria-roledescription="carousel" aria-label={title}>
      <div className="carousel-head">
        <h2>{title}</h2>
        {!(edges.start && edges.end) && (
          <div className="carousel-controls">
            <button
              className="quiet"
              aria-label="Previous"
              disabled={edges.start}
              onClick={() => move(-1)}
            >
              <ChevronLeft size={16} aria-hidden />
            </button>
            <button
              className="quiet"
              aria-label="Next"
              disabled={edges.end}
              onClick={() => move(1)}
            >
              <ChevronRight size={16} aria-hidden />
            </button>
          </div>
        )}
      </div>
      <div className="carousel-track" ref={track} onScroll={measure}>
        {children}
      </div>
    </section>
  );
}
