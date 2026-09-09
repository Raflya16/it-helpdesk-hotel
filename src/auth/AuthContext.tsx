import {
  ReactNode,
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";
import type { User } from "@supabase/supabase-js";

import { supabase } from "../lib/supabase";
import type { Profile } from "../lib/types";

type AuthState = {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext =
  createContext<AuthState | null>(null);

async function loadProfile(
  userId: string
): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id,name,email,role,department_id,position,employee_id,is_active"
    )
    .eq("id", userId)
    .single();

  if (error || !data || !data.is_active) {
    return null;
  }

  return data as Profile;
}

export function AuthProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [user, setUser] =
    useState<User | null>(null);
  const [profile, setProfile] =
    useState<Profile | null>(null);
  const [loading, setLoading] =
    useState(true);

  async function hydrate() {
    setLoading(true);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    const currentUser =
      session?.user ?? null;

    setUser(currentUser);

    if (!currentUser) {
      setProfile(null);
      setLoading(false);
      return;
    }

    const currentProfile =
      await loadProfile(currentUser.id);

    if (!currentProfile) {
      await supabase.auth.signOut();
      setUser(null);
      setProfile(null);
      setLoading(false);
      return;
    }

    setProfile(currentProfile);
    setLoading(false);
  }

  useEffect(() => {
    void hydrate();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        const nextUser =
          session?.user ?? null;

        setUser(nextUser);

        if (!nextUser) {
          setProfile(null);
          setLoading(false);
          return;
        }

        const nextProfile =
          await loadProfile(nextUser.id);

        setProfile(nextProfile);
        setLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  async function refreshProfile() {
    if (!user) {
      setProfile(null);
      return;
    }

    setProfile(
      await loadProfile(user.id)
    );
  }

  async function signOut() {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        refreshProfile,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const value = useContext(AuthContext);

  if (!value) {
    throw new Error(
      "useAuth must be used inside AuthProvider"
    );
  }

  return value;
}
