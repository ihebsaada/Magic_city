import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";

const faqs = [
  {
    question: "Quanto tempo ci vuole per la spedizione?",
    answer: "Spediamo in tutta Italia in 24-48 ore lavorative. Per ordini superiori a €99,90 la spedizione è gratuita. Offriamo anche spedizioni express in 24h per alcune aree.",
  },
  {
    question: "Posso restituire o cambiare un prodotto?",
    answer: "Sì! Hai 30 giorni di tempo per restituire o cambiare qualsiasi prodotto. Il reso è gratuito e puoi richiedere il ritiro direttamente da casa tua. Il prodotto deve essere non indossato e con le etichette originali.",
  },
  {
    question: "Come posso essere sicuro che i prodotti siano autentici?",
    answer: "Tutti i nostri prodotti sono autentici al 100%. Lavoriamo direttamente con i brand o con rivenditori autorizzati ufficiali. Ogni prodotto viene verificato dal nostro team prima della spedizione.",
  },
  {
    question: "Offrite spedizioni internazionali?",
    answer: "Attualmente spediamo solo in Italia. Stiamo lavorando per espandere le nostre spedizioni in tutta Europa nei prossimi mesi. Iscriviti alla newsletter per essere aggiornato!",
  },
  {
    question: "Come faccio a scegliere la taglia giusta?",
    answer: "Ogni prodotto ha una guida alle taglie specifica nella pagina del prodotto. Se hai dubbi, il nostro team di assistenza è disponibile per aiutarti a trovare la taglia perfetta. In caso di errore, puoi sempre effettuare un cambio taglia gratuito.",
  },
  {
    question: "Quali metodi di pagamento accettate?",
    answer: "Accettiamo tutte le principali carte di credito e debito (Visa, Mastercard, American Express), PayPal, e pagamento alla consegna (per ordini in Italia). Tutti i pagamenti sono sicuri e protetti.",
  },
  {
    question: "Posso modificare o cancellare un ordine?",
    answer: "Se l'ordine non è ancora stato spedito, puoi modificarlo o cancellarlo contattando il nostro servizio clienti. Una volta spedito, potrai comunque restituirlo gratuitamente seguendo la procedura di reso.",
  },
  {
    question: "Come posso tracciare il mio ordine?",
    answer: "Riceverai un'email con il numero di tracking non appena il tuo ordine viene spedito. Potrai seguire la spedizione in tempo reale cliccando sul link nell'email.",
  },
  {
    question: "Avete un negozio fisico?",
    answer: "Al momento siamo solo online, ma stiamo pianificando l'apertura di uno showroom a Milano. Iscriviti alla newsletter per essere il primo a saperlo!",
  },
  {
    question: "Come posso contattare il servizio clienti?",
    answer: "Puoi contattarci via email all'indirizzo info@magiccitydrip.com, per telefono al +39 02 1234 5678, oppure compilando il form nella pagina Contatti. Rispondiamo entro 24 ore.",
  },
];

const FAQ = () => {
  return (
    <div className="min-h-screen py-12">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="mb-12 text-center">
          <h1 className="mb-4 font-serif text-4xl font-bold md:text-5xl">
            Domande Frequenti
          </h1>
          <p className="mx-auto max-w-2xl text-muted-foreground">
            Trova le risposte alle domande più comuni. Se non trovi quello che cerchi, contattaci direttamente!
          </p>
        </div>

        {/* FAQ Accordion */}
        <div className="mx-auto max-w-3xl">
          <Accordion type="single" collapsible className="w-full">
            {faqs.map((faq, index) => (
              <AccordionItem key={index} value={`item-${index}`}>
                <AccordionTrigger className="text-left font-medium">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>

        {/* CTA */}
        <div className="mt-16 rounded-sm border bg-muted/30 p-8 text-center">
          <h3 className="mb-2 font-serif text-2xl font-bold">
            Hai ancora domande?
          </h3>
          <p className="mb-6 text-muted-foreground">
            Il nostro team è qui per aiutarti
          </p>
          <Button asChild size="lg" className="bg-primary hover:bg-primary/90">
            <a href="/contact">Contattaci</a>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default FAQ;
