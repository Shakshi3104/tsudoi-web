import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { QRCodeCanvas, QRCodeSVG } from "qrcode.react";
import { findEventByCode } from "../lib/events";
import type { Event } from "../types/models";

export default function Present() {
  const { code } = useParams<{ code: string }>();
  const [event, setEvent] = useState<Event | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!code) return;
    let cancelled = false;
    findEventByCode(code)
      .then((ev) => {
        if (cancelled) return;
        if (!ev) setError("Event not found");
        else setEvent(ev);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [code]);

  useEffect(() => {
    document.body.classList.add("present-page-body");
    return () => document.body.classList.remove("present-page-body");
  }, []);

  if (error) {
    return (
      <div className="present-page">
        <div className="present-page__inner">
          <div className="present-page__error">{error}</div>
        </div>
      </div>
    );
  }

  if (!event || !code) {
    return <div className="present-page" />;
  }

  const url = `${window.location.origin}/join/${event.code}`;
  const characters = event.code.split("");

  return (
    <div className="present-page">
      <div className="present-page__inner">
        <div className="present-page__title">{event.title}</div>

        <div className="present-page__qr-wrap">
          <QRCodeCanvas
            ref={canvasRef}
            value={url}
            level="M"
            size={1024}
            style={{ display: "none" }}
          />
          <a
            href="#"
            download={`tsudoi-${event.code}-qr.png`}
            onClick={(e) => {
              e.preventDefault();
              const canvas = canvasRef.current;
              if (!canvas) return;
              const dataUrl = canvas.toDataURL("image/png");
              const a = document.createElement("a");
              a.href = dataUrl;
              a.download = `tsudoi-${event.code}-qr.png`;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
            }}
          >
            <QRCodeSVG className="present-page__qr" value={url} level="M" />
          </a>
        </div>

        <div className="present-page__code">
          {characters.map((ch, i) => (
            <span key={i} className="present-tile">
              {ch}
            </span>
          ))}
        </div>

        <div className="present-page__url">{url.replace(/^https?:\/\//, "")}</div>
      </div>
      <div className="present-page__brand">Tsudoi</div>
    </div>
  );
}
