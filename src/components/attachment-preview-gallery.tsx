import {
  useEffect,
  useState,
} from "react";

import {
  Download,
  File,
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

  const [
    downloading,
    setDownloading,
  ] = useState(false);

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
    if (!bytes) {
      return "0 KB";
    }

    if (bytes < 1024) {
      return `${bytes} B`;
    }

    if (
      bytes <
      1024 * 1024
    ) {
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

  async function handleDownload(
    attachment: Attachment
  ) {
    if (
      downloading ||
      !attachment.url
    ) {
      return;
    }

    setDownloading(true);

    try {
      const response =
        await fetch(
          attachment.url
        );

      if (!response.ok) {
        throw new Error(
          "File gagal diambil."
        );
      }

      const blob =
        await response.blob();

      const objectUrl =
        URL.createObjectURL(
          blob
        );

      const link =
        document.createElement(
          "a"
        );

      link.href =
        objectUrl;

      link.download =
        attachment.file_name ||
        "attachment";

      document.body.appendChild(
        link
      );

      link.click();
      link.remove();

      URL.revokeObjectURL(
        objectUrl
      );
    } catch (error) {
      console.error(
        "Download attachment failed:",
        error
      );

      /*
       * Fallback jika browser
       * memblokir blob download.
       */
      const link =
        document.createElement(
          "a"
        );

      link.href =
        attachment.url;

      link.target =
        "_blank";

      link.rel =
        "noopener noreferrer";

      document.body.appendChild(
        link
      );

      link.click();
      link.remove();
    } finally {
      setDownloading(false);
    }
  }

  if (
    attachments.length === 0
  ) {
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
                key={
                  attachment.id
                }
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
            onClick={(
              event
            ) =>
              event.stopPropagation()
            }
          >
            <div className="ticket-media-modal-header">
              <div>
                <strong>
                  {
                    active.file_name
                  }
                </strong>

                <span>
                  {formatFileSize(
                    active.file_size
                  )}
                </span>
              </div>

              <div
                style={{
                  display:
                    "flex",
                  alignItems:
                    "center",
                  gap: 8,
                }}
              >
                <button
                  type="button"
                  onClick={() =>
                    void handleDownload(
                      active
                    )
                  }
                  disabled={
                    downloading
                  }
                  title="Download attachment"
                  style={{
                    height: 40,
                    padding:
                      "0 14px",
                    border:
                      "1px solid #dbe2ea",
                    borderRadius: 10,
                    background:
                      "#ffffff",
                    color:
                      "#172033",
                    cursor:
                      downloading
                        ? "not-allowed"
                        : "pointer",
                    display:
                      "inline-flex",
                    alignItems:
                      "center",
                    justifyContent:
                      "center",
                    gap: 7,
                    fontWeight: 700,
                    fontSize: 13,
                    opacity:
                      downloading
                        ? 0.6
                        : 1,
                  }}
                >
                  <Download
                    size={17}
                  />

                  {downloading
                    ? "Downloading..."
                    : "Download"}
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setActive(null)
                  }
                  className="ticket-media-close"
                  aria-label="Close"
                  title="Close"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="ticket-media-modal-viewer">
              {active.file_type.startsWith(
                "image/"
              ) ? (
                <img
                  src={
                    active.url
                  }
                  alt={
                    active.file_name
                  }
                />
              ) : active.file_type.startsWith(
                  "video/"
                ) ? (
                <video
                  src={
                    active.url
                  }
                  controls
                  autoPlay
                />
              ) : (
                <div
                  style={{
                    display:
                      "flex",
                    flexDirection:
                      "column",
                    alignItems:
                      "center",
                    justifyContent:
                      "center",
                    gap: 16,
                    minHeight:
                      300,
                    padding: 24,
                    textAlign:
                      "center",
                  }}
                >
                  <File
                    size={52}
                  />

                  <div>
                    <strong>
                      {
                        active.file_name
                      }
                    </strong>

                    <div
                      style={{
                        marginTop:
                          5,
                        opacity:
                          0.7,
                      }}
                    >
                      Preview tidak
                      tersedia untuk
                      tipe file ini.
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      void handleDownload(
                        active
                      )
                    }
                    disabled={
                      downloading
                    }
                    style={{
                      height: 42,
                      padding:
                        "0 18px",
                      border: 0,
                      borderRadius:
                        10,
                      background:
                        "#173f72",
                      color:
                        "#ffffff",
                      cursor:
                        downloading
                          ? "not-allowed"
                          : "pointer",
                      display:
                        "inline-flex",
                      alignItems:
                        "center",
                      gap: 8,
                      fontWeight:
                        700,
                      opacity:
                        downloading
                          ? 0.6
                          : 1,
                    }}
                  >
                    <Download
                      size={18}
                    />

                    {downloading
                      ? "Downloading..."
                      : "Download File"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}