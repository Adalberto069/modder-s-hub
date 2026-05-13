import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  rolesLoading: boolean;
  profile: any | null;
  roles: string[];
  isModder: boolean;
  isAdmin: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  rolesLoading: true,
  profile: null,
  roles: [],
  isModder: false,
  isAdmin: false,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

const normalizeUsername = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 24);

const buildCandidateUsernames = (user: User) => {
  const emailBase = user.email?.split("@")[0] ?? "user";
  const metadataUsername =
    (user.user_metadata?.username as string | undefined) ??
    (user.user_metadata?.user_name as string | undefined) ??
    (user.user_metadata?.preferred_username as string | undefined);

  const base =
    normalizeUsername(metadataUsername || emailBase) ||
    `user_${user.id.slice(0, 8).toLowerCase()}`;

  return [
    base,
    `${base}_${user.id.slice(0, 4).toLowerCase()}`,
    `modder_${user.id.slice(0, 8).toLowerCase()}`,
  ];
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [rolesLoading, setRolesLoading] = useState(true);
  const [profile, setProfile] = useState<any | null>(null);
  const [roles, setRoles] = useState<string[]>([]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      // [FIX CWE-598] Clear OAuth tokens from URL fragment
      if (window.location.hash && window.location.hash.includes('access_token')) {
        window.history.replaceState({}, '', window.location.pathname + window.location.search);
      }
      if (session?.user) {
        setTimeout(() => {
          fetchProfile(session.user.id);
          fetchRoles(session.user.id);
        }, 0);
      } else {
        setProfile(null);
        setRoles([]);
        setRolesLoading(false);
      }
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
        fetchRoles(session.user.id);
      } else {
        setRolesLoading(false);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const ensureProfile = async (currentUser: User) => {
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id, user_id, username, display_name, avatar_url, bio, reputation_score, total_downloads, total_positive_reviews, created_at, updated_at")
      .eq("user_id", currentUser.id)
      .maybeSingle();

    if (existingProfile) {
      setProfile(existingProfile);
      return existingProfile;
    }

    const candidates = buildCandidateUsernames(currentUser);

    for (const candidate of candidates) {
      const { data: takenProfile } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("username", candidate)
        .maybeSingle();

      if (takenProfile?.user_id && takenProfile.user_id !== currentUser.id) {
        continue;
      }

      const { data: createdProfile } = await supabase
        .from("profiles")
        .upsert(
          {
            user_id: currentUser.id,
            username: candidate,
            email: currentUser.email ?? null,
            display_name:
              (currentUser.user_metadata?.display_name as string | undefined) ??
              (currentUser.user_metadata?.full_name as string | undefined) ??
              null,
            avatar_url:
              (currentUser.user_metadata?.avatar_url as string | undefined) ??
              (currentUser.user_metadata?.picture as string | undefined) ??
              null,
          },
          { onConflict: "user_id" }
        )
        .select()
        .single();

      if (createdProfile) {
        setProfile(createdProfile);
        return createdProfile;
      }
    }

    setProfile(null);
    return null;
  };

  const fetchProfile = async (userId: string) => {
    const currentUser = user?.id === userId ? user : session?.user?.id === userId ? session.user : null;

    if (currentUser) {
      await ensureProfile(currentUser);
      return;
    }

    const { data } = await supabase
      .from("profiles")
      .select("id, user_id, username, display_name, avatar_url, bio, reputation_score, total_downloads, total_positive_reviews, created_at, updated_at")
      .eq("user_id", userId)
      .maybeSingle();
    setProfile(data ?? null);
  };

  const fetchRoles = async (userId: string) => {
    const { data } = await supabase
      .from("user_roles")
      .select("role, approved")
      .eq("user_id", userId);
    setRoles(data?.filter((r: any) => r.approved).map((r: any) => r.role) ?? []);
    setRolesLoading(false);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const isModder = roles.includes("modder");
  const isAdmin = roles.includes("admin");

  return (
    <AuthContext.Provider value={{ user, session, loading, rolesLoading, profile, roles, isModder, isAdmin, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
