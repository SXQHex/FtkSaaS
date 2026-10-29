import { AuthScreen } from "../../components/auth/auth-screen";
export default function Layout({ children }: { children: React.ReactNode }) {
  return <AuthScreen>{children}</AuthScreen>;
}
