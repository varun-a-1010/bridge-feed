import { useState } from 'react';
import { STOPS, tierFor, type TOPICS } from '../shared/model';

export function Scale({
  topic,
  value,
  onChange,
}: {
  topic: (typeof TOPICS)[number];
  value?: number;
  onChange: (score: number) => void;
}) {
  const [preview, setPreview] = useState<number>();
  const shown = preview ?? value;
  return (
    <fieldset className="scale">
      <legend>{topic.label}</legend>
      <div className="poles" aria-hidden>
        <span>{topic.low}</span>
        <span>{topic.high}</span>
      </div>
      <div className="stops" onPointerLeave={() => setPreview(undefined)}>
        {STOPS.map((stop) => (
          <label key={stop} onPointerEnter={() => setPreview(stop)}>
            <input
              type="radio"
              name={topic.id}
              checked={value === stop}
              aria-label={`${stop}: ${tierFor(topic.id, stop)}`}
              onChange={() => onChange(stop)}
            />
            <span>{stop}</span>
          </label>
        ))}
      </div>
      <p className="tier" aria-live="polite">
        {shown === undefined ? 'Choose a number to see what it means.' : tierFor(topic.id, shown)}
      </p>
    </fieldset>
  );
}
