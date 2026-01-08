import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Mail, Phone, MapPin } from "lucide-react";

const Contact = () => {
  return (
    <div className="min-h-screen py-12">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="mb-12 text-center">
          <h1 className="mb-4 font-serif text-4xl font-bold md:text-5xl">
            Contattaci
          </h1>
          <p className="mx-auto max-w-2xl text-muted-foreground">
            Hai domande? Il nostro team è qui per aiutarti. Compila il form o contattaci direttamente.
          </p>
        </div>

        <div className="mx-auto grid max-w-5xl gap-12 lg:grid-cols-2">
          {/* Contact Form */}
          <div>
            <h2 className="mb-6 font-serif text-2xl font-bold">
              Inviaci un messaggio
            </h2>
            <form className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium">Nome</label>
                <Input placeholder="Il tuo nome" />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium">Email</label>
                <Input type="email" placeholder="tua@email.com" />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium">Oggetto</label>
                <Input placeholder="Come possiamo aiutarti?" />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium">Messaggio</label>
                <Textarea
                  placeholder="Scrivi il tuo messaggio qui..."
                  rows={6}
                />
              </div>
              <Button size="lg" className="w-full bg-primary hover:bg-primary/90">
                Invia Messaggio
              </Button>
            </form>
          </div>

          {/* Contact Info */}
          <div className="space-y-8">
            <div>
              <h2 className="mb-6 font-serif text-2xl font-bold">
                Informazioni di Contatto
              </h2>
              <p className="mb-6 text-muted-foreground">
                Siamo qui per rispondere a tutte le tue domande. Non esitare a contattarci!
              </p>
            </div>

            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/10">
                  <Mail className="h-6 w-6 text-accent" />
                </div>
                <div>
                  <p className="font-medium">Email</p>
                  <p className="text-muted-foreground">info@magiccitydrip.com</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/10">
                  <Phone className="h-6 w-6 text-accent" />
                </div>
                <div>
                  <p className="font-medium">Telefono</p>
                  <p className="text-muted-foreground">+39 02 1234 5678</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/10">
                  <MapPin className="h-6 w-6 text-accent" />
                </div>
                <div>
                  <p className="font-medium">Indirizzo</p>
                  <p className="text-muted-foreground">
                    Via della Moda 123<br />
                    20121 Milano, Italia
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-sm border bg-muted/30 p-6">
              <h3 className="mb-2 font-medium">Orari di Apertura</h3>
              <div className="space-y-1 text-sm text-muted-foreground">
                <p>Lunedì - Venerdì: 9:00 - 18:00</p>
                <p>Sabato: 10:00 - 16:00</p>
                <p>Domenica: Chiuso</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Contact;
