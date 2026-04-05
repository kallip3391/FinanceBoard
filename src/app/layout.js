import "./globals.css";
import ClientLayout from "./components/ClientLayout";

export const metadata = {
  title: "Finance Board Dashboard",
  description: "A premium financial management dashboard for tracking assets and dividends.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body className="antialiased">
        <ClientLayout>
          {children}
        </ClientLayout>
      </body>
    </html>
  );
}
