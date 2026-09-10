import {
  Pencil,
  Plus,
  Search,
  UsersRound,
} from "lucide-react";
import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

import { AppShell } from "../components/AppShell";
import { supabase } from "../lib/supabase";
import {
  relationName,
  type NamedRelation,
  type Profile,
} from "../lib/types";

type UserRow = {
  id: string;
  name: string;
  email: string | null;
  role: string;
  department_id: string | null;
  position: string | null;
  employee_id: string | null;
  is_active: boolean;
  department: NamedRelation;
};

type DepartmentRow = {
  id: string;
  name: string;
};

export function AdminUsersPage({
  profile,
}: {
  profile: Profile;
}) {
  const [users, setUsers] =
    useState<UserRow[]>([]);
  const [departments, setDepartments] =
    useState<DepartmentRow[]>([]);
  const [selected, setSelected] =
    useState<UserRow | null>(null);
  const [creating, setCreating] =
    useState(false);
  const [search, setSearch] =
    useState("");
  const [roleFilter, setRoleFilter] =
    useState("");
  const [loading, setLoading] =
    useState(true);
  const [saving, setSaving] =
    useState(false);
  const [error, setError] =
    useState<string | null>(null);
  const [success, setSuccess] =
    useState<string | null>(null);
  const [resetPassword, setResetPassword] =
    useState("");
  const [resetConfirm, setResetConfirm] =
    useState("");

  async function load() {
    setLoading(true);
    setError(null);

    const [usersResult, departmentsResult] =
      await Promise.all([
        supabase
          .from("profiles")
          .select(`
            id,
            name,
            email,
            role,
            department_id,
            position,
            employee_id,
            is_active,
            department:departments(name)
          `)
          .order("name"),

        supabase
          .from("departments")
          .select("id,name")
          .eq("is_active", true)
          .order("name"),
      ]);

    if (usersResult.error) {
      setError(usersResult.error.message);
      setUsers([]);
    } else {
      setUsers(
        (usersResult.data ?? []) as unknown as UserRow[]
      );
    }

    if (departmentsResult.error) {
      setError((current) =>
        current ?? departmentsResult.error?.message ?? "Gagal mengambil department."
      );
      setDepartments([]);
    } else {
      setDepartments(
        (departmentsResult.data ?? []) as DepartmentRow[]
      );
    }

    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  const filteredUsers = useMemo(() => {
    const keyword = search
      .trim()
      .toLowerCase();

    return users.filter((user) => {
      const matchesSearch =
        !keyword ||
        [
          user.name,
          user.email,
          user.employee_id,
          user.position,
          relationName(user.department, ""),
        ]
          .filter(Boolean)
          .some((value) =>
            String(value)
              .toLowerCase()
              .includes(keyword)
          );

      const matchesRole =
        !roleFilter ||
        user.role === roleFilter;

      return matchesSearch && matchesRole;
    });
  }, [roleFilter, search, users]);

  async function createUser(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const form = event.currentTarget;
    const data = new FormData(form);

    const username = String(
      data.get("username") || ""
    )
      .trim()
      .toLowerCase();
    const password = String(
      data.get("password") || ""
    );
    const confirmPassword = String(
      data.get("confirm_password") || ""
    );
    const name = String(
      data.get("name") || ""
    ).trim();

    if (!name || !username || !password) {
      setError(
        "Nama, username, dan password wajib diisi."
      );
      return;
    }

    if (!/^[a-zA-Z0-9._-]{3,50}$/.test(username)) {
      setError(
        "Username minimal 3 karakter dan hanya boleh berisi huruf, angka, titik, underscore, atau dash."
      );
      return;
    }

    if (password.length < 8) {
      setError("Password minimal 8 karakter.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Konfirmasi password tidak sama.");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    const { data: result, error: invokeError } =
      await supabase.functions.invoke(
        "create-helpdesk-user",
        {
          body: {
            username,
            password,
            name,
            department_id:
              String(
                data.get("department_id") || ""
              ).trim() || null,
            position:
              String(
                data.get("position") || ""
              ).trim() || null,
            employee_id:
              String(
                data.get("employee_id") || ""
              ).trim() || null,
            role: String(
              data.get("role") || "EMPLOYEE"
            ),
          },
        }
      );

    if (invokeError) {
      let message = invokeError.message;

      try {
        const context = (
          invokeError as unknown as {
            context?: Response;
          }
        ).context;

        if (context) {
          const body = await context.json();
          message = String(
            body?.error || body?.message || message
          );
        }
      } catch {
        // Gunakan pesan bawaan jika response body tidak dapat dibaca.
      }

      setError(message);
      setSaving(false);
      return;
    }

    const createdName = String(
      (result as { name?: string } | null)?.name || name
    );

    setSuccess(
      `User ${createdName} berhasil dibuat dan sudah dapat login.`
    );
    setCreating(false);
    form.reset();
    await load();
    setSaving(false);
  }

  async function saveUser(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!selected) return;

    const form = event.currentTarget;
    const data = new FormData(form);
    const isSelf =
      selected.id === profile.id;

    const name = String(
      data.get("name") || ""
    ).trim();

    if (!name) {
      setError("Nama user wajib diisi.");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    const payload: Record<
      string,
      string | boolean | null
    > = {
      name,
      department_id:
        String(
          data.get("department_id") || ""
        ).trim() || null,
      position:
        String(
          data.get("position") || ""
        ).trim() || null,
      employee_id:
        String(
          data.get("employee_id") || ""
        ).trim() || null,
    };

    if (!isSelf) {
      payload.role = String(
        data.get("role") || "EMPLOYEE"
      );
      payload.is_active =
        data.get("is_active") === "on";
    }

    const { error: updateError } =
      await supabase
        .from("profiles")
        .update(payload)
        .eq("id", selected.id);

    if (updateError) {
      setError(updateError.message);
      setSaving(false);
      return;
    }

    setSuccess(
      `Profile ${name} berhasil diperbarui.`
    );
    setSelected(null);
    await load();
    setSaving(false);
  }

  async function resetSelectedPassword() {
    if (!selected) return;

    if (resetPassword.length < 8) {
      setError("Password baru minimal 8 karakter.");
      return;
    }

    if (resetPassword !== resetConfirm) {
      setError("Konfirmasi password baru tidak sama.");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    const { data: result, error: invokeError } =
      await supabase.functions.invoke(
        "reset-helpdesk-password",
        {
          body: {
            user_id: selected.id,
            new_password: resetPassword,
          },
        }
      );

    if (invokeError) {
      let message = invokeError.message;
      try {
        const context = (
          invokeError as unknown as { context?: Response }
        ).context;
        if (context) {
          const body = await context.json();
          message = String(body?.error || body?.message || message);
        }
      } catch {
        // Keep the Supabase error message.
      }

      setError(message);
      setSaving(false);
      return;
    }

    setResetPassword("");
    setResetConfirm("");
    setSuccess(
      String(
        (result as { message?: string } | null)?.message ||
          `Password ${selected.name} berhasil direset.`
      )
    );
    setSaving(false);
  }

  return (
    <AppShell profile={profile}>
      <div className="topbar">
        <div>
          <h1 className="page-title">
            Users
          </h1>
          <p className="page-subtitle">
            Kelola akun login, profile, department, role, dan status staff.
          </p>
        </div>

        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            setCreating(true);
            setSelected(null);
            setSuccess(null);
            setError(null);
          }}
        >
          <Plus size={17} />
          Tambah User
        </button>
      </div>

      {error && (
        <div className="alert alert-error">
          {error}
        </div>
      )}

      {success && (
        <div className="alert alert-success">
          {success}
        </div>
      )}

      <section className="card user-management-card">
        <div className="user-management-toolbar">
          <div className="user-search-box">
            <Search size={17} />
            <input
              type="search"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Cari nama, department, posisi..."
            />
          </div>

          <select
            className="select user-role-filter"
            value={roleFilter}
            onChange={(event) =>
              setRoleFilter(event.target.value)
            }
          >
            <option value="">
              Semua Role
            </option>
            <option value="ADMIN">
              ADMIN
            </option>
            <option value="EMPLOYEE">
              EMPLOYEE
            </option>
            <option value="IT">
              IT
            </option>
          </select>
        </div>

        <div className="user-management-summary">
          <UsersRound size={17} />
          <span>
            {loading
              ? "Memuat users..."
              : `${filteredUsers.length} user ditemukan`}
          </span>
        </div>

        <div className="table-wrap">
          <table className="ticket-list-table user-table responsive-data-table">
            <thead>
              <tr>
                <th>Nama</th>
                <th>Department</th>
                <th>Position</th>
                <th>Employee ID</th>
                <th>Role</th>
                <th>Status</th>
                <th>Aksi</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="user-table-empty">
                    Memuat users...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="user-table-empty">
                    User tidak ditemukan.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.id}>
                    <td data-label="Nama">
                      <strong>{user.name}</strong>
                      {user.email && (
                        <small className="user-email">
                          {user.email}
                        </small>
                      )}
                    </td>
                    <td data-label="Department">
                      {relationName(user.department)}
                    </td>
                    <td data-label="Position">
                      {user.position || "-"}
                    </td>
                    <td data-label="Employee ID">
                      {user.employee_id || "-"}
                    </td>
                    <td data-label="Role">
                      <span
                        className={`user-role-badge ${
                          user.role === "ADMIN" || user.role === "IT"
                            ? "user-role-admin"
                            : "user-role-employee"
                        }`}
                      >
                        {user.role === "IT"
                          ? "IT"
                          : user.role}
                      </span>
                    </td>
                    <td data-label="Status">
                      <span
                        className={
                          user.is_active
                            ? "user-active"
                            : "user-inactive"
                        }
                      >
                        {user.is_active
                          ? "ACTIVE"
                          : "INACTIVE"}
                      </span>
                    </td>
                    <td data-label="Aksi">
                      <button
                        type="button"
                        className="user-edit-action"
                        title="Edit user"
                        aria-label={`Edit ${user.name}`}
                        onClick={() => {
                          setSelected(user);
                          setResetPassword("");
                          setResetConfirm("");
                          setSuccess(null);
                          setError(null);
                        }}
                      >
                        <Pencil size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>


      {creating && (
        <div className="user-edit-overlay">
          <form
            className="user-edit-modal"
            onSubmit={createUser}
          >
            <div className="user-edit-header">
              <div>
                <h2>Tambah User</h2>
                <p>
                  Buat akun login baru untuk staff atau admin IT.
                </p>
              </div>
              <button
                type="button"
                className="user-edit-close"
                onClick={() => setCreating(false)}
                aria-label="Tutup tambah user"
              >
                ×
              </button>
            </div>

            <div className="user-edit-body">
              <div className="form-grid">
                <div>
                  <label className="label" htmlFor="new-user-name">
                    Nama *
                  </label>
                  <input
                    id="new-user-name"
                    className="input"
                    name="name"
                    autoComplete="off"
                    required
                  />
                </div>

                <div>
                  <label className="label" htmlFor="new-user-username">
                    Username *
                  </label>
                  <input
                    id="new-user-username"
                    className="input"
                    name="username"
                    autoComplete="off"
                    placeholder="contoh: budi.s"
                    minLength={3}
                    maxLength={50}
                    pattern="[A-Za-z0-9._-]{3,50}"
                    required
                  />
                </div>
              </div>

              <div className="form-grid">
                <div>
                  <label className="label" htmlFor="new-user-password">
                    Password *
                  </label>
                  <input
                    id="new-user-password"
                    className="input"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    required
                  />
                </div>

                <div>
                  <label className="label" htmlFor="new-user-confirm-password">
                    Konfirmasi Password *
                  </label>
                  <input
                    id="new-user-confirm-password"
                    className="input"
                    name="confirm_password"
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    required
                  />
                </div>
              </div>

              <div className="form-grid">
                <div>
                  <label className="label" htmlFor="new-user-department">
                    Department
                  </label>
                  <select
                    id="new-user-department"
                    className="select"
                    name="department_id"
                    defaultValue=""
                  >
                    <option value="">Tidak ada</option>
                    {departments.map((department) => (
                      <option
                        key={department.id}
                        value={department.id}
                      >
                        {department.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label" htmlFor="new-user-position">
                    Position
                  </label>
                  <input
                    id="new-user-position"
                    className="input"
                    name="position"
                    autoComplete="off"
                  />
                </div>
              </div>

              <div className="form-grid">
                <div>
                  <label className="label" htmlFor="new-user-employee-id">
                    Employee ID
                  </label>
                  <input
                    id="new-user-employee-id"
                    className="input"
                    name="employee_id"
                    autoComplete="off"
                  />
                </div>

                <div>
                  <label className="label" htmlFor="new-user-role">
                    Role *
                  </label>
                  <select
                    id="new-user-role"
                    className="select"
                    name="role"
                    defaultValue="EMPLOYEE"
                    required
                  >
                    <option value="EMPLOYEE">EMPLOYEE</option>
                    <option value="IT">IT</option>
                    <option value="ADMIN">ADMIN</option>
                  </select>
                </div>
              </div>

              <div className="new-user-login-note">
                Login user akan menggunakan username di atas.
              </div>
            </div>

            <div className="user-edit-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setCreating(false)}
                disabled={saving}
              >
                Batal
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={saving}
              >
                {saving ? "Creating..." : "Create User"}
              </button>
            </div>
          </form>
        </div>
      )}

      {selected && (
        <div className="user-edit-overlay">
          <form
            className="user-edit-modal"
            onSubmit={saveUser}
          >
            <div className="user-edit-header">
              <div>
                <h2>Edit User</h2>
                <p>{selected.email || selected.name}</p>
              </div>
              <button
                type="button"
                className="user-edit-close"
                onClick={() => { setSelected(null); setResetPassword(""); setResetConfirm(""); }}
              >
                ×
              </button>
            </div>

            <div className="user-edit-body">
              <div>
                <label className="label" htmlFor="user-name">
                  Nama
                </label>
                <input
                  id="user-name"
                  className="input"
                  name="name"
                  defaultValue={selected.name}
                  required
                />
              </div>

              <div className="form-grid">
                <div>
                  <label className="label" htmlFor="user-department">
                    Department
                  </label>
                  <select
                    id="user-department"
                    className="select"
                    name="department_id"
                    defaultValue={
                      selected.department_id ?? ""
                    }
                  >
                    <option value="">
                      Tidak ada
                    </option>
                    {departments.map((department) => (
                      <option
                        key={department.id}
                        value={department.id}
                      >
                        {department.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label" htmlFor="user-position">
                    Position
                  </label>
                  <input
                    id="user-position"
                    className="input"
                    name="position"
                    defaultValue={selected.position ?? ""}
                  />
                </div>
              </div>

              <div className="form-grid">
                <div>
                  <label className="label" htmlFor="user-employee-id">
                    Employee ID
                  </label>
                  <input
                    id="user-employee-id"
                    className="input"
                    name="employee_id"
                    defaultValue={selected.employee_id ?? ""}
                  />
                </div>

                <div>
                  <label className="label" htmlFor="user-role">
                    Role
                  </label>
                  <select
                    id="user-role"
                    className="select"
                    name="role"
                    defaultValue={selected.role}
                    disabled={selected.id === profile.id}
                  >
                    <option value="EMPLOYEE">
                      EMPLOYEE
                    </option>
                    <option value="IT">
                      IT
                    </option>
                    <option value="ADMIN">
                      ADMIN
                    </option>
                  </select>
                </div>
              </div>

              <div className="password-reset-panel">
                <div>
                  <strong>Reset Password</strong>
                  <p className="muted">
                    Password diubah melalui Edge Function admin; service-role key tidak pernah dikirim ke browser.
                  </p>
                </div>

                <div className="form-grid">
                  <input
                    className="input"
                    type="password"
                    value={resetPassword}
                    onChange={(event) => setResetPassword(event.target.value)}
                    placeholder="Password baru (min. 8 karakter)"
                    autoComplete="new-password"
                  />
                  <input
                    className="input"
                    type="password"
                    value={resetConfirm}
                    onChange={(event) => setResetConfirm(event.target.value)}
                    placeholder="Konfirmasi password baru"
                    autoComplete="new-password"
                  />
                </div>

                <div className="ticket-action-footer">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={saving || !resetPassword}
                    onClick={() => void resetSelectedPassword()}
                  >
                    Reset Password
                  </button>
                </div>
              </div>

              <label className="user-active-toggle">
                <input
                  type="checkbox"
                  name="is_active"
                  defaultChecked={selected.is_active}
                  disabled={selected.id === profile.id}
                />
                <span>
                  Akun aktif
                  {selected.id === profile.id
                    ? " (akun Anda sendiri tidak dapat dinonaktifkan dari halaman ini)"
                    : ""}
                </span>
              </label>
            </div>

            <div className="user-edit-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => { setSelected(null); setResetPassword(""); setResetConfirm(""); }}
                disabled={saving}
              >
                Batal
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={saving}
              >
                {saving ? "Saving..." : "Save User"}
              </button>
            </div>
          </form>
        </div>
      )}
    </AppShell>
  );
}
