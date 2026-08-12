import "./globals.css";

export const metadata = {
  title: "Discipline Rats",
  description: "Seu painel diário de disciplina",
  manifest: "/manifest.json",
  // Sem `icons` aqui de propósito: o Next pega app/favicon.ico pela convenção de
  // arquivo. Declarar o ícone à mão sobrescreveria isso.
  //
  // O ícone do app INSTALADO (tela de início) e o das notificações continuam sendo
  // public/icon.svg, via manifest.json — são outra coisa, e trocá-los junto
  // apagaria a identidade do app no celular.
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
