import "./globals.css";

export const metadata = {
  title: "Discipline Rats",
  description: "Seu painel diário de disciplina",
  manifest: "/manifest.json",
  icons: { icon: "/icon.svg" },
};

export const viewport = {
  themeColor: "#f5f8fd",
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR" className="light">
      <body className="bg-background text-on-background font-body-md selection:bg-primary-container selection:text-on-primary-container">
        {children}
      </body>
    </html>
  );
}
