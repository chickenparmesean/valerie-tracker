'use client';

import { useEffect, useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase-browser';

interface RealtimeOptions {
  table: string;
  event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
  filter?: string;
}

export function useRealtimeSubscription<T>(options: RealtimeOptions) {
  const [data, setData] = useState<T | null>(null);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();

    const channel = supabase
      .channel(`realtime-${options.table}`)
      .on(
        'postgres_changes',
        {
          event: options.event ?? '*',
          schema: 'public',
          table: options.table,
          filter: options.filter,
        },
        (payload) => {
          setData(payload.new as T);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [options.table, options.event, options.filter]);

  return data;
}
