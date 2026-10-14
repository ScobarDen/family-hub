import { Session, type SessionModel } from "@/modules/session";

type AppProps = { session: SessionModel };

export function App({ session }: AppProps) {
  return <Session model={session} />;
}
