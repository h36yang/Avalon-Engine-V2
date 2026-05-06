/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from "react";
import { useGameStore } from "./store";
import { supabase, recreateSupabaseClient } from "./utils/supabase";
import AuthScreen from "./components/AuthScreen";
import JoinScreen from "./components/JoinScreen";
import LobbyScreen from "./components/LobbyScreen";
import RoleRevealScreen from "./components/RoleRevealScreen";
import GameScreen from "./components/GameScreen";
import AssassinScreen from "./components/AssassinScreen";
import GameOverScreen from "./components/GameOverScreen";
import IdleWarningModal from "./components/IdleWarningModal";
import { LanguageToggle } from "./components/LanguageToggle";
import { Loader2 } from "lucide-react";
import { User } from '@supabase/supabase-js';

export default function App() {
  const room = useGameStore((state) => state.room);
  const user = useGameStore((state) => state.user);
  const setAuth = useGameStore((state) => state.setAuth);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    let subscriptionRef: any = null;

    const runSetup = async () => {
      const initAuth = async () => {
        try {
          const timeout = new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error('getSession timeout')), 5000)
          );

          let sessionResult;
          try {
            sessionResult = await Promise.race([
              supabase.auth.getSession(),
              timeout
            ]);
          } catch (err) {
            console.warn("getSession error/timeout, recreating client:", err);
            recreateSupabaseClient();
            throw err;
          }

          const { data: { session }, error: sessionError } = sessionResult;
          if (sessionError) {
            console.warn("getSession returned error, recreating client:", sessionError);
            recreateSupabaseClient();
            throw sessionError;
          }

          if (session?.user) {
            let profile = null;
            try {
              const { data, error: profileError } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', session.user.id)
                .single();

              if (!profileError) {
                profile = data;
              }
            } catch (err) {
              // Supabase not configured - skip profile fetch
              console.debug('Profile fetch skipped (Supabase not configured)');
            }
            setAuth(session.user, profile);
          } else {
            setAuth(null, null);
          }
        } catch (err) {
          console.error("Auth initialization error:", err);
          setAuth(null, null);
        } finally {
          setIsInitializing(false);
        }
      };

      await initAuth();

      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event: unknown, session: { user: User | null; }) => {
        try {
          if (session?.user) {
            let { data: profile } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', session.user.id)
              .single();

            // If profile doesn't exist, it might be a new user where the insert hasn't finished.
            // Wait a moment and retry.
            if (!profile) {
              await new Promise(resolve => setTimeout(resolve, 1000));
              const retry = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
              profile = retry.data;
            }

            setAuth(session.user, profile);
          } else {
            setAuth(null, null);
          }
        } catch (err) {
          console.error("Auth state change error:", err);
          setAuth(null, null);
        }
      });
      subscriptionRef = subscription;
    };

    runSetup();

    return () => {
      if (subscriptionRef) subscriptionRef.unsubscribe();
    };
  }, [setAuth]);

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  const renderScreen = () => {
    if (!room) {
      return <JoinScreen />;
    }

    switch (room.status) {
      case "lobby":
        return <LobbyScreen />;
      case "role_reveal":
        return <RoleRevealScreen />;
      case "team_building":
      case "team_voting":
      case "team_vote_reveal":
      case "quest_voting":
      case "quest_result":
        return <GameScreen />;
      case "assassin":
        return <AssassinScreen />;
      case "game_over":
        return <GameOverScreen />;
      default:
        return <div>Unknown state</div>;
    }
  };

  return (
    <>
      <LanguageToggle />
      {renderScreen()}
      <IdleWarningModal />
    </>
  );
}
