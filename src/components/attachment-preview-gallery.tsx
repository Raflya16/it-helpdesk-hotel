import {
  useEffect,
  useState,
} from "react";

import {
  Download,
  File,
  ImageIcon,
  Play,
  RotateCw,
  X,
  ZoomIn,
  ZoomOut,
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

  const [zoom, setZoom] =
    useState(1);

  const [rotation, setRotation] =
    useState(0);

  const [downloading, setDownloading] =
    useState(false);

  const isActiveImage =
    active?.file_type.startsWith(
      "image/"
    ) ?? false;

  const isActiveVideo =
    active?.file_type.startsWith(
      "video/"
    ) ?? false;

  useEffect(() => {
    function handleEscape(
      event: KeyboardEvent
    ) {
      if (event.key === "Escape") {
        closePreview();
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

  useEffect(() => {
    if (active) {
      setZoom(1);
      setRotation(0);
    }
  }, [active]);

  function closePreview() {
    setActive(null);
    setZoom(1);
    setRotation(0);
  }

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

  function zoomIn() {
    setZoom((current) =>
      Math.min(
        current + 0.25,
        3
      )
    );
  }

  function zoomOut() {
    setZoom((current) =>
      Math.max(
        current - 0.25,
        0.5
      )
    );
  }

  function rotateImage() {
    setRotation(
      (current) =>
        (current + 90) %
        360
    );
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
          "Gagal mengambil file."
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

      link.href = objectUrl;

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
       * Fallback:
       * buka signed URL jika browser
       * tidak mengizinkan blob download.
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
          onClick={
            closePreview
          }
        >
          <div
            className="ticket-media-modal-content"
            onClick={(
              event
            ) =>
              event.stopPropagation()
            }
            style={{
              overflow:
                "hidden",
            }}
          >
            {/* HEADER */}
            <div
              className="ticket-media-modal-header"
              style={{
                display:
                  "flex",
                alignItems:
                  "center",
                justifyContent:
                  "space-between",
                gap: 16,
              }}
            >
              {/* FILE INFO */}
              <div
                style={{
                  minWidth: 0,
                }}
              >
                <strong
                  style={{
                    display:
                      "block",
                    overflow:
                      "hidden",
                    textOverflow:
                      "ellipsis",
                    whiteSpace:
                      "nowrap",
                    maxWidth:
                      300,
                  }}
                >
                  {
                    active.file_name
                  }
                </strong>

                <span
                  style={{
                    display:
                      "block",
                    marginTop: 2,
                    fontSize: 12,
                    opacity: 0.65,
                  }}
                >
                  {formatFileSize(
                    active.file_size
                  )}
                </span>
              </div>

              {/* ACTION BUTTONS */}
              <div
                style={{
                  display:
                    "flex",
                  alignItems:
                    "center",
                  justifyContent:
                    "flex-end",
                  gap: 8,
                  flexShrink: 0,
                }}
              >
                {/* IMAGE CONTROLS */}
                {isActiveImage && (
                  <>
                    <button
                      type="button"
                      onClick={
                        zoomOut
                      }
                      disabled={
                        zoom <=
                        0.5
                      }
                      title="Zoom Out"
                      aria-label="Zoom Out"
                      style={controlButtonStyle(
                        zoom <=
                          0.5
                      )}
                    >
                      <ZoomOut
                        size={18}
                      />
                    </button>

                    <div
                      style={{
                        minWidth:
                          48,
                        textAlign:
                          "center",
                        fontSize:
                          12,
                        fontWeight:
                          700,
                      }}
                    >
                      {Math.round(
                        zoom *
                          100
                      )}
                      %
                    </div>

                    <button
                      type="button"
                      onClick={
                        zoomIn
                      }
                      disabled={
                        zoom >= 3
                      }
                      title="Zoom In"
                      aria-label="Zoom In"
                      style={controlButtonStyle(
                        zoom >= 3
                      )}
                    >
                      <ZoomIn
                        size={18}
                      />
                    </button>

                    <button
                      type="button"
                      onClick={
                        rotateImage
                      }
                      title="Rotate"
                      aria-label="Rotate"
                      style={controlButtonStyle()}
                    >
                      <RotateCw
                        size={18}
                      />
                    </button>
                  </>
                )}

                {/* DOWNLOAD */}
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
                  title="Download"
                  aria-label="Download"
                  style={{
                    ...controlButtonStyle(
                      downloading
                    ),
                    padding:
                      "0 13px",
                    gap: 7,
                  }}
                >
                  <Download
                    size={17}
                  />

                  <span
                    className="attachment-download-text"
                  >
                    {downloading
                      ? "Downloading..."
                      : "Download"}
                  </span>
                </button>

                {/* CLOSE */}
                <button
                  type="button"
                  onClick={
                    closePreview
                  }
                  title="Close"
                  aria-label="Close"
                  style={controlButtonStyle()}
                >
                  <X
                    size={20}
                  />
                </button>
              </div>
            </div>

            {/* VIEWER */}
            <div
              className="ticket-media-modal-viewer"
              style={{
                overflow:
                  "auto",
                position:
                  "relative",
              }}
            >
              {isActiveImage ? (
                <div
                  style={{
                    width:
                      "100%",
                    minHeight:
                      "100%",
                    display:
                      "flex",
                    justifyContent:
                      "center",
                    alignItems:
                      "center",
                    padding: 12,
                    boxSizing:
                      "border-box",
                  }}
                >
                  <img
                    src={
                      active.url
                    }
                    alt={
                      active.file_name
                    }
                    style={{
                      maxWidth:
                        "100%",
                      maxHeight:
                        "calc(100vh - 190px)",
                      objectFit:
                        "contain",
                      transform: `scale(${zoom}) rotate(${rotation}deg)`,
                      transformOrigin:
                        "center center",
                      transition:
                        "transform 0.2s ease",
                      cursor:
                        zoom >
                        1
                          ? "zoom-out"
                          : "default",
                    }}
                  />
                </div>
              ) : isActiveVideo ? (
                <video
                  src={
                    active.url
                  }
                  controls
                  autoPlay
                  style={{
                    width:
                      "100%",
                    maxHeight:
                      "calc(100vh - 180px)",
                    objectFit:
                      "contain",
                  }}
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
                      320,
                    padding: 24,
                    textAlign:
                      "center",
                  }}
                >
                  <File
                    size={54}
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
                      display:
                        "inline-flex",
                      alignItems:
                        "center",
                      justifyContent:
                        "center",
                      gap: 8,
                      minHeight:
                        42,
                      padding:
                        "0 18px",
                      border:
                        "none",
                      borderRadius:
                        10,
                      background:
                        "#173f72",
                      color:
                        "#ffffff",
                      fontWeight:
                        700,
                      cursor:
                        downloading
                          ? "not-allowed"
                          : "pointer",
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

function controlButtonStyle(
  disabled = false
) {
  return {
    height: 40,
    minWidth: 40,
    padding: "0 9px",
    border:
      "1px solid #dbe2ea",
    borderRadius: 10,
    background: "#f8fafc",
    color: "#172033",
    cursor: disabled
      ? "not-allowed"
      : "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    opacity: disabled
      ? 0.45
      : 1,
  } as const;
}