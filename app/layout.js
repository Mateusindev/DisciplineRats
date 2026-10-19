import "./globals.css";

export const metadata = {
  title: "Discipline Rats",
  description: "Seu painel diário de disciplina",
  manifest: "/manifest.json",
  // Sem `icons` aqui de propósito: o Next pega app/favicon.ico, app/icon.png e
  // app/apple-icon.png pela convenção de arquivo. Declarar à mão sobrescreveria isso.
  //
  // O ícone do app INSTALADO vem do manifest.json (public/icons/, com uma versão
  // maskable com margem pro recorte redondo do Android). Notificações usam
  // public/icons/icon-192.png. Tudo gerado de logo.jpg — trocar o logo é regerar os PNGs.
};

export const viewport = {
  themeColor: "#0b0e17",
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR" className="dark">
      <body className="bg-background text-on-background font-body-md selection:bg-primary-container selection:text-on-primary-container">
        {children}
      </body>
    </html>
  );
}
