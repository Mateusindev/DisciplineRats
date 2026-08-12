"use client";

// A Rotina deixou de ser página própria: ela virou um dos tipos da Agenda, junto
// de evento único e repetição semanal — as três coisas se descrevem quase igual
// (título, quando, hora), e executar o dia em duas telas não fazia sentido.
// A rota continua existindo pra não quebrar link antigo, atalho salvo ou favorito.

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader } from "@/components/ui";

export default function RotinaPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/calendario");
  }, [router]);
  return <Loader label="A rotina agora fica na Agenda..." />;
}
