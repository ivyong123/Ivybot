import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/layout/header';
import { ChatInterface } from '@/components/chat/ChatInterface';

export default async function ChatPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <div className="min-h-screen flex flex-col">
      <Header user={user} />
      <main className="flex-1 container py-8">
        <ChatInterface />
      </main>
    </div>
  );
}
