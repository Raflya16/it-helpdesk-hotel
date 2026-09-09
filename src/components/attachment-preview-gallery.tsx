import { useEffect, useState } from "react";
import {
  ImageIcon,
  Play,
  X,
} from "lucide-react";

type Attachment = {
  id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  url: string;
};

type Props = {
  attachments: Attachment[];
};

export function AttachmentPreviewGallery({
  attachments,
}: Props) {
  const [active, setActive] =
    useState<Attachment | null>(null);

  useEffect(() => {
    function handleEscape(
      event: KeyboardEvent
    ) {
      if (event.key === "Escape") {
        setActive(null);
      }
    }

    document.addEventListener(
      "keydown",
      handleEscape
    );

    return () => {
      document.removeEventListener(
        "keydown",
        handleEscape
      );
    };
  }, []);

  function formatFileSize(
    bytes: number
  ) {
    if (bytes < 1024 * 1024) {
      return `${(
        bytes / 1024
      ).toFixed(1)} KB`;
    }

    return `${(
      bytes /
      1024 /
      1024
    ).toFixed(1)} MB`;
  }

  if (attachments.length === 0) {
    return (
      <div className="ticket-media-empty">
        Tidak ada attachment.
      </div>
    );
  }

  return (
    <>
      <div className="ticket-media-grid">
        {attachments.map(
          (attachment) => {
            const isImage =
              attachment.file_type.startsWith(
                "image/"
              );

            const isVideo =
              attachment.file_type.startsWith(
                "video/"
              );

            return (
              <button
                type="button"
                className="ticket-media-card"
                key={attachment.id}
                onClick={() =>
                  setActive(
                    attachment
                  )
                }
              >
                <div className="ticket-media-preview">
                  {isImage && (
                    <img
                      src={
                        attachment.url
                      }
                      alt={
                        attachment.file_name
                      }
                    />
                  )}

                  {isVideo && (
                    <>
                      <video
                        src={
                          attachment.url
                        }
                        muted
                        preload="metadata"
                      />

                      <div className="ticket-video-play">
                        <Play
                          size={22}
                          fill="currentColor"
                        />
                      </div>
                    </>
                  )}

                  {!isImage &&
                    !isVideo && (
                      <div className="ticket-media-unknown">
                        <ImageIcon
                          size={26}
                        />
                      </div>
                    )}

                  <div className="ticket-media-hover">
                    Click to view
                  </div>
                </div>

                <div className="ticket-media-info">
                  <strong>
                    {
                      attachment.file_name
                    }
                  </strong>

                  <span>
                    {formatFileSize(
                      attachment.file_size
                    )}
                  </span>
                </div>
              </button>
            );
          }
        )}
      </div>

      {active && (
        <div
          className="ticket-media-modal"
          onClick={() =>
            setActive(null)
          }
        >
          <div
            className="ticket-media-modal-content"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <div className="ticket-media-modal-header">
              <div>
                <strong>
                  {active.file_name}
                </strong>

                <span>
                  {formatFileSize(
                    active.file_size
                  )}
                </span>
              </div>

              <button
                type="button"
                onClick={() =>
                  setActive(null)
                }
                className="ticket-media-close"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            <div className="ticket-media-modal-viewer">
              {active.file_type.startsWith(
                "image/"
              ) ? (
                <img
                  src={active.url}
                  alt={
                    active.file_name
                  }
                />
              ) : active.file_type.startsWith(
                  "video/"
                ) ? (
                <video
                  src={active.url}
                  controls
                  autoPlay
                />
              ) : (
                <p>
                  Preview tidak
                  tersedia.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}