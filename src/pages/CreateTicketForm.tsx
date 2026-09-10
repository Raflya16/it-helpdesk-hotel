import {
  ChangeEvent,
  FormEvent,
  useEffect,
  useRef,
  useState,
} from "react";

import { supabase } from "../lib/supabase";
import type { Profile } from "../lib/types";
import { useRouter } from "../router/Router";

type Master = {
  id: string;
  name: string;
};

type AreaMaster = Master & {
  property_id: string | null;
};

type PreviewFile = {
  file: File;
  url: string;
  type: "image" | "video";
};

const allowed = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4",
  "video/quicktime",
];

const MAX_IMAGE_SIZE =
  10 * 1024 * 1024;
const MAX_VIDEO_SIZE =
  50 * 1024 * 1024;

export function CreateTicketForm({
  profile,
  departments,
  categories,
  properties,
  areas,
}: {
  profile: Profile;
  departments: Master[];
  categories: Master[];
  properties: Master[];
  areas: AreaMaster[];
}) {
  const { navigate } = useRouter();
  const fileInputRef =
    useRef<HTMLInputElement>(null);

  const [busy, setBusy] =
    useState(false);
  const [message, setMessage] =
    useState<string | null>(null);
  const [
    selectedFiles,
    setSelectedFiles,
  ] = useState<File[]>([]);
  const [previews, setPreviews] =
    useState<PreviewFile[]>([]);
  const [selectedProperty, setSelectedProperty] =
    useState("");
  const [selectedArea, setSelectedArea] =
    useState("");

  const filteredAreas = areas.filter((area) => {
    // Area tanpa property adalah area umum (mis. Ballroom / Meeting Room).
    // Saat property belum dipilih, hanya area umum yang ditampilkan.
    if (!selectedProperty) return area.property_id === null;
    return area.property_id === null || area.property_id === selectedProperty;
  });

  useEffect(() => {
    const newPreviews =
      selectedFiles.map(
        (file): PreviewFile => ({
          file,
          url: URL.createObjectURL(
            file
          ),
          type: file.type.startsWith(
            "image/"
          )
            ? "image"
            : "video",
        })
      );

    setPreviews(newPreviews);

    return () => {
      newPreviews.forEach(
        (preview) =>
          URL.revokeObjectURL(
            preview.url
          )
      );
    };
  }, [selectedFiles]);

  function formatFileSize(
    bytes: number
  ) {
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

  function syncFileInput(
    files: File[]
  ) {
    if (
      !fileInputRef.current
    ) {
      return;
    }

    const dataTransfer =
      new DataTransfer();

    files.forEach((file) => {
      dataTransfer.items.add(
        file
      );
    });

    fileInputRef.current.files =
      dataTransfer.files;
  }

  function validateFiles(
    files: File[]
  ) {
    for (const file of files) {
      if (
        !allowed.includes(
          file.type
        )
      ) {
        return `Format file tidak didukung: ${file.name}. Gunakan JPG, PNG, WEBP, MP4, atau MOV.`;
      }

      const maxSize =
        file.type.startsWith(
          "image/"
        )
          ? MAX_IMAGE_SIZE
          : MAX_VIDEO_SIZE;

      if (
        file.size > maxSize
      ) {
        return file.type.startsWith(
          "image/"
        )
          ? `${file.name} terlalu besar. Maksimal foto adalah 10 MB.`
          : `${file.name} terlalu besar. Maksimal video adalah 50 MB.`;
      }
    }

    return null;
  }

  function handleFileChange(
    event: ChangeEvent<HTMLInputElement>
  ) {
    setMessage(null);

    const newFiles =
      Array.from(
        event.target.files ?? []
      ).filter(
        (file) =>
          file.size > 0
      );

    if (
      newFiles.length === 0
    ) {
      syncFileInput(
        selectedFiles
      );
      return;
    }

    // Validasi file yang baru dipilih.
    const validationError =
      validateFiles(
        newFiles
      );

    if (validationError) {
      setMessage(
        validationError
      );

      // Jangan hapus file yang
      // sebelumnya sudah dipilih.
      syncFileInput(
        selectedFiles
      );

      return;
    }

    // Gabungkan file lama
    // dengan file yang baru dipilih.
    const combinedFiles = [
      ...selectedFiles,
      ...newFiles,
    ].filter(
      (
        file,
        index,
        allFiles
      ) =>
        allFiles.findIndex(
          (candidate) =>
            candidate.name ===
              file.name &&
            candidate.size ===
              file.size &&
            candidate.type ===
              file.type &&
            candidate.lastModified ===
              file.lastModified
        ) === index
    );

    setSelectedFiles(
      combinedFiles
    );

    // Sinkronkan semua file
    // ke input file.
    syncFileInput(
      combinedFiles
    );
  }

  function removeFile(
    index: number
  ) {
    const remainingFiles =
      selectedFiles.filter(
        (
          _,
          fileIndex
        ) =>
          fileIndex !==
          index
      );

    setSelectedFiles(
      remainingFiles
    );
    syncFileInput(
      remainingFiles
    );
  }

  async function submit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setMessage(null);

    if (
      selectedFiles.length ===
      0
    ) {
      setMessage(
        "Photo / Video Evidence wajib diisi. Lampirkan minimal satu foto atau video."
      );
      fileInputRef.current?.focus();
      return;
    }

    const validationError =
      validateFiles(
        selectedFiles
      );

    if (validationError) {
      setMessage(
        validationError
      );
      return;
    }

    setBusy(true);

    const form =
      new FormData(
        event.currentTarget
      );

    const description =
      String(
        form.get(
          "description"
        ) || ""
      ).trim();

    const autoTitle =
      description.length > 60
        ? `${description
            .slice(0, 60)
            .trim()}...`
        : description;

    const {
      data: ticket,
      error,
    } = await supabase
      .from("tickets")
      .insert({
        title: autoTitle,
        description,
        category_id: String(
          form.get(
            "category_id"
          ) || ""
        ),
        department_id: String(
          form.get(
            "department_id"
          ) || ""
        ),
        property_id:
          String(
            form.get(
              "property_id"
            ) || ""
          ) || null,
        area_id: String(
          form.get(
            "area_id"
          ) || ""
        ),
        location:
          String(
            form.get(
              "location"
            ) || ""
          ).trim() ||
          null,
        device_name:
          String(
            form.get(
              "device_name"
            ) || ""
          ).trim() ||
          null,
        priority: String(
          form.get(
            "priority"
          ) || "MEDIUM"
        ),
        created_by:
          profile.id,
      })
      .select(
        "id,ticket_number"
      )
      .single();

    if (
      error ||
      !ticket
    ) {
      setMessage(
        error?.message ??
          "Gagal membuat ticket."
      );
      setBusy(false);
      return;
    }

    for (
      const file of
      selectedFiles
    ) {
      const safeName =
        file.name.replace(
          /[^a-zA-Z0-9._-]/g,
          "_"
        );

      const path =
        `${profile.id}/` +
        `${ticket.id}/` +
        `${crypto.randomUUID()}-${safeName}`;

      const upload =
        await supabase.storage
          .from(
            "ticket-attachments"
          )
          .upload(path, file, {
            contentType:
              file.type,
            upsert: false,
          });

      if (
        upload.error
      ) {
        setMessage(
          `Ticket dibuat, tetapi upload ${file.name} gagal: ${upload.error.message}`
        );
        setBusy(false);
        navigate(
          `/tickets/${ticket.id}`
        );
        return;
      }

      const meta =
        await supabase
          .from(
            "ticket_attachments"
          )
          .insert({
            ticket_id:
              ticket.id,
            file_name:
              file.name,
            storage_path:
              path,
            file_type:
              file.type,
            file_size:
              file.size,
            uploaded_by:
              profile.id,
          });

      if (meta.error) {
        await supabase.storage
          .from(
            "ticket-attachments"
          )
          .remove([path]);

        setMessage(
          `Ticket dibuat, tetapi metadata attachment gagal: ${meta.error.message}`
        );
        setBusy(false);
        navigate(
          `/tickets/${ticket.id}`
        );
        return;
      }
    }

    setBusy(false);
    navigate(
      `/tickets/${ticket.id}`
    );
  }

  return (
    <form
      className="card"
      onSubmit={submit}
    >
      {message && (
        <div className="alert alert-error">
          {message}
        </div>
      )}

      <div className="form-grid">
        <div className="form-field-full">
          <label className="label">
            Nama Pelapor *
          </label>

          <input
            className="input"
            type="text"
            value={
              profile.name ?? ""
            }
            readOnly
            aria-readonly="true"
          />

          <div
            className="muted"
            style={{
              fontSize: 11,
              marginTop: 5,
            }}
          >
            Nama diambil otomatis
            dari akun yang sedang
            login.
          </div>
        </div>

        <div>
          <label className="label">
            Category *
          </label>

          <select
            className="select"
            name="category_id"
            required
            defaultValue=""
          >
            <option
              value=""
              disabled
            >
              Pilih category
            </option>

            {categories.map(
              (category) => (
                <option
                  key={
                    category.id
                  }
                  value={
                    category.id
                  }
                >
                  {
                    category.name
                  }
                </option>
              )
            )}
          </select>
        </div>

        <div>
          <label className="label">
            Department *
          </label>

          <select
            className="select"
            name="department_id"
            required
            defaultValue={
              profile.department_id ??
              ""
            }
          >
            <option
              value=""
              disabled
            >
              Pilih department
            </option>

            {departments.map(
              (department) => (
                <option
                  key={
                    department.id
                  }
                  value={
                    department.id
                  }
                >
                  {
                    department.name
                  }
                </option>
              )
            )}
          </select>
        </div>

        <div>
          <label className="label">
            Property <span className="muted">(optional)</span>
          </label>

          <select
            className="select"
            name="property_id"
            value={selectedProperty}
            onChange={(event) => {
              const nextProperty = event.target.value;
              setSelectedProperty(nextProperty);

              const currentArea = areas.find((item) => item.id === selectedArea);
              if (currentArea && currentArea.property_id !== null && currentArea.property_id !== nextProperty) {
                setSelectedArea("");
              }
            }}
          >
            <option value="">Tidak perlu / area umum</option>
            {properties.map((property) => (
              <option key={property.id} value={property.id}>
                {property.name}
              </option>
            ))}
          </select>
          <div className="muted" style={{ fontSize: 11, marginTop: 5 }}>
            Kosongkan untuk area umum seperti Ballroom / Meeting Room.
          </div>
        </div>

        <div>
          <label className="label">
            Area *
          </label>

          <select
            className="select"
            name="area_id"
            required
            value={selectedArea}
            onChange={(event) => setSelectedArea(event.target.value)}
          >
            <option value="" disabled>
              {selectedProperty ? "Pilih area" : "Pilih area umum"}
            </option>
            {filteredAreas.map((area) => (
              <option key={area.id} value={area.id}>
                {area.name}
              </option>
            ))}
          </select>
          <div className="muted" style={{ fontSize: 11, marginTop: 5 }}>
            Pilih property terlebih dahulu untuk area khusus seperti Front Office / Front Desk.
          </div>
        </div>

        <div className="form-field-full">
          <label className="label">
            Location Detail
          </label>

          <input
            className="input"
            name="location"
            placeholder="Contoh: Room 812, Counter 2, Ballroom 1"
          />
          <div className="muted" style={{ fontSize: 11, marginTop: 5 }}>
            Opsional. Isi titik lokasi yang lebih spesifik di dalam area.
          </div>
        </div>

        <div>
          <label className="label">
            Priority *
          </label>

          <select
            className="select"
            name="priority"
            defaultValue="MEDIUM"
            required
          >
            <option value="LOW">
              LOW
            </option>
            <option value="MEDIUM">
              MEDIUM
            </option>
            <option value="HIGH">
              HIGH
            </option>
            <option value="CRITICAL">
              CRITICAL
            </option>
          </select>

          <div className="priority-guide">
            <span>
              <strong>LOW</strong> gangguan kecil
            </span>
            <span>
              <strong>MEDIUM</strong> mengganggu 1 user
            </span>
            <span>
              <strong>HIGH</strong> mengganggu department
            </span>
            <span>
              <strong>CRITICAL</strong> mengganggu operasional hotel
            </span>
          </div>
        </div>

        <div className="form-field-full">
          <label className="label">
            Deskripsi Masalah *
          </label>

          <textarea
            className="textarea"
            name="description"
            minLength={10}
            required
            placeholder="Jelaskan masalah yang terjadi, kapan mulai terjadi, pesan error jika ada, dan apa yang sudah dicoba."
          />
        </div>

        <div className="form-field-full">
          <label className="label">
            Photo / Video Evidence *
          </label>

          <input
            ref={fileInputRef}
            className="input"
            type="file"
            name="attachments"
            multiple
            required
            accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime"
            onChange={
              handleFileChange
            }
          />

          <div
            className="muted"
            style={{
              fontSize: 12,
              marginTop: 6,
            }}
          >
            Wajib lampirkan minimal
            1 bukti. Image max 10
            MB/file. Video max 50
            MB/file.
          </div>

          {previews.length > 0 && (
            <div className="ticket-preview-section">
              <div className="ticket-preview-header">
                <div>
                  <strong>
                    Preview Evidence
                  </strong>
                  <p>
                    Periksa kembali foto
                    atau video sebelum
                    mengirim ticket.
                  </p>
                </div>

                <span className="ticket-preview-count">
                  {previews.length} file
                </span>
              </div>

              <div className="ticket-preview-grid">
                {previews.map(
                  (
                    preview,
                    index
                  ) => (
                    <div
                      className="ticket-preview-card"
                      key={`${preview.file.name}-${preview.file.size}-${index}`}
                    >
                      <div className="ticket-preview-media">
                        {preview.type ===
                        "image" ? (
                          <img
                            src={
                              preview.url
                            }
                            alt={`Preview ${preview.file.name}`}
                          />
                        ) : (
                          <video
                            src={
                              preview.url
                            }
                            controls
                            preload="metadata"
                          />
                        )}

                        <button
                          type="button"
                          className="ticket-preview-remove"
                          onClick={() =>
                            removeFile(
                              index
                            )
                          }
                          aria-label={`Hapus ${preview.file.name}`}
                          title="Hapus file"
                        >
                          ×
                        </button>
                      </div>

                      <div className="ticket-preview-info">
                        <strong
                          title={
                            preview
                              .file
                              .name
                          }
                        >
                          {
                            preview
                              .file
                              .name
                          }
                        </strong>

                        <span>
                          {preview.type ===
                          "image"
                            ? "Photo"
                            : "Video"}
                          {" • "}
                          {formatFileSize(
                            preview
                              .file
                              .size
                          )}
                        </span>
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent:
            "flex-end",
          marginTop: 20,
        }}
      >
        <button
          className="btn btn-primary"
          type="submit"
          disabled={busy}
        >
          {busy
            ? "Submitting..."
            : "Submit Ticket"}
        </button>
      </div>
    </form>
  );
}
