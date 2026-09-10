import {
  Bell,
  CheckCheck,
} from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
} from "react";

import { formatDateTime } from "../lib/format";
import { supabase } from "../lib/supabase";
import { useRouter } from "../router/Router";

type NotificationRow = {
  id: string;
  ticket_id: string | null;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
};

export function NotificationBell({
  userId,
}: {
  userId: string;
}) {
  const { navigate } = useRouter();
  const containerRef =
    useRef<HTMLDivElement | null>(null);
  const [open, setOpen] =
    useState(false);
  const [items, setItems] =
    useState<NotificationRow[]>([]);
  const [loading, setLoading] =
    useState(false);
  const [supported, setSupported] =
    useState(true);

  async function loadNotifications() {
    setLoading(true);

    const { data, error } =
      await supabase
        .from("notifications")
        .select(
          "id,ticket_id,type,title,message,is_read,created_at"
        )
        .eq("user_id", userId)
        .order("created_at", {
          ascending: false,
        })
        .limit(20);

    if (error) {
      // Keeps the dashboard usable before the SQL upgrade is run.
      console.warn(
        "Notifications are not available yet:",
        error.message
      );
      setSupported(false);
      setItems([]);
    } else {
      setSupported(true);
      setItems(
        (data ?? []) as NotificationRow[]
      );
    }

    setLoading(false);
  }

  useEffect(() => {
    void loadNotifications();

    // Realtime gives near-instant notifications after V5 migration.
    // Polling remains as a fallback when Realtime is unavailable.
    const channel = supabase
      .channel(`helpdesk-notifications-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          void loadNotifications();
        }
      )
      .subscribe();

    const intervalId = window.setInterval(() => {
      void loadNotifications();
    }, 30000);

    const onFocus = () => {
      void loadNotifications();
    };

    window.addEventListener("focus", onFocus);

    return () => {
      void supabase.removeChannel(channel);
      window.clearInterval(intervalId);
      window.removeEventListener("focus", onFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    function onPointerDown(
      event: PointerEvent
    ) {
      const target =
        event.target as Node;

      if (
        containerRef.current &&
        !containerRef.current.contains(
          target
        )
      ) {
        setOpen(false);
      }
    }

    document.addEventListener(
      "pointerdown",
      onPointerDown
    );

    return () =>
      document.removeEventListener(
        "pointerdown",
        onPointerDown
      );
  }, []);

  const unreadCount =
    items.filter(
      (item) => !item.is_read
    ).length;

  async function markRead(
    notification: NotificationRow
  ) {
    if (!notification.is_read) {
      await supabase
        .from("notifications")
        .update({
          is_read: true,
        })
        .eq("id", notification.id)
        .eq("user_id", userId);

      setItems((current) =>
        current.map((item) =>
          item.id === notification.id
            ? {
                ...item,
                is_read: true,
              }
            : item
        )
      );
    }

    setOpen(false);

    if (notification.ticket_id) {
      navigate(
        `/tickets/${notification.ticket_id}`
      );
    }
  }

  async function markAllRead() {
    const unreadIds = items
      .filter((item) => !item.is_read)
      .map((item) => item.id);

    if (unreadIds.length === 0) {
      return;
    }

    const { error } =
      await supabase
        .from("notifications")
        .update({
          is_read: true,
        })
        .eq("user_id", userId)
        .in("id", unreadIds);

    if (!error) {
      setItems((current) =>
        current.map((item) => ({
          ...item,
          is_read: true,
        }))
      );
    }
  }

  return (
    <div
      className="notification-root"
      ref={containerRef}
    >
      <button
        type="button"
        className="dashboard-notification"
        aria-label="Notifications"
        aria-expanded={open}
        onClick={() =>
          setOpen((value) => !value)
        }
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span>
            {unreadCount > 99
              ? "99+"
              : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="notification-panel">
          <div className="notification-panel-header">
            <div>
              <strong>Notifications</strong>
              <span>
                {unreadCount} belum dibaca
              </span>
            </div>

            {unreadCount > 0 &&
              supported && (
                <button
                  type="button"
                  className="notification-read-all"
                  onClick={() => {
                    void markAllRead();
                  }}
                >
                  <CheckCheck size={15} />
                  Read all
                </button>
              )}
          </div>

          <div className="notification-list">
            {!supported ? (
              <div className="notification-empty">
                Jalankan file SQL upgrade_helpdesk_v2.sql untuk mengaktifkan notifications.
              </div>
            ) : loading &&
              items.length === 0 ? (
              <div className="notification-empty">
                Memuat notification...
              </div>
            ) : items.length === 0 ? (
              <div className="notification-empty">
                Belum ada notification.
              </div>
            ) : (
              items.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className={`notification-item ${
                    item.is_read
                      ? ""
                      : "notification-item-unread"
                  }`}
                  onClick={() => {
                    void markRead(item);
                  }}
                >
                  <span className="notification-dot" />

                  <span className="notification-copy">
                    <strong>
                      {item.title}
                    </strong>
                    <span>
                      {item.message}
                    </span>
                    <small>
                      {formatDateTime(
                        item.created_at
                      )}
                    </small>
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
