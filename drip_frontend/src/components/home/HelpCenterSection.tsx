// src/components/sections/HelpCenterSection.tsx
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";

export const HelpCenterSection = () => {
  return (
    <section className="border-t border-b bg-muted/40">
      <div className="container mx-auto grid max-w-5xl grid-cols-1 gap-10 px-4 py-12 md:grid-cols-2 md:py-16 lg:gap-16">
        {/* COLONNE GAUCHE */}
        <div className="space-y-4">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Hai una domanda?
          </p>
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
            Help Center
          </h2>

          <p className="text-sm leading-relaxed text-muted-foreground md:text-base">
            Se hai un problema o una domanda che richiede assistenza immediata,
            puoi cliccare sul pulsante qui sotto per chattare in diretta con un
            rappresentante del servizio clienti.
          </p>

          <p className="text-sm leading-relaxed text-muted-foreground md:text-base">
            Team di assistenza clienti: tutti i giorni dalle 8:00 alle 19:30.
            Tempo medio di risposta: 1 ora.
          </p>

          <Button className="mt-4 h-11 rounded-full px-8 text-sm font-semibold">
            Contattaci
          </Button>
        </div>

        {/* COLONNE DROITE = FAQ / ACCORDION */}
        <div className="space-y-4">
          <Accordion
            type="single"
            collapsible
            className="w-full divide-y rounded-xl border bg-background"
            defaultValue="q1"
          >
            <AccordionItem value="q1" className="border-0 px-5">
              <AccordionTrigger className="py-4 text-left text-sm font-medium md:text-base">
                In quanto tempo riceverò il mio ordine?
              </AccordionTrigger>
              <AccordionContent className="pb-4 text-sm text-muted-foreground md:text-[15px]">
                Le spedizioni vengono consegnate in 5–7 giorni lavorativi.
                Riceverai un’email con il codice di tracciamento non appena il
                pacco sarà affidato al corriere.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="q2" className="border-0 px-5">
              <AccordionTrigger className="py-4 text-left text-sm font-medium md:text-base">
                La spedizione è gratuita?
              </AccordionTrigger>
              <AccordionContent className="pb-4 text-sm text-muted-foreground md:text-[15px]">
                Offriamo spedizione gratuita sopra una certa soglia d’ordine. I
                dettagli e le soglie attuali sono indicati nella pagina
                Spedizioni e Resi.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="q3" className="border-0 px-5">
              <AccordionTrigger className="py-4 text-left text-sm font-medium md:text-base">
                Spedite anche all’estero?
              </AccordionTrigger>
              <AccordionContent className="pb-4 text-sm text-muted-foreground md:text-[15px]">
                Sì, spediamo in diversi paesi europei. Durante il checkout
                potrai vedere le destinazioni disponibili e i relativi costi.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="q4" className="border-0 px-5">
              <AccordionTrigger className="py-4 text-left text-sm font-medium md:text-base">
                Il reso è gratuito?
              </AccordionTrigger>
              <AccordionContent className="pb-4 text-sm text-muted-foreground md:text-[15px]">
                Hai 14 giorni dalla consegna per richiedere il reso. In molti
                casi il reso è gratuito, ma può variare in base alla zona: trovi
                tutte le condizioni complete nella sezione Resi.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </div>
    </section>
  );
};
